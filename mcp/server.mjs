import { createServer as createNodeServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  hostHeaderValidation,
  localhostHostValidation,
  localhostOriginValidation,
  toNodeHandler,
  toWebRequest
} from "@modelcontextprotocol/node";
import {
  bearerAuthChallengeResponse,
  buildOAuthProtectedResourceMetadata,
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  McpServer,
  OAuthError,
  OAuthErrorCode,
  oauthMetadataResponse,
  verifyBearerToken
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = path.resolve(HERE, "..");
const SITE_ORIGIN = "https://chatora.ansygroup.com";
const MAX_HTTP_BODY_BYTES = 1_000_000;
const CHANNELS = ["instagram", "whatsapp", "tiktok", "messenger", "telegram", "sms", "email", "web"];
const LOCALES = ["en", "ar", "es", "fr", "de", "pt"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CHANNEL_SCHEMA = z.enum(CHANNELS);
const STEP_SCHEMA = z.discriminatedUnion("t", [
  z.object({ t: z.literal("trigger"), text: z.string().trim().max(300) }),
  z.object({ t: z.literal("msg"), text: z.string().max(1000) }),
  z.object({ t: z.literal("delay"), v: z.number().int().min(1).max(1440) }),
  z.object({ t: z.literal("cond"), text: z.string().max(500) }),
  z.object({ t: z.literal("tag"), text: z.string().trim().max(100) })
]);

class SafeToolError extends Error {
  constructor(message, code = "operation_failed") {
    super(message);
    this.name = "SafeToolError";
    this.code = code;
  }
}

function textResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function errorResult(error) {
  const message = error instanceof SafeToolError
    ? error.message
    : "The operation failed. No credential or provider response was exposed; verify the record before retrying a write.";
  return { content: [{ type: "text", text: message }], isError: true };
}

function safeTool(fn) {
  return async (args) => {
    try {
      return textResult(await fn(args || {}));
    } catch (error) {
      if (!(error instanceof SafeToolError)) {
        // Deliberately log only the error class: never log tokens, query strings,
        // customer text, or upstream response bodies.
        console.error(`[chatora-mcp] tool failure (${error?.name || "Error"})`);
      }
      return errorResult(error);
    }
  };
}

function parseJwtPayload(token) {
  try {
    const segment = String(token).split(".")[1];
    if (!segment) return null;
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export function getSupabaseConfig(options = {}) {
  const supabaseUrl = String(options.supabaseUrl ?? process.env.SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const anonKey = String(options.supabaseAnonKey ?? process.env.SUPABASE_ANON_KEY ?? "").trim();
  if (!supabaseUrl || !anonKey) {
    throw new SafeToolError("Authenticated tools need SUPABASE_URL and SUPABASE_ANON_KEY in the local environment.", "config_missing");
  }

  let parsed;
  try {
    parsed = new URL(supabaseUrl);
  } catch {
    throw new SafeToolError("SUPABASE_URL is not a valid URL.", "config_invalid");
  }
  if (parsed.username || parsed.password) {
    throw new SafeToolError("SUPABASE_URL must not contain embedded credentials.", "config_invalid");
  }
  const localHttp = parsed.protocol === "http:" && isLoopbackHostname(parsed.hostname);
  if (parsed.protocol !== "https:" && !localHttp) {
    throw new SafeToolError("SUPABASE_URL must use HTTPS (HTTP is allowed only for loopback test servers).", "config_invalid");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new SafeToolError("SUPABASE_URL must contain only the project origin, without a path or query.", "config_invalid");
  }

  const keyClaims = parseJwtPayload(anonKey);
  if (/^sb_secret_/i.test(anonKey) || ["service_role", "supabase_admin"].includes(keyClaims?.role)) {
    throw new SafeToolError("A Supabase secret/service-role key is not permitted. Use the public anon/publishable key with the user's access token.", "service_role_forbidden");
  }
  return { baseUrl: parsed.origin, anonKey };
}

function validUserId(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

export async function verifySupabaseAccessToken(token, config, fetchImpl = fetch) {
  if (typeof token !== "string" || token.length < 20 || token.length > 16_384) {
    throw new SafeToolError("The Supabase access token is missing or malformed.", "auth_invalid");
  }
  if (["service_role", "supabase_admin"].includes(parseJwtPayload(token)?.role)) {
    throw new SafeToolError("A service-role/admin credential cannot be used as a user access token.", "auth_invalid");
  }
  let response;
  try {
    response = await fetchImpl(`${config.baseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(8_000)
    });
  } catch {
    throw new SafeToolError("Could not reach Supabase to verify the access token. Try again later.", "auth_unavailable");
  }
  if (response.status === 401 || response.status === 403) {
    throw new SafeToolError("The Supabase access token is invalid or expired. Sign in again and replace it locally.", "auth_invalid");
  }
  if (!response.ok) {
    throw new SafeToolError(`Supabase token verification failed (HTTP ${response.status}).`, "auth_unavailable");
  }
  let user;
  try {
    user = await response.json();
  } catch {
    throw new SafeToolError("Supabase returned an invalid identity response.", "auth_invalid");
  }
  if (!validUserId(user?.id)) {
    throw new SafeToolError("Supabase did not return a valid authenticated user ID.", "auth_invalid");
  }
  return { id: user.id };
}

function isLoopbackHostname(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(String(hostname).replace(/^\[|\]$/g, "").toLowerCase());
}

function normalizedIssuer(value) {
  try { return new URL(value).href.replace(/\/$/, ""); } catch { return ""; }
}

function validateAuthorizationServerMetadata(metadata, config) {
  const expectedIssuer = `${config.baseUrl}/auth/v1`;
  if (!metadata || normalizedIssuer(metadata.issuer) !== normalizedIssuer(expectedIssuer)) {
    throw new SafeToolError("Supabase OAuth discovery returned an issuer that does not match SUPABASE_URL.", "oauth_metadata_invalid");
  }
  for (const field of ["authorization_endpoint", "token_endpoint"]) {
    let endpoint;
    try { endpoint = new URL(metadata[field]); } catch { endpoint = null; }
    if (!endpoint || endpoint.username || endpoint.password || endpoint.origin !== config.baseUrl || endpoint.protocol !== new URL(config.baseUrl).protocol) {
      throw new SafeToolError(`Supabase OAuth discovery is missing a valid ${field}.`, "oauth_metadata_invalid");
    }
  }
  if (!Array.isArray(metadata.code_challenge_methods_supported) || !metadata.code_challenge_methods_supported.includes("S256")) {
    throw new SafeToolError("Supabase OAuth discovery must advertise PKCE S256.", "oauth_metadata_invalid");
  }
  return metadata;
}

export async function loadSupabaseOAuthMetadata(config, fetchImpl = fetch) {
  const discoveryUrl = new URL("/.well-known/oauth-authorization-server/auth/v1", config.baseUrl);
  let response;
  try {
    response = await fetchImpl(discoveryUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000)
    });
  } catch {
    throw new SafeToolError("Could not reach Supabase OAuth discovery. Confirm OAuth 2.1 is enabled before enabling the MCP OAuth mode.", "oauth_discovery_unavailable");
  }
  if (!response.ok) {
    throw new SafeToolError(`Supabase OAuth discovery failed (HTTP ${response.status}). OAuth mode was not started.`, "oauth_discovery_unavailable");
  }
  let metadata;
  try { metadata = await response.json(); } catch {
    throw new SafeToolError("Supabase OAuth discovery returned invalid JSON. OAuth mode was not started.", "oauth_metadata_invalid");
  }
  return validateAuthorizationServerMetadata(metadata, config);
}

export async function createOAuthResourceConfig({
  resourceUrl,
  expectedAudience,
  authorizationServerMetadata,
  fetchImpl = fetch
} = {}, supabaseOptions = {}) {
  if (!resourceUrl) throw new SafeToolError("MCP_RESOURCE_URL is required when MCP_OAUTH_ENABLED=true.", "oauth_config_missing");
  let resourceServerUrl;
  try { resourceServerUrl = new URL(resourceUrl); } catch {
    throw new SafeToolError("MCP_RESOURCE_URL must be an absolute URL ending in /mcp.", "oauth_config_invalid");
  }
  if (resourceServerUrl.username || resourceServerUrl.password) {
    throw new SafeToolError("MCP_RESOURCE_URL must not contain embedded credentials.", "oauth_config_invalid");
  }
  const resourceLoopback = resourceServerUrl.protocol === "http:" && isLoopbackHostname(resourceServerUrl.hostname);
  if (resourceServerUrl.protocol !== "https:" && !resourceLoopback) {
    throw new SafeToolError("MCP_RESOURCE_URL must use HTTPS (HTTP is allowed only for loopback testing).", "oauth_config_invalid");
  }
  if (resourceServerUrl.pathname !== "/mcp" || resourceServerUrl.search || resourceServerUrl.hash) {
    throw new SafeToolError("MCP_RESOURCE_URL must identify the /mcp endpoint with no query or fragment.", "oauth_config_invalid");
  }
  const supabase = getSupabaseConfig(supabaseOptions);
  const metadata = validateAuthorizationServerMetadata(
    authorizationServerMetadata || await loadSupabaseOAuthMetadata(supabase, fetchImpl),
    supabase
  );
  let expectedResource;
  try { expectedResource = new URL(expectedAudience || resourceServerUrl.href); } catch {
    throw new SafeToolError("MCP_OAUTH_EXPECTED_AUDIENCE must be an absolute URL.", "oauth_config_invalid");
  }
  if (expectedResource.username || expectedResource.password) {
    throw new SafeToolError("MCP_OAUTH_EXPECTED_AUDIENCE must not contain embedded credentials.", "oauth_config_invalid");
  }
  if (expectedResource.protocol !== "https:" && !(expectedResource.protocol === "http:" && isLoopbackHostname(expectedResource.hostname))) {
    throw new SafeToolError("MCP_OAUTH_EXPECTED_AUDIENCE must use HTTPS except for loopback testing.", "oauth_config_invalid");
  }
  if (expectedResource.search || expectedResource.hash) {
    throw new SafeToolError("MCP_OAUTH_EXPECTED_AUDIENCE must not contain a query or fragment.", "oauth_config_invalid");
  }
  const metadataOptions = {
    oauthMetadata: metadata,
    resourceServerUrl,
    resourceName: "Chatora MCP",
    dangerouslyAllowInsecureIssuerUrl: new URL(metadata.issuer).protocol === "http:" && isLoopbackHostname(new URL(metadata.issuer).hostname)
  };
  buildOAuthProtectedResourceMetadata(metadataOptions);
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(resourceServerUrl);
  const verifier = {
    async verifyAccessToken(token) {
      let user;
      try {
        user = await verifySupabaseAccessToken(token, supabase, fetchImpl);
      } catch (error) {
        const invalid = error instanceof SafeToolError && error.code === "auth_invalid";
        throw new OAuthError(
          invalid ? OAuthErrorCode.InvalidToken : OAuthErrorCode.ServerError,
          invalid ? "The access token is invalid or expired." : "Token verification is temporarily unavailable."
        );
      }
      const claims = parseJwtPayload(token) || {};
      const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      const matchesResource = audiences.some((value) => typeof value === "string" && value.replace(/\/$/, "") === expectedResource.href.replace(/\/$/, ""));
      const scopes = typeof claims.scope === "string"
        ? claims.scope.split(/\s+/).filter(Boolean)
        : Array.isArray(claims.scope) ? claims.scope.filter((value) => typeof value === "string") : [];
      return {
        token,
        clientId: user.id,
        scopes,
        expiresAt: Number.isFinite(Number(claims.exp)) ? Number(claims.exp) : undefined,
        resource: matchesResource ? expectedResource : undefined,
        extra: typeof claims.client_id === "string" ? { oauthClientId: claims.client_id } : undefined
      };
    }
  };
  return { metadataOptions, resourceMetadataUrl, expectedResource, resourceServerUrl, verifier, authorizationServerMetadata: metadata };
}

function decodeHtmlEntities(value) {
  const named = {
    amp: "&", apos: "'", quot: '"', lt: "<", gt: ">", nbsp: " ",
    ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’",
    ldquo: "“", rdquo: "”", copy: "©", reg: "®", trade: "™", bull: "•",
    middot: "·", euro: "€", pound: "£", yen: "¥", nbsp: " "
  };
  return String(value).replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(number) || number < 0 || number > 0x10ffff) return match;
      try { return String.fromCodePoint(number); } catch { return match; }
    }
    return Object.prototype.hasOwnProperty.call(named, entity.toLowerCase()) ? named[entity.toLowerCase()] : match;
  });
}

function tagText(html, tagName) {
  const match = String(html).match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}\\s*>`, "i"));
  return match ? match[1] : "";
}

function attributeValue(tag, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(tag).match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match ? decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? "") : "";
}

function stripMarkup(html) {
  return decodeHtmlEntities(String(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(br|hr)\b[^>]*>/gi, "\n")
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|blockquote|main)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " "))
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function localeForPath(relPath) {
  const first = relPath.split("/")[0];
  return LOCALES.includes(first) ? first : "en";
}

function publicUrlPath(relPath) {
  if (relPath === "index.html") return "/";
  const localeIndex = relPath.match(/^(ar|es|fr|de|pt)\/index\.html$/);
  if (localeIndex) return `/${localeIndex[1]}/`;
  return `/${relPath}`;
}

function sitemapPathToFile(rawLoc) {
  let url;
  try { url = new URL(rawLoc); } catch { return null; }
  if (url.origin !== SITE_ORIGIN) return null;
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return null; }
  if (pathname.includes("\\") || pathname.split("/").some((segment) => segment === "..")) return null;
  let relPath = pathname.replace(/^\/+/, "");
  if (!relPath || relPath.endsWith("/")) relPath += "index.html";
  if (!relPath.endsWith(".html")) return null;
  return relPath;
}

let publicPathsPromise;
async function publicPaths() {
  if (!publicPathsPromise) {
    publicPathsPromise = (async () => {
      let sitemap;
      try {
        sitemap = await readFile(path.join(SITE_ROOT, "sitemap.xml"), "utf8");
      } catch {
        throw new SafeToolError("The local public-site index is unavailable. Rebuild the Chatora site first.", "site_index_missing");
      }
      const allowed = new Set();
      for (const match of sitemap.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)) {
        const loc = decodeHtmlEntities(match[1].trim());
        const relPath = sitemapPathToFile(loc);
        if (relPath) allowed.add(relPath);
      }
      if (allowed.size === 0) throw new SafeToolError("The local sitemap contains no usable public pages.", "site_index_invalid");
      return allowed;
    })();
  }
  return publicPathsPromise;
}

function normalizeRequestedPage(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 240 || raw.includes("?") || raw.includes("#") || raw.includes("\\")) {
    throw new SafeToolError("Provide a sitemap page path such as /pricing.html. Query strings and fragments are not accepted.", "invalid_public_path");
  }
  let pathname;
  try {
    pathname = decodeURIComponent(raw.startsWith("/") ? raw : `/${raw}`);
  } catch {
    throw new SafeToolError("The public page path is malformed.", "invalid_public_path");
  }
  if (pathname.split("/").some((segment) => segment === "..")) {
    throw new SafeToolError("The public page path is outside the sitemap.", "invalid_public_path");
  }
  let relPath = pathname.replace(/^\/+/, "");
  if (!relPath || relPath.endsWith("/")) relPath += "index.html";
  if (!relPath.endsWith(".html")) throw new SafeToolError("Only public HTML pages in the sitemap can be read.", "invalid_public_path");
  return relPath;
}

const pageCache = new Map();
async function readPublicPage(relPath) {
  const allowed = await publicPaths();
  if (!allowed.has(relPath)) {
    throw new SafeToolError("That path is not an indexable public page. Use search_public_site to find a sitemap page.", "public_page_not_found");
  }
  if (pageCache.has(relPath)) return pageCache.get(relPath);
  const absolutePath = path.resolve(SITE_ROOT, relPath);
  if (!absolutePath.startsWith(`${SITE_ROOT}${path.sep}`)) {
    throw new SafeToolError("The requested page is outside the public site.", "invalid_public_path");
  }
  let html;
  try {
    html = await readFile(absolutePath, "utf8");
  } catch {
    throw new SafeToolError("The sitemap page file is missing from the local build.", "public_page_missing");
  }
  const title = stripMarkup(tagText(html, "title")) || relPath;
  const descriptionTag = html.match(/<meta\b[^>]*name\s*=\s*(["'])description\1[^>]*>/i)?.[0] || "";
  const description = attributeValue(descriptionTag, "content");
  const main = tagText(html, "main");
  const body = main || tagText(html, "body") || html;
  const text = stripMarkup(body);
  const page = { path: publicUrlPath(relPath), locale: localeForPath(relPath), title, description, text };
  pageCache.set(relPath, page);
  return page;
}

async function readAllPublicPages(locale) {
  const paths = await publicPaths();
  const selected = [...paths].filter((relPath) => locale === "all" || localeForPath(relPath) === locale).sort();
  const pages = await Promise.all(selected.map(async (relPath) => {
    try { return await readPublicPage(relPath); } catch { return null; }
  }));
  return pages.filter(Boolean);
}

function assertEditableFlowNodes(value) {
  const nodes = Array.isArray(value) ? value : [];
  const allowedTypes = new Set(["trigger", "msg", "delay", "cond", "tag"]);
  const allowedKeys = new Set(["t", "text", "v"]);
  if (nodes.length > 25) {
    throw new SafeToolError("This draft has more than 25 steps. Use the Chatora editor; MCP will not return an incomplete copy that could overwrite steps.", "flow_too_large");
  }
  for (const node of nodes) {
    if (!node || typeof node !== "object" || Array.isArray(node) || !allowedTypes.has(node.t)) {
      throw new SafeToolError("This flow contains a step format MCP does not edit. Use the Chatora editor so no step data is lost.", "flow_step_unsupported");
    }
    if (Object.keys(node).some((key) => !allowedKeys.has(key))) {
      throw new SafeToolError("This flow contains extra step fields MCP does not edit. Use the Chatora editor so no step data is lost.", "flow_step_unsupported");
    }
  }
  return nodes;
}

function safeFlow(row, nodeLimit = 10, textLimit = 500) {
  const sourceNodes = Array.isArray(row?.nodes) ? row.nodes : [];
  const nodes = sourceNodes.slice(0, nodeLimit).map((node) => {
    if (!node || typeof node !== "object") return null;
    const item = { t: String(node.t || "").slice(0, 32) };
    if (typeof node.text === "string") item.text = node.text.slice(0, textLimit);
    if (Number.isFinite(node.v)) item.v = node.v;
    return item;
  }).filter(Boolean);
  return {
    id: row.id,
    name: String(row.name || "").slice(0, 120),
    channel: row.channel,
    status: row.status,
    runs: Number(row.runs || 0),
    nodes,
    nodes_truncated: sourceNodes.length > nodes.length,
    updated_at: row.updated_at ?? null
  };
}

function safeContact(row) {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle ?? null,
    channel: row.channel,
    tags: Array.isArray(row.tags) ? row.tags.slice(0, 6) : [],
    last_seen: row.last_seen ?? null
  };
}

function safeConversation(row) {
  return {
    id: row.id,
    contact_id: row.contact_id,
    channel: row.channel,
    status: row.status,
    unread: Number(row.unread || 0),
    last_at: row.last_at ?? null
  };
}

function createPostgrestClient(config, token, fetchImpl = fetch) {
  async function request(table, { method = "GET", params = {}, body, headers: extraHeaders = {} } = {}) {
    const url = new URL(`/rest/v1/${encodeURIComponent(table)}`, config.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }
    const headers = {
      apikey: config.anonKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...extraHeaders
    };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(10_000)
      });
    } catch {
      throw new SafeToolError("Could not reach Supabase. Check the local connection and retry.", "database_unavailable");
    }
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403 ? "database_forbidden" : "database_error";
      const hint = response.status === 401 || response.status === 403
        ? "Supabase denied the request. Confirm the user's workspace ownership and RLS policies."
        : `Supabase rejected the request (HTTP ${response.status}). Confirm the table and migration state.`;
      throw new SafeToolError(hint, code);
    }
    if (method === "HEAD" || response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch {
      throw new SafeToolError("Supabase returned an unexpected response format.", "database_response_invalid");
    }
  }

  async function count(table, workspaceId) {
    const url = new URL(`/rest/v1/${encodeURIComponent(table)}`, config.baseUrl);
    url.searchParams.set("select", "id");
    url.searchParams.set("workspace_id", `eq.${workspaceId}`);
    let response;
    try {
      response = await fetchImpl(url, {
        method: "HEAD",
        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${token}`,
          Prefer: "count=exact",
          Range: "0-0"
        },
        signal: AbortSignal.timeout(10_000)
      });
    } catch {
      throw new SafeToolError("Could not reach Supabase while counting workspace records.", "database_unavailable");
    }
    if (!response.ok) {
      throw new SafeToolError(`Supabase could not count ${table} (HTTP ${response.status}). Confirm the table and RLS policies.`, "database_error");
    }
    const range = response.headers.get("content-range") || "";
    const match = range.match(/\/(\d+|\*)$/);
    return match && match[1] !== "*" ? Number(match[1]) : null;
  }

  return { request, count };
}

async function resolveIdentity({ token, verifiedUserId, options }) {
  if (!token) {
    throw new SafeToolError("This tool needs a signed-in Supabase user. Set CHATORA_ACCESS_TOKEN for STDIO or send an Authorization: Bearer token to the local HTTP endpoint.", "auth_required");
  }
  if (verifiedUserId && validUserId(verifiedUserId)) return { id: verifiedUserId };
  const config = getSupabaseConfig(options);
  return verifySupabaseAccessToken(token, config);
}

async function ownedWorkspaces(client, userId) {
  const rows = await client.request("workspaces", {
    params: { select: "id,name,plan,owner", owner: `eq.${userId}`, limit: "100" }
  });
  const filtered = (Array.isArray(rows) ? rows : []).filter((row) => row?.owner === userId && validUserId(row?.id));
  if (filtered.length > 20) throw new SafeToolError("This MCP server supports up to 20 workspaces per account; narrow the account before continuing.", "workspace_limit");
  return filtered;
}

async function resolveWorkspace(client, userId, workspaceId) {
  const workspaces = await ownedWorkspaces(client, userId);
  if (workspaceId) {
    if (!validUserId(workspaceId)) throw new SafeToolError("workspace_id must be a UUID returned by get_workspace_summary.", "invalid_workspace");
    const match = workspaces.find((workspace) => workspace.id === workspaceId);
    if (!match) throw new SafeToolError("The requested workspace is not owned by the signed-in user.", "workspace_forbidden");
    return match;
  }
  if (workspaces.length === 0) throw new SafeToolError("No workspace owned by this signed-in user was found. Sign in with the account that owns the workspace.", "workspace_missing");
  if (workspaces.length > 1) throw new SafeToolError("More than one workspace is owned by this account. Pass workspace_id from get_workspace_summary.", "workspace_ambiguous");
  return workspaces[0];
}

async function getAuthenticatedContext(args, session, options) {
  const identity = await resolveIdentity(session, options);
  const config = getSupabaseConfig(options);
  const client = createPostgrestClient(config, session.token);
  const workspace = await resolveWorkspace(client, identity.id, args.workspace_id);
  return { identity, client, workspace };
}

function registerPublicTools(server) {
  server.registerTool(
    "search_public_site",
    {
      description: "Search Chatora's locally built, indexable public pages. Search is limited to sitemap content; login, dashboard, and private workspace data are not included.",
      inputSchema: z.object({
        query: z.string().trim().min(1).max(120),
        locale: z.enum(["en", "ar", "es", "fr", "de", "pt", "all"]).default("en"),
        limit: z.number().int().min(1).max(15).default(8)
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    safeTool(async ({ query, locale, limit }) => {
      const pages = await readAllPublicPages(locale);
      const terms = query.toLocaleLowerCase(locale === "all" ? "en" : locale).split(/\s+/).filter(Boolean);
      const matches = [];
      for (const page of pages) {
        const titleText = page.title.toLocaleLowerCase(locale === "all" ? page.locale : locale);
        const descriptionText = page.description.toLocaleLowerCase(locale === "all" ? page.locale : locale);
        const bodyText = page.text.toLocaleLowerCase(locale === "all" ? page.locale : locale);
        let score = 0;
        let firstPosition = -1;
        for (const term of terms) {
          const titleCount = titleText.split(term).length - 1;
          const descCount = descriptionText.split(term).length - 1;
          const bodyCount = bodyText.split(term).length - 1;
          if (titleCount + descCount + bodyCount > 0) {
            score += titleCount * 5 + descCount * 3 + Math.min(bodyCount, 5);
            if (firstPosition < 0) firstPosition = bodyText.indexOf(term);
          }
        }
        if (!score) continue;
        const source = page.text || page.description;
        const pivot = firstPosition >= 0 ? firstPosition : 0;
        const start = Math.max(0, pivot - 100);
        const snippet = `${start > 0 ? "…" : ""}${source.slice(start, start + 260).trim()}${start + 260 < source.length ? "…" : ""}`;
        matches.push({ score, path: page.path, locale: page.locale, title: page.title, description: page.description, snippet });
      }
      matches.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
      return { query, locale, results: matches.slice(0, limit).map(({ score, ...item }) => item), total_matches: matches.length };
    })
  );

  server.registerTool(
    "get_public_page",
    {
      description: "Read text from one indexable public Chatora page listed in sitemap.xml. The path must be a public page such as /pricing.html or /ar/pricing.html; private app and login pages are excluded.",
      inputSchema: z.object({
        path: z.string().trim().min(1).max(240),
        max_chars: z.number().int().min(500).max(10_000).default(6_000)
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    safeTool(async ({ path: requestedPath, max_chars: maxChars }) => {
      const relPath = normalizeRequestedPage(requestedPath);
      const page = await readPublicPage(relPath);
      const content = page.text.slice(0, maxChars);
      return {
        path: page.path,
        locale: page.locale,
        title: page.title,
        description: page.description,
        content,
        truncated: page.text.length > content.length
      };
    })
  );
}

export function createChatoraServer({ accessToken = null, verifiedUserId = null, supabaseUrl, supabaseAnonKey } = {}) {
  const options = { supabaseUrl, supabaseAnonKey };
  const session = { token: accessToken, verifiedUserId };
  const server = new McpServer({ name: "chatora", version: "0.1.0" });
  registerPublicTools(server);

  const workspaceRead = async (args) => {
    const identity = await resolveIdentity(session, options);
    const client = createPostgrestClient(getSupabaseConfig(options), session.token);
    const workspaces = await ownedWorkspaces(client, identity.id);
    const selected = args.workspace_id
      ? workspaces.filter((workspace) => workspace.id === args.workspace_id)
      : workspaces;
    if (args.workspace_id && selected.length === 0) {
      throw new SafeToolError("The requested workspace is not owned by the signed-in user.", "workspace_forbidden");
    }
    const result = await Promise.all(selected.map(async (workspace) => {
      const [contacts, flows, conversations] = await Promise.all([
        client.count("contacts", workspace.id),
        client.count("flows", workspace.id),
        client.count("conversations", workspace.id)
      ]);
      return {
        workspace_id: workspace.id,
        name: workspace.name,
        plan: workspace.plan ?? null,
        counts: { contacts, flows, conversations }
      };
    }));
    return { workspaces: result };
  };

  server.registerTool(
    "get_workspace_summary",
    {
      description: "Return the signed-in user's own workspace names and current record counts. Workspace ownership is checked against Supabase; records are queried by that owned workspace ID.",
      inputSchema: z.object({ workspace_id: z.string().uuid().optional() }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    safeTool(workspaceRead)
  );

  server.registerTool(
    "list_contacts",
    {
      description: "List contacts from the signed-in user's owned workspace. Returns only ID, name, handle, channel, tags, and last-seen timestamp; no credentials or message content.",
      inputSchema: z.object({
        workspace_id: z.string().uuid().optional(),
        search: z.string().trim().max(100).optional(),
        channel: CHANNEL_SCHEMA.optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).max(50_000).default(0)
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    safeTool(async (args) => {
      const { client, workspace } = await getAuthenticatedContext(args, session, options);
      const params = {
        select: "id,name,handle,channel,tags,last_seen",
        workspace_id: `eq.${workspace.id}`,
        order: "last_seen.desc,id.asc",
        limit: String(args.limit),
        offset: String(args.offset)
      };
      if (args.channel) params.channel = `eq.${args.channel}`;
      if (args.search) {
        const search = args.search.replace(/[^\p{L}\p{N}@._ -]/gu, " ").trim();
        if (search) params.or = `(name.ilike.*${search}*,handle.ilike.*${search}*)`;
      }
      const rows = await client.request("contacts", { params });
      const contacts = (Array.isArray(rows) ? rows : []).map(safeContact);
      return { workspace_id: workspace.id, count: contacts.length, offset: args.offset, limit: args.limit, has_more: contacts.length === args.limit, contacts };
    })
  );

  server.registerTool(
    "list_flows",
    {
      description: "List flows from the signed-in user's owned workspace. Flow lists include up to 10 steps per item; use get_flow_draft to read all steps of a draft before editing. MCP cannot activate, run, or send flows.",
      inputSchema: z.object({
        workspace_id: z.string().uuid().optional(),
        status: z.enum(["draft", "live", "paused"]).optional(),
        limit: z.number().int().min(1).max(50).default(50),
        offset: z.number().int().min(0).max(50_000).default(0)
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    safeTool(async (args) => {
      const { client, workspace } = await getAuthenticatedContext(args, session, options);
      const params = {
        select: "id,name,channel,status,runs,nodes,updated_at",
        workspace_id: `eq.${workspace.id}`,
        order: "updated_at.desc",
        limit: String(args.limit),
        offset: String(args.offset)
      };
      if (args.status) params.status = `eq.${args.status}`;
      const rows = await client.request("flows", { params });
      const flows = (Array.isArray(rows) ? rows : []).map(safeFlow);
      return { workspace_id: workspace.id, count: flows.length, offset: args.offset, limit: args.limit, has_more: flows.length === args.limit, flows };
    })
  );

  server.registerTool(
    "get_flow_draft",
    {
      description: "Read all steps from one draft flow in the signed-in user's owned workspace. This is the safe source to review before update_flow_draft; it refuses non-drafts and drafts with more than 25 steps rather than returning an incomplete editable copy.",
      inputSchema: z.object({
        workspace_id: z.string().uuid().optional(),
        flow_id: z.string().uuid()
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    safeTool(async (args) => {
      const { client, workspace } = await getAuthenticatedContext(args, session, options);
      const rows = await client.request("flows", {
        params: {
          select: "id,name,channel,status,runs,nodes,updated_at",
          id: `eq.${args.flow_id}`,
          workspace_id: `eq.${workspace.id}`,
          limit: "1"
        }
      });
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw new SafeToolError("That flow is not in the selected owned workspace.", "flow_forbidden");
      }
      if (rows[0].status !== "draft") {
        throw new SafeToolError("Only draft flows can be read with this tool. Live and paused flows are left untouched.", "flow_not_draft");
      }
      assertEditableFlowNodes(rows[0].nodes);
      return { workspace_id: workspace.id, flow: safeFlow(rows[0], 25, 1_000) };
    })
  );

  server.registerTool(
    "list_conversations",
    {
      description: "List conversation metadata from the signed-in user's owned workspace. Message bodies are not returned; use get_conversation_messages when the authenticated user explicitly needs a thread.",
      inputSchema: z.object({
        workspace_id: z.string().uuid().optional(),
        status: z.enum(["open", "closed"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).max(50_000).default(0)
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    safeTool(async (args) => {
      const { client, workspace } = await getAuthenticatedContext(args, session, options);
      const params = {
        select: "id,contact_id,channel,status,unread,last_at",
        workspace_id: `eq.${workspace.id}`,
        order: "last_at.desc",
        limit: String(args.limit),
        offset: String(args.offset)
      };
      if (args.status) params.status = `eq.${args.status}`;
      const rows = await client.request("conversations", { params });
      const conversations = (Array.isArray(rows) ? rows : []).map(safeConversation);
      return { workspace_id: workspace.id, count: conversations.length, offset: args.offset, limit: args.limit, has_more: conversations.length === args.limit, conversations };
    })
  );

  server.registerTool(
    "get_conversation_messages",
    {
      description: "Read up to 25 private message bodies from one conversation that belongs to the signed-in user's workspace. This can expose customer content; call only when relevant to the user's request. No message is sent or changed.",
      inputSchema: z.object({
        workspace_id: z.string().uuid().optional(),
        conversation_id: z.string().uuid(),
        limit: z.number().int().min(1).max(25).default(10)
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    safeTool(async (args) => {
      const { client, workspace } = await getAuthenticatedContext(args, session, options);
      const conversations = await client.request("conversations", {
        params: {
          select: "id,workspace_id",
          id: `eq.${args.conversation_id}`,
          workspace_id: `eq.${workspace.id}`,
          limit: "1"
        }
      });
      if (!Array.isArray(conversations) || conversations.length !== 1) {
        throw new SafeToolError("That conversation is not in the selected owned workspace.", "conversation_forbidden");
      }
      const rows = await client.request("messages", {
        params: {
          select: "id,direction,author,body,created_at",
          conversation_id: `eq.${args.conversation_id}`,
          order: "created_at.asc",
          limit: String(args.limit)
        }
      });
      const messages = (Array.isArray(rows) ? rows : []).map((row) => ({
        id: row.id,
        direction: row.direction,
        author: row.author,
        body: String(row.body ?? "").slice(0, 2_000),
        body_truncated: String(row.body ?? "").length > 2_000,
        created_at: row.created_at ?? null
      }));
      return { workspace_id: workspace.id, conversation_id: args.conversation_id, count: messages.length, messages };
    })
  );

  server.registerTool(
    "rename_workspace",
    {
      description: "Rename one workspace owned by the signed-in user. This updates only the workspace name and never changes ownership or billing.",
      inputSchema: z.object({ workspace_id: z.string().uuid().optional(), name: z.string().trim().min(1).max(100) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    safeTool(async (args) => {
      const { client, workspace, identity } = await getAuthenticatedContext(args, session, options);
      const rows = await client.request("workspaces", {
        method: "PATCH",
        params: { id: `eq.${workspace.id}`, owner: `eq.${identity.id}`, select: "id,name,plan,owner" },
        body: { name: args.name },
        headers: { Prefer: "return=representation" }
      });
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0].owner !== identity.id) {
        throw new SafeToolError("Supabase did not confirm the workspace rename. Check workspace ownership and RLS before retrying.", "workspace_update_unconfirmed");
      }
      return { workspace_id: rows[0].id, name: rows[0].name, plan: rows[0].plan ?? null };
    })
  );

  server.registerTool(
    "create_contact",
    {
      description: "Create a contact in the signed-in user's owned workspace. This stores user-provided contact data but does not start a conversation or send a message.",
      inputSchema: z.object({
        workspace_id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        handle: z.string().trim().max(200).nullable().optional(),
        channel: CHANNEL_SCHEMA,
        tags: z.array(z.string().trim().min(1).max(40)).max(6).default([])
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    safeTool(async (args) => {
      const { client, workspace } = await getAuthenticatedContext(args, session, options);
      const rows = await client.request("contacts", {
        method: "POST",
        params: { select: "id,name,handle,channel,tags,last_seen" },
        body: {
          workspace_id: workspace.id,
          name: args.name,
          handle: args.handle || null,
          channel: args.channel,
          tags: args.tags,
          last_seen: new Date().toISOString()
        },
        headers: { Prefer: "return=representation" }
      });
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw new SafeToolError("Supabase did not confirm contact creation. Check the workspace before retrying to avoid duplicates.", "contact_create_unconfirmed");
      }
      return { workspace_id: workspace.id, contact: safeContact(rows[0]) };
    })
  );

  server.registerTool(
    "create_flow_draft",
    {
      description: "Create an editable flow in draft status only. Draft messages are placeholders; this tool cannot activate, run, connect a channel, or send anything.",
      inputSchema: z.object({
        workspace_id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(120),
        channel: CHANNEL_SCHEMA,
        steps: z.array(STEP_SCHEMA).max(25).optional()
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
    },
    safeTool(async (args) => {
      const { client, workspace } = await getAuthenticatedContext(args, session, options);
      const nodes = args.steps ?? [
        { t: "trigger", text: "Draft trigger — configure before use." },
        { t: "msg", text: "Draft message — edit before any use. Nothing is sent by MCP." }
      ];
      const rows = await client.request("flows", {
        method: "POST",
        params: { select: "id,name,channel,status,runs,nodes,updated_at" },
        body: { workspace_id: workspace.id, name: args.name, channel: args.channel, status: "draft", runs: 0, nodes },
        headers: { Prefer: "return=representation" }
      });
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0].status !== "draft") {
        throw new SafeToolError("Supabase did not confirm a draft-only flow. Check the workspace before retrying.", "flow_create_unconfirmed");
      }
      return { workspace_id: workspace.id, flow: safeFlow(rows[0], 25, 1_000) };
    })
  );

  server.registerTool(
    "update_flow_draft",
    {
      description: "Edit the name and/or steps of an existing draft flow in the signed-in user's owned workspace. It refuses live or paused flows and cannot change flow status or run the flow.",
      inputSchema: z.object({
        workspace_id: z.string().uuid().optional(),
        flow_id: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        steps: z.array(STEP_SCHEMA).max(25).optional()
      }).refine((value) => value.name !== undefined || value.steps !== undefined, { message: "Provide name or steps to update." }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    safeTool(async (args) => {
      const { client, workspace } = await getAuthenticatedContext(args, session, options);
      const current = await client.request("flows", {
        params: {
          select: args.steps !== undefined ? "id,status,nodes" : "id,status",
          id: `eq.${args.flow_id}`,
          workspace_id: `eq.${workspace.id}`,
          limit: "1"
        }
      });
      if (!Array.isArray(current) || current.length !== 1) {
        throw new SafeToolError("That flow is not in the selected owned workspace.", "flow_forbidden");
      }
      if (current[0].status !== "draft") {
        throw new SafeToolError("Only draft flows can be edited through MCP. Live and paused flows are left untouched.", "flow_not_draft");
      }
      if (args.steps !== undefined) assertEditableFlowNodes(current[0].nodes);
      const patch = {};
      if (args.name !== undefined) patch.name = args.name;
      if (args.steps !== undefined) patch.nodes = args.steps;
      patch.updated_at = new Date().toISOString();
      const rows = await client.request("flows", {
        method: "PATCH",
        params: {
          id: `eq.${args.flow_id}`,
          workspace_id: `eq.${workspace.id}`,
          status: "eq.draft",
          select: "id,name,channel,status,runs,nodes,updated_at"
        },
        body: patch,
        headers: { Prefer: "return=representation" }
      });
      if (!Array.isArray(rows) || rows.length !== 1 || rows[0].status !== "draft") {
        throw new SafeToolError("Supabase did not confirm the draft edit. Re-read the flow before retrying.", "flow_update_unconfirmed");
      }
      return { workspace_id: workspace.id, flow: safeFlow(rows[0], 25, 1_000) };
    })
  );

  server.registerTool(
    "set_conversation_status",
    {
      description: "Mark one conversation open or closed in the signed-in user's owned workspace. This does not send a message, delete records, or alter customer content.",
      inputSchema: z.object({
        workspace_id: z.string().uuid().optional(),
        conversation_id: z.string().uuid(),
        status: z.enum(["open", "closed"])
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    safeTool(async (args) => {
      const { client, workspace } = await getAuthenticatedContext(args, session, options);
      const rows = await client.request("conversations", {
        method: "PATCH",
        params: {
          id: `eq.${args.conversation_id}`,
          workspace_id: `eq.${workspace.id}`,
          select: "id,contact_id,channel,status,unread,last_at"
        },
        body: { status: args.status },
        headers: { Prefer: "return=representation" }
      });
      if (!Array.isArray(rows) || rows.length !== 1) {
        throw new SafeToolError("Supabase did not confirm the conversation status change. Check that the conversation belongs to this workspace.", "conversation_update_unconfirmed");
      }
      return { workspace_id: workspace.id, conversation: safeConversation(rows[0]) };
    })
  );

  return server;
}

function bearerToken(request) {
  const header = request.headers.authorization;
  if (typeof header !== "string" || !header.trim()) return null;
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  return match ? match[1] : "";
}

function writeJson(res, status, body, headers = {}) {
  const text = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(text);
}

async function sendWebResponse(res, response) {
  const body = Buffer.from(await response.arrayBuffer());
  const headers = Object.fromEntries(response.headers.entries());
  res.writeHead(response.status, headers);
  res.end(body);
}

function listFromConfig(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizeOriginAllowlist(values) {
  return [...new Set(listFromConfig(values).map((value) => {
    let url;
    try { url = new URL(value); } catch { throw new SafeToolError("MCP_ALLOWED_ORIGINS must be a comma-separated list of complete origins.", "http_allowlist_invalid"); }
    if (url.username || url.password) throw new SafeToolError("MCP_ALLOWED_ORIGINS entries must not contain embedded credentials.", "http_allowlist_invalid");
    const loopbackHttp = url.protocol === "http:" && isLoopbackHostname(url.hostname);
    if (url.protocol !== "https:" && !loopbackHttp) throw new SafeToolError("MCP_ALLOWED_ORIGINS must use HTTPS except for loopback testing.", "http_allowlist_invalid");
    if (url.pathname !== "/" || url.search || url.hash) throw new SafeToolError("MCP_ALLOWED_ORIGINS entries must be origins only, without a path or query.", "http_allowlist_invalid");
    return url.origin;
  }))];
}

function strictOriginValidation(allowedOrigins) {
  const allowed = new Set(allowedOrigins);
  return (req, res) => {
    const raw = req.headers.origin;
    if (raw === undefined) return true;
    let origin;
    try { origin = new URL(raw).origin; } catch { origin = ""; }
    if (allowed.has(origin)) return true;
    writeJson(res, 403, { error: "forbidden_origin" });
    return false;
  };
}

export async function startHttpServer({
  port = 3333,
  host = "127.0.0.1",
  allowedHosts,
  allowedOrigins,
  supabaseUrl,
  supabaseAnonKey,
  oauth
} = {}) {
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("MCP_HTTP_PORT must be an integer from 0 to 65535 (0 is reserved for tests).");
  }
  const listenHost = String(host || "127.0.0.1").trim();
  const options = { supabaseUrl, supabaseAnonKey };
  const oauthConfig = oauth ? await createOAuthResourceConfig(oauth, options) : null;
  const remoteBinding = !isLoopbackHostname(listenHost);
  const configuredHosts = listFromConfig(allowedHosts).map((value) => value.toLowerCase());
  const configuredOrigins = normalizeOriginAllowlist(allowedOrigins);
  if (remoteBinding && !oauthConfig) {
    throw new SafeToolError("A non-loopback HTTP listener requires OAuth resource-server mode; default local bearer mode cannot bind remotely.", "remote_http_requires_oauth");
  }
  if (remoteBinding && oauthConfig.resourceServerUrl.protocol !== "https:") {
    throw new SafeToolError("A non-loopback HTTP listener requires an HTTPS MCP_RESOURCE_URL, normally terminated by a trusted TLS reverse proxy.", "remote_http_requires_https");
  }
  const effectiveHosts = configuredHosts.length
    ? configuredHosts
    : remoteBinding ? [oauthConfig.resourceServerUrl.hostname] : null;
  if (remoteBinding && !effectiveHosts.includes(oauthConfig.resourceServerUrl.hostname)) {
    throw new SafeToolError("The HTTP Host allowlist must include the hostname from MCP_RESOURCE_URL.", "http_allowlist_invalid");
  }
  const handler = createMcpHandler(({ authInfo }) => createChatoraServer({
    accessToken: authInfo?.token || null,
    verifiedUserId: authInfo?.clientId || null,
    ...options
  }));
  const nodeHandler = toNodeHandler(handler);
  const validateHost = effectiveHosts ? hostHeaderValidation(effectiveHosts) : localhostHostValidation();
  const validateOrigin = remoteBinding
    ? strictOriginValidation(configuredOrigins)
    : configuredOrigins.length ? strictOriginValidation(configuredOrigins) : localhostOriginValidation();

  const httpServer = createNodeServer((req, res) => {
    if (!validateHost(req, res) || !validateOrigin(req, res)) return;
    const route = String(req.url || "").split("?", 1)[0];
    if (oauthConfig && route.startsWith("/.well-known/")) {
      if (!new Set(["GET", "OPTIONS"]).has(req.method)) return writeJson(res, 405, { error: "method_not_allowed" }, { Allow: "GET, OPTIONS" });
      void (async () => {
        try {
          const webRequest = await toWebRequest(req);
          const response = oauthMetadataResponse(webRequest, oauthConfig.metadataOptions);
          if (response) return await sendWebResponse(res, response);
          return writeJson(res, 404, { error: "not_found" });
        } catch {
          return writeJson(res, 500, { error: "oauth_metadata_unavailable" });
        }
      })();
      return;
    }
    if (route === "/health") {
      if (req.method !== "GET") return writeJson(res, 405, { error: "method_not_allowed" }, { Allow: "GET" });
      return writeJson(res, 200, { status: "ok", server: "chatora-mcp", transport: "streamable-http" });
    }
    if (route !== "/mcp") return writeJson(res, 404, { error: "not_found" });
    const contentLength = Number(req.headers["content-length"] || 0);
    if (contentLength > MAX_HTTP_BODY_BYTES) return writeJson(res, 413, { error: "request_too_large" });

    void (async () => {
      if (oauthConfig) {
        try {
          req.auth = await verifyBearerToken(req.headers.authorization, {
            verifier: oauthConfig.verifier,
            expectedResource: oauthConfig.expectedResource,
            resourceMetadataUrl: oauthConfig.resourceMetadataUrl
          });
        } catch (error) {
          const challenge = bearerAuthChallengeResponse(error, { resourceMetadataUrl: oauthConfig.resourceMetadataUrl });
          return await sendWebResponse(res, challenge);
        }
      } else {
        const token = bearerToken(req);
        if (token === "") {
          return writeJson(res, 401, { error: "invalid_token" }, { "WWW-Authenticate": "Bearer" });
        }
        if (token) {
          try {
            const config = getSupabaseConfig(options);
            const user = await verifySupabaseAccessToken(token, config);
            req.auth = {
              token,
              clientId: user.id,
              scopes: ["workspace:read", "workspace:write"]
            };
          } catch (error) {
            const invalid = error instanceof SafeToolError && error.code === "auth_invalid";
            if (invalid) return writeJson(res, 401, { error: "invalid_token" }, { "WWW-Authenticate": "Bearer" });
            return writeJson(res, 503, { error: "authentication_unavailable" });
          }
        }
      }
      nodeHandler(req, res);
    })();
  });

  await new Promise((resolve, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, listenHost, () => {
      httpServer.removeListener("error", reject);
      resolve();
    });
  });

  const address = httpServer.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  return {
    server: httpServer,
    host: listenHost,
    remote: remoteBinding,
    port: actualPort,
    url: remoteBinding && oauthConfig
      ? oauthConfig.resourceServerUrl.href
      : `http://${listenHost === "::1" || listenHost === "[::1]" ? "[::1]" : listenHost}:${actualPort}/mcp`,
    close: async () => {
      await handler.close();
      if (httpServer.listening) await new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
    }
  };
}

export async function runStdio() {
  const handle = serveStdio(() => createChatoraServer({ accessToken: process.env.CHATORA_ACCESS_TOKEN || null }));
  console.error("[chatora-mcp] STDIO ready. Workspace tools need a local CHATORA_ACCESS_TOKEN and Supabase environment values.");
  process.once("SIGINT", () => { void handle.close(); });
  process.once("SIGTERM", () => { void handle.close(); });
}

async function runHttp() {
  const port = Number(process.env.MCP_HTTP_PORT || 3333);
  const host = process.env.MCP_HTTP_HOST || "127.0.0.1";
  const oauth = process.env.MCP_OAUTH_ENABLED === "true"
    ? {
        resourceUrl: process.env.MCP_RESOURCE_URL,
        expectedAudience: process.env.MCP_OAUTH_EXPECTED_AUDIENCE || undefined
      }
    : null;
  const instance = await startHttpServer({
    port,
    host,
    allowedHosts: process.env.MCP_ALLOWED_HOSTS,
    allowedOrigins: process.env.MCP_ALLOWED_ORIGINS,
    oauth
  });
  console.error(`[chatora-mcp] Streamable HTTP listening at ${instance.url} (${instance.remote ? `bind ${instance.host}; require trusted TLS proxy/firewall` : "loopback only"}).`);
  console.error(oauth
    ? "[chatora-mcp] Supabase OAuth resource-server mode is enabled; all /mcp requests require a user token with the configured resource audience."
    : "[chatora-mcp] Workspace tools require a user's Authorization: Bearer Supabase access token.");
  const shutdown = async () => {
    try { await instance.close(); } finally { process.exit(0); }
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entryPath === import.meta.url) {
  const mode = process.argv[2] || "stdio";
  if (mode === "stdio") await runStdio();
  else if (mode === "http") await runHttp();
  else {
    console.error("Usage: node server.mjs [stdio|http]");
    process.exitCode = 2;
  }
}
