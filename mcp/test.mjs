import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { once } from "node:events";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

import { createOAuthResourceConfig, startHttpServer } from "./server.mjs";
import { runLivePreflight } from "./preflight.mjs";
import { loadLocalEnvFile, USER_ENV_KEYS } from "./local-env.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SCRIPT = path.join(ROOT, "server.mjs");
const USER_ID = "11111111-1111-4111-8111-111111111111";
const WORKSPACE_ID = "22222222-2222-4222-8222-222222222222";
const CONTACT_ID = "33333333-3333-4333-8333-333333333333";
const FLOW_ID = "44444444-4444-4444-8444-444444444444";
const UNSUPPORTED_FLOW_ID = "99999999-9999-4999-8999-999999999999";
const CONVERSATION_ID = "55555555-5555-4555-8555-555555555555";
const TEST_TOKEN = "test-access-token-which-is-not-a-real-credential";
const ANON_KEY = "test-public-anon-key";

function json(res, status, value, headers = {}) {
  const text = JSON.stringify(value);
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(text);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : null;
}

async function startMockSupabase({ additionalTokens = [] } = {}) {
  const acceptedTokens = new Set([TEST_TOKEN, ...additionalTokens].map((token) => `Bearer ${token}`));
  const state = {
    contacts: [{
      id: CONTACT_ID,
      workspace_id: WORKSPACE_ID,
      name: "Example contact",
      handle: "@example",
      channel: "instagram",
      tags: ["test"],
      last_seen: "2026-10-28T00:00:00.000Z"
    }],
    flows: [{
      id: FLOW_ID,
      workspace_id: WORKSPACE_ID,
      name: "Draft flow",
      channel: "instagram",
      status: "draft",
      runs: 0,
      nodes: [{ t: "trigger", text: "Draft trigger" }],
      updated_at: "2026-10-28T00:00:00.000Z"
    }, {
      id: UNSUPPORTED_FLOW_ID,
      workspace_id: WORKSPACE_ID,
      name: "Legacy draft",
      channel: "web",
      status: "draft",
      runs: 0,
      nodes: [{ t: "msg", text: "Keep this field", legacy_metadata: "do-not-drop" }],
      updated_at: "2026-10-28T00:00:00.000Z"
    }],
    conversations: [{
      id: CONVERSATION_ID,
      workspace_id: WORKSPACE_ID,
      contact_id: CONTACT_ID,
      channel: "instagram",
      status: "open",
      unread: 0,
      last_at: "2026-10-28T00:00:00.000Z"
    }],
    messages: [{
      id: "66666666-6666-4666-8666-666666666666",
      conversation_id: CONVERSATION_ID,
      direction: "in",
      author: "customer",
      body: "Test-only message body",
      created_at: "2026-10-28T00:00:00.000Z"
    }],
    seenHeaders: [],
    requests: []
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    state.requests.push({ method: req.method, path: url.pathname });
    if (url.pathname === "/auth/v1/user") {
      if (!acceptedTokens.has(req.headers.authorization) || req.headers.apikey !== ANON_KEY) {
        return json(res, 401, { error: "invalid_token" });
      }
      return json(res, 200, { id: USER_ID, role: "authenticated" });
    }
    if (!url.pathname.startsWith("/rest/v1/")) return json(res, 404, { error: "not_found" });

    state.seenHeaders.push({
      authorization: req.headers.authorization,
      apikey: req.headers.apikey
    });
    if (!acceptedTokens.has(req.headers.authorization) || req.headers.apikey !== ANON_KEY) {
      return json(res, 401, { error: "invalid_database_auth" });
    }

    const table = url.pathname.slice("/rest/v1/".length);
    if (table === "workspaces") {
      if (req.method === "GET") {
        const owner = (url.searchParams.get("owner") || "").replace(/^eq\./, "");
        return json(res, 200, owner === USER_ID ? [{ id: WORKSPACE_ID, name: "QA workspace", plan: "free", owner: USER_ID }] : []);
      }
      if (req.method === "PATCH") {
        const body = await readJson(req);
        const owner = (url.searchParams.get("owner") || "").replace(/^eq\./, "");
        const id = (url.searchParams.get("id") || "").replace(/^eq\./, "");
        return json(res, 200, owner === USER_ID && id === WORKSPACE_ID ? [{ id: WORKSPACE_ID, name: body.name, plan: "free", owner: USER_ID }] : []);
      }
    }

    if (["contacts", "flows", "conversations"].includes(table) && req.method === "HEAD") {
      const rows = state[table].filter((row) => row.workspace_id === WORKSPACE_ID);
      res.writeHead(200, { "Content-Range": `0-0/${rows.length}` });
      return res.end();
    }
    if (["contacts", "flows", "conversations", "messages"].includes(table) && req.method === "GET") {
      let rows = state[table].slice();
      if (url.searchParams.has("workspace_id")) {
        const workspace = (url.searchParams.get("workspace_id") || "").replace(/^eq\./, "");
        rows = rows.filter((row) => row.workspace_id === workspace);
      }
      if (url.searchParams.has("id")) {
        const id = (url.searchParams.get("id") || "").replace(/^eq\./, "");
        rows = rows.filter((row) => row.id === id);
      }
      if (url.searchParams.has("conversation_id")) {
        const id = (url.searchParams.get("conversation_id") || "").replace(/^eq\./, "");
        rows = rows.filter((row) => row.conversation_id === id);
      }
      if (url.searchParams.has("status")) {
        const status = (url.searchParams.get("status") || "").replace(/^eq\./, "");
        rows = rows.filter((row) => row.status === status);
      }
      const offset = Number(url.searchParams.get("offset") || 0);
      const limit = Number(url.searchParams.get("limit") || 50);
      return json(res, 200, rows.slice(offset, offset + limit));
    }
    if (["contacts", "flows"].includes(table) && req.method === "POST") {
      const body = await readJson(req);
      if (body.workspace_id !== WORKSPACE_ID) return json(res, 403, { error: "not_owned" });
      const row = {
        ...body,
        id: table === "flows" ? "77777777-7777-4777-8777-777777777777" : "88888888-8888-4888-8888-888888888888",
        updated_at: body.updated_at || new Date().toISOString()
      };
      state[table].push(row);
      return json(res, 201, [row]);
    }
    if (["flows", "conversations"].includes(table) && req.method === "PATCH") {
      const body = await readJson(req);
      const id = (url.searchParams.get("id") || "").replace(/^eq\./, "");
      const workspace = (url.searchParams.get("workspace_id") || "").replace(/^eq\./, "");
      const rows = state[table].filter((row) => row.id === id && row.workspace_id === workspace);
      for (const row of rows) Object.assign(row, body);
      return json(res, 200, rows);
    }
    return json(res, 404, { error: "unsupported_test_route" });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  return {
    url: `http://127.0.0.1:${address.port}`,
    state,
    close: () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  };
}

function makeClient(name, transport) {
  return new Client({ name, version: "0.1.0" }, { versionNegotiation: { mode: "auto" } });
}

function toolText(result) {
  return result.content?.filter((item) => item.type === "text").map((item) => item.text).join("\n") || "";
}

function envFor(mock, token = "") {
  const env = Object.fromEntries(Object.entries(process.env).filter(([, value]) => typeof value === "string"));
  env.SUPABASE_URL = mock.url;
  env.SUPABASE_ANON_KEY = ANON_KEY;
  env.CHATORA_ACCESS_TOKEN = token;
  return env;
}

function fakeJwt(claims) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${header}.${payload}.test-only-signature`;
}

test("local env loader reads only allow-listed values and enforces private file permissions", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "chatora-mcp-env-"));
  const envFile = path.join(directory, ".env");
  const env = {};
  try {
    await writeFile(envFile, [
      "# mock-only values for the parser test",
      "SUPABASE_URL='https://example.supabase.co'",
      "SUPABASE_ANON_KEY=mock-public-key # inline note",
      "CHATORA_ACCESS_TOKEN=mock-token-value-that-is-not-real",
      "IGNORED_KEY=must-not-load",
      "SHELL_SYNTAX=$(touch-not-executed)"
    ].join("\n"), { mode: 0o600 });
    await loadLocalEnvFile({ envFile, env, allowedKeys: USER_ENV_KEYS, requiredKeys: USER_ENV_KEYS, required: true });
    assert.equal(env.SUPABASE_URL, "https://example.supabase.co");
    assert.equal(env.SUPABASE_ANON_KEY, "mock-public-key");
    assert.equal(env.CHATORA_ACCESS_TOKEN, "mock-token-value-that-is-not-real");
    assert.equal(env.IGNORED_KEY, undefined);
    assert.equal(env.SHELL_SYNTAX, undefined);

    if (process.platform !== "win32") {
      await chmod(envFile, 0o644);
      await assert.rejects(
        () => loadLocalEnvFile({ envFile, env: {}, allowedKeys: USER_ENV_KEYS, required: true }),
        /permissions are too broad/i
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("STDIO exposes public pages and protects workspace tools; authenticated actions stay workspace-scoped", async () => {
  const mock = await startMockSupabase();
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_SCRIPT, "stdio"],
    cwd: ROOT,
    env: envFor(mock, TEST_TOKEN),
    stderr: "pipe"
  });
  const client = makeClient("stdio-smoke", transport);
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name);
    for (const name of ["search_public_site", "get_public_page", "get_workspace_summary", "get_flow_draft", "create_flow_draft", "update_flow_draft", "create_contact"]) {
      assert.ok(names.includes(name), `missing tool: ${name}`);
    }
    assert.ok(!names.some((name) => /send|broadcast|activate|connect_meta/i.test(name)), "MCP must not expose message-sending or channel-connection actions");

    const publicSearch = await client.callTool({ name: "search_public_site", arguments: { query: "WhatsApp", locale: "en", limit: 3 } });
    assert.equal(publicSearch.isError, undefined);
    assert.match(toolText(publicSearch), /results/);

    const page = await client.callTool({ name: "get_public_page", arguments: { path: "/pricing.html", max_chars: 1200 } });
    assert.equal(page.isError, undefined);
    assert.match(toolText(page), /pricing|plans|price/i);

    const summary = await client.callTool({ name: "get_workspace_summary", arguments: {} });
    assert.equal(summary.isError, undefined);
    assert.match(toolText(summary), /QA workspace/);
    assert.match(toolText(summary), /contacts/);

    const fullDraft = await client.callTool({ name: "get_flow_draft", arguments: { flow_id: FLOW_ID } });
    assert.equal(fullDraft.isError, undefined);
    assert.match(toolText(fullDraft), /Draft trigger/);
    assert.match(toolText(fullDraft), /"nodes_truncated": false/);

    const created = await client.callTool({
      name: "create_flow_draft",
      arguments: { name: "MCP test draft", channel: "instagram" }
    });
    assert.equal(created.isError, undefined);
    assert.match(toolText(created), /"status": "draft"/);
    assert.match(toolText(created), /Draft message/);
    const flowInsert = mock.state.flows.find((row) => row.name === "MCP test draft");
    assert.ok(flowInsert);
    assert.equal(flowInsert.workspace_id, WORKSPACE_ID);
    assert.equal(flowInsert.status, "draft");
    assert.equal(flowInsert.runs, 0);

    const contacts = await client.callTool({ name: "list_contacts", arguments: { search: "Example" } });
    assert.equal(contacts.isError, undefined);
    assert.match(toolText(contacts), /Example contact/);

    const conversations = await client.callTool({ name: "list_conversations", arguments: { status: "open" } });
    assert.equal(conversations.isError, undefined);
    assert.match(toolText(conversations), new RegExp(CONVERSATION_ID));

    const thread = await client.callTool({ name: "get_conversation_messages", arguments: { conversation_id: CONVERSATION_ID } });
    assert.equal(thread.isError, undefined);
    assert.match(toolText(thread), /Test-only message body/);

    const contactCreated = await client.callTool({
      name: "create_contact",
      arguments: { name: "MCP contact", handle: "@mcp", channel: "web", tags: ["local-test"] }
    });
    assert.equal(contactCreated.isError, undefined);
    assert.match(toolText(contactCreated), /MCP contact/);
    assert.equal(mock.state.contacts.find((row) => row.name === "MCP contact")?.workspace_id, WORKSPACE_ID);

    const draftUpdated = await client.callTool({
      name: "update_flow_draft",
      arguments: { flow_id: FLOW_ID, name: "Updated local draft", steps: [{ t: "trigger", text: "Draft only" }] }
    });
    assert.equal(draftUpdated.isError, undefined);
    assert.match(toolText(draftUpdated), /Updated local draft/);
    assert.equal(mock.state.flows.find((row) => row.id === FLOW_ID)?.status, "draft");

    const unsupportedDraft = await client.callTool({
      name: "update_flow_draft",
      arguments: { flow_id: UNSUPPORTED_FLOW_ID, steps: [{ t: "msg", text: "Replace all" }] }
    });
    assert.equal(unsupportedDraft.isError, true);
    assert.match(toolText(unsupportedDraft), /extra step fields MCP does not edit/i);
    assert.equal(mock.state.flows.find((row) => row.id === UNSUPPORTED_FLOW_ID)?.nodes[0].legacy_metadata, "do-not-drop");

    const conversationUpdated = await client.callTool({
      name: "set_conversation_status",
      arguments: { conversation_id: CONVERSATION_ID, status: "closed" }
    });
    assert.equal(conversationUpdated.isError, undefined);
    assert.equal(mock.state.conversations.find((row) => row.id === CONVERSATION_ID)?.status, "closed");

    const renamed = await client.callTool({ name: "rename_workspace", arguments: { name: "Renamed QA workspace" } });
    assert.equal(renamed.isError, undefined);
    assert.match(toolText(renamed), /Renamed QA workspace/);

    assert.ok(mock.state.seenHeaders.length > 0);
    assert.ok(mock.state.seenHeaders.every((header) => header.apikey === ANON_KEY));
    assert.ok(mock.state.seenHeaders.every((header) => header.authorization === `Bearer ${TEST_TOKEN}`));
    assert.ok(!mock.state.seenHeaders.some((header) => /service.role/i.test(header.apikey || "")));
  } finally {
    await client.close();
    await mock.close();
  }
});

test("STDIO without a token still serves public pages and refuses private tools", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_SCRIPT, "stdio"],
    cwd: ROOT,
    env: envFor({ url: "", }, ""),
    stderr: "pipe"
  });
  const client = makeClient("stdio-public-only", transport);
  try {
    await client.connect(transport);
    const result = await client.callTool({ name: "get_public_page", arguments: { path: "/about.html", max_chars: 800 } });
    assert.equal(result.isError, undefined);
    assert.match(toolText(result), /Chatora|preview|workspace/i);

    const denied = await client.callTool({ name: "get_workspace_summary", arguments: {} });
    assert.equal(denied.isError, true);
    assert.match(toolText(denied), /signed-in Supabase user/i);

    const privateApp = await client.callTool({ name: "get_public_page", arguments: { path: "/app.html" } });
    assert.equal(privateApp.isError, true);
    assert.match(toolText(privateApp), /not an indexable public page/i);
    const traversal = await client.callTool({ name: "get_public_page", arguments: { path: "/../../README.md" } });
    assert.equal(traversal.isError, true);
  } finally {
    await client.close();
  }
});

test("explicit Supabase preflight performs read-only checks without printing credentials or customer rows", async () => {
  const mock = await startMockSupabase();
  try {
    const lines = [];
    await runLivePreflight({ env: envFor(mock, TEST_TOKEN), write: (line) => lines.push(line) });
    const output = lines.join("\n");
    assert.match(output, /user-token verification: OK/i);
    assert.match(output, /contacts=1, flows=2, conversations=1/);
    assert.doesNotMatch(output, new RegExp(TEST_TOKEN));
    assert.doesNotMatch(output, /QA workspace|Example contact/);
    assert.ok(mock.state.requests.some((item) => item.path === "/auth/v1/user"));
    assert.ok(mock.state.requests.some((item) => item.path === "/rest/v1/workspaces"));
    assert.ok(mock.state.requests.every((item) => ["GET", "HEAD"].includes(item.method)));
  } finally {
    await mock.close();
  }
});

test("STDIO refuses a Supabase secret key before making any backend request", async () => {
  const mock = await startMockSupabase();
  const env = envFor(mock, TEST_TOKEN);
  env.SUPABASE_ANON_KEY = "sb_secret_test_only";
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_SCRIPT, "stdio"],
    cwd: ROOT,
    env,
    stderr: "pipe"
  });
  const client = makeClient("stdio-secret-key-check", transport);
  try {
    await client.connect(transport);
    const denied = await client.callTool({ name: "get_workspace_summary", arguments: {} });
    assert.equal(denied.isError, true);
    assert.match(toolText(denied), /secret\/service-role key is not permitted/i);
    assert.equal(mock.state.requests.length, 0);
  } finally {
    await client.close();
    await mock.close();
  }
});

test("Streamable HTTP works on loopback with optional per-user bearer authentication", async () => {
  const mock = await startMockSupabase();
  const mcp = await startHttpServer({ port: 0, supabaseUrl: mock.url, supabaseAnonKey: ANON_KEY });
  const transport = new StreamableHTTPClientTransport(new URL(mcp.url), {
    requestInit: { headers: { Authorization: `Bearer ${TEST_TOKEN}` } }
  });
  const client = makeClient("http-auth-smoke", transport);
  try {
    await client.connect(transport);
    const result = await client.callTool({ name: "get_workspace_summary", arguments: {} });
    assert.equal(result.isError, undefined);
    assert.match(toolText(result), /QA workspace/);
    const created = await client.callTool({
      name: "create_flow_draft",
      arguments: { name: "HTTP test draft", channel: "whatsapp", steps: [{ t: "trigger", text: "Not live" }] }
    });
    assert.equal(created.isError, undefined);
    assert.match(toolText(created), /"status": "draft"/);
    assert.equal(mock.state.flows.find((row) => row.name === "HTTP test draft")?.status, "draft");

    const publicTransport = new StreamableHTTPClientTransport(new URL(mcp.url));
    const publicClient = makeClient("http-public-smoke", publicTransport);
    try {
      await publicClient.connect(publicTransport);
      const publicPage = await publicClient.callTool({ name: "get_public_page", arguments: { path: "/", max_chars: 700 } });
      assert.equal(publicPage.isError, undefined);
      assert.match(toolText(publicPage), /Chatora/);
      const denied = await publicClient.callTool({ name: "get_workspace_summary", arguments: {} });
      assert.equal(denied.isError, true);
    } finally {
      await publicClient.close();
    }
  } finally {
    await client.close();
    await mcp.close();
    await mock.close();
  }
});

test("Supabase OAuth discovery uses the documented path and fails closed on issuer mismatch", async () => {
  const supabaseUrl = "https://chatora-test.supabase.co";
  const issuer = `${supabaseUrl}/auth/v1`;
  const metadata = {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    code_challenge_methods_supported: ["S256"]
  };
  let requestedUrl = "";
  let requestHeaders;
  const config = await createOAuthResourceConfig({
    resourceUrl: "https://mcp.example.test/mcp",
    fetchImpl: async (url, init) => {
      requestedUrl = String(url);
      requestHeaders = new Headers(init?.headers);
      return Response.json(metadata);
    }
  }, { supabaseUrl, supabaseAnonKey: ANON_KEY });
  assert.equal(requestedUrl, `${supabaseUrl}/.well-known/oauth-authorization-server/auth/v1`);
  assert.equal(requestHeaders.has("authorization"), false);
  assert.equal(requestHeaders.has("apikey"), false);
  assert.equal(config.resourceMetadataUrl, "https://mcp.example.test/.well-known/oauth-protected-resource/mcp");

  await assert.rejects(
    () => createOAuthResourceConfig({
      resourceUrl: "https://mcp.example.test/mcp",
      fetchImpl: async () => Response.json({ ...metadata, issuer: "https://attacker.example/auth/v1" })
    }, { supabaseUrl, supabaseAnonKey: ANON_KEY }),
    /issuer that does not match SUPABASE_URL/i
  );
});

test("optional OAuth resource-server mode serves discovery, challenges unauthenticated requests, and enforces audience", async () => {
  const resourceUrl = "https://mcp.example.test/mcp";
  const now = Math.floor(Date.now() / 1000);
  const validToken = fakeJwt({ sub: USER_ID, role: "authenticated", aud: resourceUrl, exp: now + 3600, client_id: "local-test-client", scope: "openid profile" });
  const wrongAudienceToken = fakeJwt({ sub: USER_ID, role: "authenticated", aud: "https://other.example.test/mcp", exp: now + 3600, client_id: "local-test-client" });
  const mock = await startMockSupabase({ additionalTokens: [validToken, wrongAudienceToken] });
  const issuer = `${mock.url}/auth/v1`;
  const metadata = {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    registration_endpoint: `${issuer}/oauth/clients`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"]
  };
  const mcp = await startHttpServer({
    port: 0,
    supabaseUrl: mock.url,
    supabaseAnonKey: ANON_KEY,
    oauth: { resourceUrl, expectedAudience: resourceUrl, authorizationServerMetadata: metadata }
  });
  const transport = new StreamableHTTPClientTransport(new URL(mcp.url), {
    requestInit: { headers: { Authorization: `Bearer ${validToken}` } }
  });
  const client = makeClient("http-oauth-smoke", transport);
  try {
    const discovery = await fetch(new URL("/.well-known/oauth-protected-resource/mcp", mcp.url));
    assert.equal(discovery.status, 200);
    const resourceMetadata = await discovery.json();
    assert.equal(resourceMetadata.resource, resourceUrl);
    assert.deepEqual(resourceMetadata.authorization_servers, [issuer]);

    const unauthenticated = await fetch(mcp.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(unauthenticated.status, 401);
    assert.match(unauthenticated.headers.get("www-authenticate") || "", /resource_metadata=/i);
    assert.match(unauthenticated.headers.get("www-authenticate") || "", /oauth-protected-resource\/mcp/);

    const wrongAudience = await fetch(mcp.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${wrongAudienceToken}`, "Content-Type": "application/json" },
      body: "{}"
    });
    assert.equal(wrongAudience.status, 401);

    await client.connect(transport);
    const summary = await client.callTool({ name: "get_workspace_summary", arguments: {} });
    assert.equal(summary.isError, undefined);
    assert.match(toolText(summary), /QA workspace/);
  } finally {
    await client.close();
    await mcp.close();
    await mock.close();
  }
});

test("Streamable HTTP rejects an invalid bearer token before MCP tools run", async () => {
  const mock = await startMockSupabase();
  const mcp = await startHttpServer({ port: 0, supabaseUrl: mock.url, supabaseAnonKey: ANON_KEY });
  try {
    const response = await fetch(mcp.url, {
      method: "POST",
      headers: {
        Authorization: "Bearer invalid-test-token-which-is-not-real",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "invalid-test", version: "0.1.0" } } })
    });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).error, "invalid_token");

    const serviceRoleToken = `x.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.x`;
    const rejectedServiceRole = await fetch(mcp.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleToken}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "service-role-test", version: "0.1.0" } } })
    });
    assert.equal(rejectedServiceRole.status, 401);
  } finally {
    await mcp.close();
    await mock.close();
  }
});

test("Streamable HTTP refuses non-loopback binding unless OAuth resource-server mode is configured", async () => {
  await assert.rejects(
    () => startHttpServer({ port: 0, host: "0.0.0.0" }),
    /requires OAuth resource-server mode/i
  );
});

test("Streamable HTTP blocks cross-origin requests before passing them to MCP", async () => {
  const mcp = await startHttpServer({ port: 0 });
  try {
    const response = await fetch(mcp.url, {
      method: "POST",
      headers: {
        Origin: "https://untrusted.example",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "origin-test", version: "0.1.0" } } })
    });
    assert.equal(response.status, 403);

    const port = Number(new URL(mcp.url).port);
    const hostSpoof = await new Promise((resolve, reject) => {
      const request = httpRequest({
        hostname: "127.0.0.1",
        port,
        method: "POST",
        path: "/mcp",
        headers: { Host: "attacker.example", "Content-Type": "application/json" }
      }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { body += chunk; });
        res.on("end", () => resolve({ status: res.statusCode, body }));
      });
      request.on("error", reject);
      request.end("{}");
    });
    assert.equal(hostSpoof.status, 403);
    assert.match(hostSpoof.body, /Invalid Host/);
  } finally {
    await mcp.close();
  }
});
