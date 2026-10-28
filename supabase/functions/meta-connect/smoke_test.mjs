import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const WORKSPACE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const WABA_ID = "123456789012345";
const PHONE_ID = "234567890123456";
const PAGE_ID = "345678901234567";
const IG_ID = "456789012345678";
const APP_ID = "567890123456789";
const CREDIT_LINE_ID = "678901234567890";
const ALLOCATION_ID = "789012345678901";
const ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const BASE_URL = "https://supabase.example.test";
const APP_ORIGIN = "https://chatora.ansygroup.com";
const source = await readFile(new URL("./index.ts", import.meta.url), "utf8");

const env = new Map([
  ["SUPABASE_URL", BASE_URL],
  ["SUPABASE_SERVICE_ROLE_KEY", "service-role-mock"],
  ["SUPABASE_ANON_KEY", "anon-mock"],
  ["META_GRAPH_API_VERSION", "v26.0"],
  ["META_APP_ID", APP_ID],
  ["META_APP_SECRET", "app-secret-mock"],
  ["META_WHATSAPP_CONFIG_ID", "890123456789012"],
  ["META_INSTAGRAM_CONFIG_ID", "901234567890123"],
  ["META_WHATSAPP_PROVIDER_TYPE", "tech_provider"],
  ["META_ONBOARDING_ENABLED", "false"],
  ["CHANNEL_TOKEN_ENCRYPTION_KEY", ENCRYPTION_KEY],
  ["APP_ALLOWED_ORIGINS", APP_ORIGIN]
]);

const oauthStates = [];
const connections = [];
const secrets = [];
const graphCalls = [];
let idCounter = 1;
const uuid = () => `cccccccc-cccc-4ccc-8ccc-${String(idCounter++).padStart(12, "0")}`;
const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" }
});

function responseBody(row, select) {
  if (!select || select === "*") return row;
  const out = {};
  select.split(",").forEach((key) => { if (Object.hasOwn(row, key)) out[key] = row[key]; });
  return out;
}

async function mockSupabase(url, init) {
  const method = init.method || "GET";
  const query = url.searchParams;
  const path = url.pathname;
  if (path === "/auth/v1/user") return jsonResponse({ id: USER_ID, email: "owner@example.test" });
  if (path === "/rest/v1/workspaces") {
    const match = query.get("id") === `eq.${WORKSPACE_ID}` && query.get("owner") === `eq.${USER_ID}`;
    return jsonResponse(match ? [{ id: WORKSPACE_ID }] : []);
  }
  if (path === "/rest/v1/meta_oauth_states") {
    const select = query.get("select");
    if (method === "POST") {
      const body = JSON.parse(init.body);
      const row = Object.assign({
        id: uuid(), created_at: new Date().toISOString(), consumed_at: null,
        code_exchange_started_at: null, code_exchanged_at: null,
        access_token_ciphertext: null, access_token_iv: null, token_expires_at: null,
        state_metadata: {}
      }, body);
      oauthStates.push(row);
      return jsonResponse([responseBody(row, select)], 201);
    }
    if (method === "GET") {
      const row = oauthStates.find((item) =>
        query.get("state_sha256") === `eq.${item.state_sha256}` &&
        query.get("workspace_id") === `eq.${item.workspace_id}` &&
        query.get("created_by") === `eq.${item.created_by}` &&
        query.get("provider") === `eq.${item.provider}` &&
        query.get("consumed_at") === "is.null" &&
        Date.parse(item.expires_at) > Date.now()
      );
      return jsonResponse(row ? [responseBody(row, select)] : []);
    }
    if (method === "DELETE") {
      const cutoff = query.get("expires_at")?.slice(3) || "";
      for (let i = oauthStates.length - 1; i >= 0; i--) {
        if (Date.parse(oauthStates[i].expires_at) < Date.parse(cutoff)) oauthStates.splice(i, 1);
      }
      return new Response(null, { status: 204 });
    }
    if (method === "PATCH") {
      const idFilter = query.get("id") || "";
      const stateHashFilter = query.get("state_sha256") || "";
      const row = oauthStates.find((item) => idFilter
        ? `eq.${item.id}` === idFilter
        : stateHashFilter === `eq.${item.state_sha256}` &&
          query.get("workspace_id") === `eq.${item.workspace_id}` &&
          query.get("created_by") === `eq.${item.created_by}` &&
          query.get("provider") === `eq.${item.provider}` &&
          Date.parse(item.expires_at) > Date.now());
      if (!row) return jsonResponse([]);
      if (query.get("consumed_at") === "is.null" && row.consumed_at != null) return jsonResponse([]);
      const startFilter = query.get("code_exchange_started_at");
      if (startFilter === "is.null" && row.code_exchange_started_at != null) return jsonResponse([]);
      if (startFilter && startFilter.startsWith("eq.") && row.code_exchange_started_at !== startFilter.slice(3)) return jsonResponse([]);
      Object.assign(row, JSON.parse(init.body));
      return jsonResponse([responseBody(row, select)]);
    }
  }
  if (path === "/rest/v1/channel_connections") {
    const select = query.get("select");
    if (method === "GET") {
      const provider = query.get("provider")?.slice(3);
      const accountId = query.get("external_account_id")?.slice(3);
      const found = connections.filter((row) => row.provider === provider && row.external_account_id === accountId && row.status !== "disconnected");
      return jsonResponse(found.slice(0, 1).map((row) => responseBody(row, select)));
    }
    if (method === "POST") {
      const body = JSON.parse(init.body);
      let row = connections.find((item) => item.workspace_id === body.workspace_id && item.provider === body.provider && item.external_account_id === body.external_account_id);
      if (row) Object.assign(row, body);
      else {
        row = Object.assign({ id: uuid(), created_at: new Date().toISOString() }, body);
        connections.push(row);
      }
      return jsonResponse([responseBody(row, select)], 201);
    }
    if (method === "PATCH") {
      const id = query.get("id")?.slice(3);
      const row = connections.find((item) => item.id === id);
      if (!row) return jsonResponse([]);
      Object.assign(row, JSON.parse(init.body));
      return jsonResponse([responseBody(row, select)]);
    }
  }
  if (path === "/rest/v1/channel_connection_secrets" && method === "POST") {
    const body = JSON.parse(init.body);
    const found = secrets.find((item) => item.connection_id === body.connection_id);
    if (found) Object.assign(found, body);
    else secrets.push(body);
    return new Response(null, { status: 204 });
  }
  throw new Error(`Unexpected Supabase request: ${method} ${url.href}`);
}

async function mockMeta(url, init) {
  const method = init.method || "GET";
  const path = url.pathname;
  const token = new Headers(init.headers || {}).get("authorization") || "";
  graphCalls.push({ method, path, token, query: Object.fromEntries(url.searchParams.entries()), body: init.body || "" });

  if (path.endsWith("/oauth/access_token")) {
    if (url.searchParams.has("grant_type")) return jsonResponse({ access_token: "ig-long-lived-user-token", expires_in: 5184000 });
    if (url.searchParams.get("code") === "whatsapp-code-123456") return new Response("wa-business-token", { status: 200 });
    if (url.searchParams.get("code") === "instagram-code-123456") return jsonResponse({ access_token: "ig-short-user-token", expires_in: 3600 });
    return jsonResponse({ error: { message: "invalid" } }, 400);
  }
  if (path.endsWith(`/${WABA_ID}`) && method === "GET") return jsonResponse({ id: WABA_ID });
  if (path.endsWith(`/${WABA_ID}/phone_numbers`)) {
    return jsonResponse({ data: [{ id: PHONE_ID, display_phone_number: "+1 650 555 0100", verified_name: "Chatora Test" }] });
  }
  if (path.endsWith(`/${WABA_ID}/subscribed_apps`) && method === "POST") return jsonResponse({ success: true });
  if (path.endsWith(`/${PHONE_ID}/register`) && method === "POST") return jsonResponse({ success: true });
  if (path.endsWith(`/${CREDIT_LINE_ID}/whatsapp_credit_sharing_and_attach`) && method === "POST") {
    assert.equal(token, "Bearer solution-system-user-token");
    assert.equal(url.searchParams.get("waba_currency"), "USD");
    assert.equal(url.searchParams.get("waba_id"), WABA_ID);
    return jsonResponse({ allocation_config_id: ALLOCATION_ID, waba_id: WABA_ID });
  }
  if (path.endsWith("/me/accounts") && method === "GET") {
    assert.ok(token === "Bearer ig-long-lived-user-token");
    return jsonResponse({ data: [{
      id: PAGE_ID, name: "Test Page", tasks: ["MODERATE"],
      instagram_business_account: { id: IG_ID, username: "test_ig_business" }
    }] });
  }
  if (path.endsWith(`/${PAGE_ID}`) && method === "GET") {
    assert.ok(token === "Bearer ig-long-lived-user-token");
    return jsonResponse({
      id: PAGE_ID, name: "Test Page", access_token: "ig-page-access-token",
      instagram_business_account: { id: IG_ID, username: "test_ig_business" }
    });
  }
  if (path.endsWith(`/${PAGE_ID}/subscribed_apps`) && method === "POST") return jsonResponse({ success: true });
  throw new Error(`Unexpected Meta request: ${method} ${url.href}`);
}

async function mockFetch(input, init = {}) {
  const url = input instanceof URL ? input : new URL(String(input));
  if (url.origin === BASE_URL) return mockSupabase(url, init);
  if (url.hostname === "graph.facebook.com") return mockMeta(url, init);
  throw new Error(`Unexpected fetch origin: ${url.origin}`);
}

let handler;
const context = {
  Deno: {
    env: { get: (key) => env.get(key) || "" },
    serve: (fn) => { handler = fn; }
  },
  crypto: webcrypto,
  fetch: mockFetch,
  URL,
  Request,
  Response,
  Headers,
  AbortController,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  ArrayBuffer,
  Date,
  Math,
  JSON,
  Object,
  String,
  Number,
  Set,
  Error,
  btoa,
  atob,
  setTimeout,
  clearTimeout,
  console
};
vm.runInNewContext(source, context, { filename: "meta-connect.js" });
assert.equal(typeof handler, "function", "Edge Function handler should register");

async function call(body, { auth = "user-jwt", origin = APP_ORIGIN } = {}) {
  const response = await handler(new Request("https://function.example.test/meta-connect", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${auth}`,
      origin
    },
    body: JSON.stringify(body)
  }));
  return { status: response.status, body: await response.json() };
}

async function decrypt(ciphertextB64, ivB64) {
  const key = await webcrypto.subtle.importKey("raw", Buffer.from(ENCRYPTION_KEY, "base64"), { name: "AES-GCM" }, false, ["decrypt"]);
  const clear = await webcrypto.subtle.decrypt({ name: "AES-GCM", iv: Buffer.from(ivB64, "base64") }, key, Buffer.from(ciphertextB64, "base64"));
  return new TextDecoder().decode(clear);
}

// The server-side kill switch is fail-closed.
let result = await call({ action: "start", provider: "whatsapp_cloud", workspaceId: WORKSPACE_ID });
assert.equal(result.status, 503);
assert.equal(result.body.error, "meta_onboarding_disabled");
assert.equal(oauthStates.length, 0);

// Tech Provider flow: v4 code exchange, separate WABA/phone IDs, webhook
// subscription, PIN registration, and encrypted token persistence.
env.set("META_ONBOARDING_ENABLED", "true");
result = await call({ action: "start", provider: "whatsapp_cloud", workspaceId: WORKSPACE_ID });
assert.equal(result.status, 200);
assert.equal(result.body.providerType, "tech_provider");
const waState = result.body.state;
result = await call({
  action: "whatsapp_finish", workspaceId: WORKSPACE_ID, state: waState,
  code: "whatsapp-code-123456", pin: "123456", providerType: "tech_provider",
  sessionInfo: { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { waba_id: WABA_ID, phone_number_id: PHONE_ID, business_id: "890123456789012" } }
});
assert.equal(result.status, 200, JSON.stringify(result.body));
assert.equal(result.body.connection.externalAccountId, PHONE_ID);
assert.equal(result.body.connection.externalMessagingAccountId, WABA_ID);
assert.ok(!JSON.stringify(result.body).includes("wa-business-token"));
assert.equal(connections.find((row) => row.provider === "whatsapp_cloud").external_account_id, PHONE_ID);
assert.equal(connections.find((row) => row.provider === "whatsapp_cloud").external_messaging_account_id, WABA_ID);
assert.equal(await decrypt(secrets.find((row) => connections.find((conn) => conn.id === row.connection_id)?.provider === "whatsapp_cloud").access_token_ciphertext,
  secrets.find((row) => connections.find((conn) => conn.id === row.connection_id)?.provider === "whatsapp_cloud").access_token_iv), "wa-business-token");
assert.ok(graphCalls.some((call) => call.path.endsWith(`/${PHONE_ID}/register`)));
assert.ok(graphCalls.some((call) => call.path.endsWith(`/${WABA_ID}/subscribed_apps`)));

// Solution Partner mode is explicit; it does not silently use the Tech Provider path.
env.set("META_WHATSAPP_PROVIDER_TYPE", "solution_partner");
env.set("META_WHATSAPP_CREDIT_LINE_ID", CREDIT_LINE_ID);
env.set("META_SYSTEM_USER_ACCESS_TOKEN", "solution-system-user-token");
result = await call({ action: "start", provider: "whatsapp_cloud", workspaceId: WORKSPACE_ID });
assert.equal(result.status, 200);
assert.equal(result.body.providerType, "solution_partner");
const spState = result.body.state;
const callsBeforeBadCurrency = graphCalls.length;
result = await call({
  action: "whatsapp_finish", workspaceId: WORKSPACE_ID, state: spState,
  code: "whatsapp-code-123456", pin: "654321", currency: "EGP", providerType: "solution_partner",
  sessionInfo: { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { waba_id: WABA_ID, phone_number_id: PHONE_ID } }
});
assert.equal(result.status, 400);
assert.equal(result.body.error, "solution_partner_currency_required");
assert.equal(graphCalls.length, callsBeforeBadCurrency, "invalid currency must be rejected before Meta calls");
const callsBeforeSolutionSuccess = graphCalls.length;
result = await call({
  action: "whatsapp_finish", workspaceId: WORKSPACE_ID, state: spState,
  code: "whatsapp-code-123456", pin: "654321", currency: "USD", providerType: "solution_partner",
  sessionInfo: { type: "WA_EMBEDDED_SIGNUP", event: "FINISH", data: { waba_id: WABA_ID, phone_number_id: PHONE_ID } }
});
assert.equal(result.status, 200, JSON.stringify(result.body));
const solutionCalls = graphCalls.slice(callsBeforeSolutionSuccess);
const shareIndex = solutionCalls.findIndex((call) => call.path.endsWith(`/${CREDIT_LINE_ID}/whatsapp_credit_sharing_and_attach`));
const registerIndex = solutionCalls.findIndex((call) => call.path.endsWith(`/${PHONE_ID}/register`));
assert.ok(shareIndex >= 0 && registerIndex > shareIndex, "credit line sharing precedes phone registration");
assert.equal(connections.find((row) => row.provider === "whatsapp_cloud").connection_metadata.provider_type, "solution_partner");
assert.equal(connections.find((row) => row.provider === "whatsapp_cloud").connection_metadata.allocation_config_id, ALLOCATION_ID);

// Instagram linked-Page flow: code exchange, encrypted short-lived staging
// token, explicit Page selection, Page subscription and encrypted Page token.
env.set("META_WHATSAPP_PROVIDER_TYPE", "tech_provider");
result = await call({ action: "start", provider: "instagram_messenger", workspaceId: WORKSPACE_ID });
assert.equal(result.status, 200);
const igState = result.body.state;
result = await call({ action: "instagram_prepare", workspaceId: WORKSPACE_ID, state: igState, code: "instagram-code-123456" });
assert.equal(result.status, 200, JSON.stringify(result.body));
assert.deepEqual(result.body.pages.map((page) => page.id), [PAGE_ID]);
assert.ok(!JSON.stringify(result.body).includes("access_token"));
const staged = oauthStates.find((row) => row.provider === "instagram_messenger");
assert.ok(staged.access_token_ciphertext && staged.access_token_iv);
assert.notEqual(staged.access_token_ciphertext, "ig-long-lived-user-token");
assert.equal(await decrypt(staged.access_token_ciphertext, staged.access_token_iv), "ig-long-lived-user-token");
result = await call({ action: "instagram_select", workspaceId: WORKSPACE_ID, state: igState, pageId: PAGE_ID });
assert.equal(result.status, 200, JSON.stringify(result.body));
assert.equal(result.body.connection.externalAccountId, IG_ID);
assert.equal(result.body.connection.externalPageId, PAGE_ID);
assert.ok(!JSON.stringify(result.body).includes("ig-page-access-token"));
const igConnection = connections.find((row) => row.provider === "instagram_messenger");
assert.equal(igConnection.external_account_id, IG_ID);
assert.equal(igConnection.external_page_id, PAGE_ID);
const igSecret = secrets.find((row) => row.connection_id === igConnection.id);
assert.equal(await decrypt(igSecret.access_token_ciphertext, igSecret.access_token_iv), "ig-page-access-token");
assert.equal(staged.access_token_ciphertext, null, "temporary user token is cleared after Page selection");
assert.ok(graphCalls.some((call) => call.path.endsWith(`/${PAGE_ID}/subscribed_apps`)));

// Workspace ownership is enforced server-side, even with a valid user JWT.
result = await call({ action: "start", provider: "instagram_messenger", workspaceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" });
assert.equal(result.status, 403);
assert.equal(result.body.error, "workspace_not_owned");

// CORS remains exact-origin allow-listed.
result = await call({ action: "start", provider: "instagram_messenger", workspaceId: WORKSPACE_ID }, { origin: "https://evil.example" });
assert.equal(result.status, 403);
assert.equal(result.body.error, "origin_not_allowed");

console.log("meta-connect smoke tests passed (mocked Meta/Supabase requests only)");
