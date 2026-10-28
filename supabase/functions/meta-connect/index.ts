// Local Meta onboarding endpoint for Chatora.
// Supports WhatsApp Embedded Signup v4 (Tech Provider OR Solution Partner)
// and linked-Page Instagram Messaging (Facebook Login for Business).
// Not deployed. Requires explicit META_ONBOARDING_ENABLED=true.

const MAX_BODY_BYTES = 24 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const META_ID_RE = /^\d{5,32}$/;
const CURRENCY = new Set(["AUD", "EUR", "GBP", "IDR", "INR", "USD"]);

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function allowedOrigins() {
  return (Deno.env.get("APP_ALLOWED_ORIGINS") || "")
    .split(",").map((value) => value.trim()).filter(Boolean);
}

function corsHeaders(request) {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "Origin"
  };
}

function json(request, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }, corsHeaders(request))
  });
}

function envConfig() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) throw new HttpError(503, "server_not_configured");
  const version = Deno.env.get("META_GRAPH_API_VERSION") || "";
  if (!/^v\d+\.\d+$/.test(version)) throw new HttpError(503, "meta_graph_version_not_configured");
  return { supabaseUrl, serviceKey, anonKey, version };
}

function serviceHeaders(serviceKey, extra = {}) {
  return Object.assign({
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json"
  }, extra);
}

async function getUser(request, config) {
  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return null;
  const response = await fetch(new URL("/auth/v1/user", config.supabaseUrl), {
    headers: { apikey: config.anonKey, Authorization: authorization }
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user && UUID_RE.test(String(user.id || "")) ? user : null;
}

async function dbRequest(config, path, options = {}) {
  const url = new URL(path, config.supabaseUrl);
  const headers = serviceHeaders(config.serviceKey, options.headers || {});
  const response = await fetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body == null ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
  if (!response.ok) throw new HttpError(503, "database_request_failed");
  return data;
}

function restPath(table, filters, select) {
  const url = new URL(`/rest/v1/${table}`, "https://placeholder.invalid");
  if (select) url.searchParams.set("select", select);
  for (const [key, value] of Object.entries(filters || {})) url.searchParams.set(key, value);
  return url.pathname + url.search;
}

async function rows(config, table, filters, select) {
  const result = await dbRequest(config, restPath(table, filters, select));
  return Array.isArray(result) ? result : [];
}

async function getOwnedWorkspace(config, userId, workspaceId) {
  const owned = await rows(config, "workspaces", {
    id: `eq.${workspaceId}`, owner: `eq.${userId}`, limit: "1"
  }, "id");
  if (!owned.length) throw new HttpError(403, "workspace_not_owned");
}

function base64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function base64url(bytes) {
  return base64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function encryptionKey() {
  const encoded = Deno.env.get("CHANNEL_TOKEN_ENCRYPTION_KEY") || "";
  if (!encoded) throw new HttpError(503, "token_encryption_not_configured");
  let raw;
  try { raw = fromBase64(encoded); } catch (_) { throw new HttpError(503, "token_encryption_not_configured"); }
  if (raw.length !== 32) throw new HttpError(503, "token_encryption_not_configured");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(value) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return { ciphertext: base64(new Uint8Array(ciphertext)), iv: base64(iv) };
}

async function decrypt(ciphertext, iv) {
  const key = await encryptionKey();
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, fromBase64(ciphertext));
  return new TextDecoder().decode(clear);
}

async function requireMetaConfig(provider) {
  const appId = Deno.env.get("META_APP_ID") || "";
  const appSecret = Deno.env.get("META_APP_SECRET") || "";
  if (!appId || !appSecret || !/^\d{5,32}$/.test(appId)) throw new HttpError(503, "meta_app_not_configured");
  if (provider === "whatsapp_cloud") {
    const configId = Deno.env.get("META_WHATSAPP_CONFIG_ID") || "";
    const providerType = Deno.env.get("META_WHATSAPP_PROVIDER_TYPE") || "";
    if (!/^\d{5,32}$/.test(configId) || !["tech_provider", "solution_partner"].includes(providerType)) {
      throw new HttpError(503, "whatsapp_provider_not_configured");
    }
    if (providerType === "solution_partner" &&
        (!(Deno.env.get("META_WHATSAPP_CREDIT_LINE_ID") || "").match(META_ID_RE) ||
         !(Deno.env.get("META_SYSTEM_USER_ACCESS_TOKEN") || ""))) {
      throw new HttpError(503, "solution_partner_credentials_not_configured");
    }
    return { appId, appSecret, configId, providerType };
  }
  if (provider === "instagram_messenger") {
    const configId = Deno.env.get("META_INSTAGRAM_CONFIG_ID") || "";
    if (!/^\d{5,32}$/.test(configId)) throw new HttpError(503, "instagram_login_not_configured");
    return { appId, appSecret, configId };
  }
  throw new HttpError(400, "unsupported_provider");
}

async function pruneExpiredOAuthStates(config) {
  try {
    await dbRequest(config, restPath("meta_oauth_states", {
      expires_at: `lt.${new Date().toISOString()}`
    }), { method: "DELETE", headers: { Prefer: "return=minimal" } });
  } catch (_) {
    // Best effort. The scheduled retention task remains the authoritative cleanup.
  }
}

async function startState(config, user, workspaceId, provider) {
  await getOwnedWorkspace(config, user.id, workspaceId);
  if (Deno.env.get("META_ONBOARDING_ENABLED") !== "true") throw new HttpError(503, "meta_onboarding_disabled");
  const meta = await requireMetaConfig(provider);
  await pruneExpiredOAuthStates(config);
  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const stateHash = await sha256(state);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const body = {
    workspace_id: workspaceId,
    created_by: user.id,
    provider,
    state_sha256: stateHash,
    expires_at: expiresAt
  };
  const result = await dbRequest(config, restPath("meta_oauth_states", {}, "id"), {
    method: "POST",
    body,
    headers: { Prefer: "return=representation" }
  });
  if (!Array.isArray(result) || !result[0]?.id) throw new HttpError(503, "oauth_state_create_failed");
  return {
    state,
    appId: meta.appId,
    configId: meta.configId,
    providerType: meta.providerType || null,
    graphApiVersion: config.version
  };
}

async function findState(config, user, workspaceId, provider, rawState) {
  if (typeof rawState !== "string" || rawState.length < 32 || rawState.length > 256) throw new HttpError(400, "invalid_oauth_state");
  const stateHash = await sha256(rawState);
  const matches = await rows(config, "meta_oauth_states", {
    state_sha256: `eq.${stateHash}`,
    workspace_id: `eq.${workspaceId}`,
    created_by: `eq.${user.id}`,
    provider: `eq.${provider}`,
    consumed_at: "is.null",
    expires_at: `gt.${new Date().toISOString()}`,
    limit: "1"
  }, "id,workspace_id,created_by,provider,expires_at,consumed_at,code_exchange_started_at,code_exchanged_at,access_token_ciphertext,access_token_iv,token_expires_at");
  if (!matches.length) throw new HttpError(409, "oauth_state_expired_or_used");
  return matches[0];
}

async function patchState(config, stateId, filters, patch) {
  const allFilters = Object.assign({ id: `eq.${stateId}` }, filters || {});
  const result = await dbRequest(config, restPath("meta_oauth_states", allFilters, "id"), {
    method: "PATCH",
    body: patch,
    headers: { Prefer: "return=representation" }
  });
  if (!Array.isArray(result) || !result.length) throw new HttpError(409, "oauth_state_expired_or_used");
  return result[0];
}

async function claimWhatsAppState(config, user, workspaceId, rawState) {
  if (typeof rawState !== "string" || rawState.length < 32 || rawState.length > 256) throw new HttpError(400, "invalid_oauth_state");
  const filters = {
    state_sha256: `eq.${await sha256(rawState)}`,
    workspace_id: `eq.${workspaceId}`,
    created_by: `eq.${user.id}`,
    provider: "eq.whatsapp_cloud",
    consumed_at: "is.null",
    expires_at: `gt.${new Date().toISOString()}`
  };
  const result = await dbRequest(config, restPath("meta_oauth_states", filters, "id"), {
    method: "PATCH",
    body: { consumed_at: new Date().toISOString() },
    headers: { Prefer: "return=representation" }
  });
  if (!Array.isArray(result) || !result.length) throw new HttpError(409, "oauth_state_expired_or_used");
  return result[0];
}

async function metaCodeExchange(config, meta, code) {
  if (typeof code !== "string" || code.length < 10 || code.length > 4096) throw new HttpError(400, "invalid_authorization_code");
  const url = new URL(`/${config.version}/oauth/access_token`, "https://graph.facebook.com");
  url.searchParams.set("client_id", meta.appId);
  url.searchParams.set("client_secret", meta.appSecret);
  url.searchParams.set("code", code);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
    // Meta's Business Messaging onboarding docs show the business token as a
    // plain response body; Facebook Login can return the usual JSON envelope.
    const accessToken = typeof data?.access_token === "string" ? data.access_token
      : (response.ok && text && !text.trim().startsWith("{") ? text.trim() : "");
    if (!response.ok || !accessToken) throw new HttpError(502, "meta_code_exchange_failed");
    return { accessToken, expiresIn: Number(data?.expires_in) || null };
  } finally {
    clearTimeout(timer);
  }
}

async function graph(config, path, token, options = {}) {
  const url = new URL(`/${config.version}/${path.replace(/^\/+/, "")}`, "https://graph.facebook.com");
  Object.entries(options.query || {}).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(url, {
      method: options.method || "GET",
      headers: Object.assign({ Authorization: `Bearer ${token}` }, options.body == null ? {} : { "Content-Type": "application/json" }),
      body: options.body == null ? undefined : JSON.stringify(options.body),
      signal: controller.signal
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || data.error) throw new HttpError(502, options.failCode || "meta_api_request_failed");
    return data;
  } finally {
    clearTimeout(timer);
  }
}

function safeMetaId(value) {
  const id = String(value || "");
  return META_ID_RE.test(id) ? id : "";
}

async function ensureAccountIsAvailable(config, provider, externalAccountId, workspaceId) {
  const active = await rows(config, "channel_connections", {
    provider: `eq.${provider}`,
    external_account_id: `eq.${externalAccountId}`,
    status: "in.(pending,connected,reauth_required,error)",
    limit: "1"
  }, "id,workspace_id,status");
  if (active.length && active[0].workspace_id !== workspaceId) throw new HttpError(409, "channel_already_connected_elsewhere");
}

async function saveConnection(config, record, token, expiresAt) {
  const encrypted = await encrypt(token);
  await ensureAccountIsAvailable(config, record.provider, record.external_account_id, record.workspace_id);
  const url = restPath("channel_connections", { on_conflict: "workspace_id,provider,external_account_id" }, "id,workspace_id,provider,external_account_id,external_messaging_account_id,external_page_id,display_name,status,connection_metadata,updated_at");
  let saved;
  try {
    const rowsOut = await dbRequest(config, url, {
      method: "POST",
      body: Object.assign({}, record, { updated_at: new Date().toISOString() }),
      headers: { Prefer: "resolution=merge-duplicates,return=representation" }
    });
    saved = Array.isArray(rowsOut) ? rowsOut[0] : null;
  } catch (error) {
    if (error instanceof HttpError && error.code === "database_request_failed") throw new HttpError(409, "channel_account_conflict_or_database_error");
    throw error;
  }
  if (!saved?.id) throw new HttpError(503, "channel_connection_save_failed");
  try {
    await dbRequest(config, restPath("channel_connection_secrets", { on_conflict: "connection_id" }), {
      method: "POST",
      body: {
        connection_id: saved.id,
        access_token_ciphertext: encrypted.ciphertext,
        access_token_iv: encrypted.iv,
        token_expires_at: expiresAt || null,
        key_version: 1,
        updated_at: new Date().toISOString()
      },
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" }
    });
  } catch (_) {
    try {
      await dbRequest(config, restPath("channel_connections", { id: `eq.${saved.id}` }), {
        method: "PATCH",
        body: { status: "error", updated_at: new Date().toISOString() },
        headers: { Prefer: "return=minimal" }
      });
    } catch (_) {}
    throw new HttpError(503, "channel_token_save_failed");
  }
  return saved;
}

function requestBytes(request) {
  return request.arrayBuffer().then((buffer) => new Uint8Array(buffer));
}

async function handleWhatsAppFinish(config, user, input) {
  const workspaceId = String(input.workspaceId || "");
  if (!UUID_RE.test(workspaceId)) throw new HttpError(400, "invalid_workspace");
  if (Deno.env.get("META_ONBOARDING_ENABLED") !== "true") throw new HttpError(503, "meta_onboarding_disabled");
  const meta = await requireMetaConfig("whatsapp_cloud");
  if (input.providerType && input.providerType !== meta.providerType) throw new HttpError(409, "provider_type_changed_restart_signup");
  const code = input.code;
  if (typeof code !== "string" || code.length < 10 || code.length > 4096) throw new HttpError(400, "invalid_authorization_code");
  const pin = typeof input.pin === "string" ? input.pin : "";
  if (!/^\d{6}$/.test(pin)) throw new HttpError(400, "invalid_whatsapp_pin");
  const currency = meta.providerType === "solution_partner" ? String(input.currency || "").toUpperCase() : null;
  if (meta.providerType === "solution_partner" && !CURRENCY.has(currency)) {
    throw new HttpError(400, "solution_partner_currency_required");
  }
  const sessionInfo = input.sessionInfo;
  const eventName = String(sessionInfo?.event || "");
  const sessionData = sessionInfo?.data || {};
  if (eventName !== "FINISH") {
    if (eventName === "FINISH_ONLY_WABA") throw new HttpError(422, "whatsapp_phone_number_required");
    throw new HttpError(422, "whatsapp_signup_not_completed");
  }
  const wabaId = safeMetaId(sessionData.waba_id);
  const phoneNumberId = safeMetaId(sessionData.phone_number_id);
  const businessId = safeMetaId(sessionData.business_id) || null;
  if (!wabaId || !phoneNumberId) throw new HttpError(400, "whatsapp_session_assets_missing");
  await encryptionKey();

  // Atomically validate/claim the one-time state, then make the server-to-server
  // exchange the next external call. Meta's code expires in 30 seconds.
  await claimWhatsAppState(config, user, workspaceId, input.state);
  const exchanged = await metaCodeExchange(config, meta, code);
  const businessToken = exchanged.accessToken;

  // Re-check ownership and account conflicts after the time-sensitive exchange,
  // but before any provider-side registration or credit-line side effects.
  await getOwnedWorkspace(config, user.id, workspaceId);
  await ensureAccountIsAvailable(config, "whatsapp_cloud", phoneNumberId, workspaceId);

  const account = await graph(config, wabaId, businessToken, { failCode: "meta_waba_access_failed" });
  if (String(account.id || "") !== wabaId) throw new HttpError(422, "whatsapp_waba_mismatch");
  const numbers = await graph(config, `${wabaId}/phone_numbers`, businessToken, {
    query: { fields: "id,display_phone_number,verified_name", limit: "100" },
    failCode: "meta_phone_list_failed"
  });
  const phone = (numbers.data || []).find((item) => String(item.id || "") === phoneNumberId);
  if (!phone) throw new HttpError(422, "whatsapp_phone_not_in_waba");

  // Both provider pathways subscribe the customer WABA. Solution Partners also
  // share their line of credit before the phone number is registered.
  await graph(config, `${wabaId}/subscribed_apps`, businessToken, {
    method: "POST", failCode: "meta_waba_webhook_subscription_failed"
  });
  let allocationConfigId = null;
  if (meta.providerType === "solution_partner") {
    const creditLineId = Deno.env.get("META_WHATSAPP_CREDIT_LINE_ID");
    const systemToken = Deno.env.get("META_SYSTEM_USER_ACCESS_TOKEN");
    const shared = await graph(config, `${creditLineId}/whatsapp_credit_sharing_and_attach`, systemToken, {
      method: "POST",
      query: { waba_currency: currency, waba_id: wabaId },
      failCode: "meta_credit_line_share_failed"
    });
    if (String(shared.waba_id || "") !== wabaId || !safeMetaId(shared.allocation_config_id)) {
      throw new HttpError(502, "meta_credit_line_share_failed");
    }
    allocationConfigId = String(shared.allocation_config_id);
  }
  await graph(config, `${phoneNumberId}/register`, businessToken, {
    method: "POST",
    body: { messaging_product: "whatsapp", pin },
    failCode: "meta_phone_registration_failed"
  });

  const expiresAt = exchanged.expiresIn ? new Date(Date.now() + exchanged.expiresIn * 1000).toISOString() : null;
  const saved = await saveConnection(config, {
    workspace_id: workspaceId,
    provider: "whatsapp_cloud",
    external_account_id: phoneNumberId,
    external_messaging_account_id: wabaId,
    external_business_id: businessId,
    external_page_id: null,
    display_name: String(phone.display_phone_number || phone.verified_name || "WhatsApp Business").slice(0, 120),
    status: "connected",
    scopes: ["whatsapp_business_management", "whatsapp_business_messaging"],
    connection_metadata: {
      messaging_account_id: wabaId,
      business_id: businessId,
      phone_number_id: phoneNumberId,
      display_phone_number: String(phone.display_phone_number || "").slice(0, 64),
      verified_name: String(phone.verified_name || "").slice(0, 120),
      provider_type: meta.providerType,
      allocation_config_id: allocationConfigId
    }
  }, businessToken, expiresAt);

  return {
    ok: true,
    provider: "whatsapp_cloud",
    connection: {
      id: saved.id,
      displayName: saved.display_name,
      status: saved.status,
      externalAccountId: saved.external_account_id,
      externalMessagingAccountId: saved.external_messaging_account_id
    }
  };
}

async function listInstagramPages(config, userToken) {
  const pages = await graph(config, "me/accounts", userToken, {
    query: { fields: "id,name,tasks,instagram_business_account{id,username}", limit: "100" },
    failCode: "instagram_page_list_failed"
  });
  const eligible = (pages.data || []).filter((page) => {
    const id = safeMetaId(page.id);
    const igId = safeMetaId(page.instagram_business_account?.id);
    const tasks = Array.isArray(page.tasks) ? page.tasks : [];
    return id && igId && (tasks.includes("MODERATE") || tasks.includes("MANAGE"));
  });
  return eligible.map((page) => ({
    id: String(page.id),
    name: String(page.name || "Facebook Page").slice(0, 120),
    instagramAccountId: String(page.instagram_business_account.id),
    instagramUsername: String(page.instagram_business_account.username || "").slice(0, 80)
  }));
}

async function handleInstagramPrepare(config, user, input) {
  const workspaceId = String(input.workspaceId || "");
  if (!UUID_RE.test(workspaceId)) throw new HttpError(400, "invalid_workspace");
  await getOwnedWorkspace(config, user.id, workspaceId);
  if (Deno.env.get("META_ONBOARDING_ENABLED") !== "true") throw new HttpError(503, "meta_onboarding_disabled");
  const meta = await requireMetaConfig("instagram_messenger");
  await encryptionKey();
  const state = await findState(config, user, workspaceId, "instagram_messenger", input.state);
  const claimAt = new Date().toISOString();
  // Prevent a second token exchange for this state. The claim is written before
  // contacting Meta so simultaneous callbacks cannot race the one-time code.
  await patchState(config, state.id, {
    consumed_at: "is.null",
    code_exchange_started_at: "is.null"
  }, { code_exchange_started_at: claimAt });
  const short = await metaCodeExchange(config, meta, input.code);
  const longUrl = new URL(`/${config.version}/oauth/access_token`, "https://graph.facebook.com");
  longUrl.searchParams.set("grant_type", "fb_exchange_token");
  longUrl.searchParams.set("client_id", meta.appId);
  longUrl.searchParams.set("client_secret", meta.appSecret);
  longUrl.searchParams.set("fb_exchange_token", short.accessToken);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  let long;
  try {
    const response = await fetch(longUrl, { method: "GET", signal: controller.signal });
    long = await response.json().catch(() => null);
    if (!response.ok || !long || typeof long.access_token !== "string" || !long.access_token) {
      throw new HttpError(502, "instagram_long_lived_token_exchange_failed");
    }
  } finally { clearTimeout(timer); }
  const pages = await listInstagramPages(config, long.access_token);
  if (!pages.length) throw new HttpError(422, "instagram_no_eligible_page");
  const encrypted = await encrypt(long.access_token);
  const expiry = Number(long.expires_in) || Number(short.expiresIn) || null;
  const tokenExpiresAt = expiry ? new Date(Date.now() + expiry * 1000).toISOString() : null;
  await patchState(config, state.id, {
    consumed_at: "is.null",
    code_exchange_started_at: `eq.${claimAt}`
  }, {
    access_token_ciphertext: encrypted.ciphertext,
    access_token_iv: encrypted.iv,
    token_expires_at: tokenExpiresAt,
    code_exchanged_at: new Date().toISOString(),
    state_metadata: { page_ids: pages.map((page) => page.id) }
  });
  return { ok: true, provider: "instagram_messenger", pages };
}

async function handleInstagramSelect(config, user, input) {
  const workspaceId = String(input.workspaceId || "");
  if (!UUID_RE.test(workspaceId)) throw new HttpError(400, "invalid_workspace");
  await getOwnedWorkspace(config, user.id, workspaceId);
  if (Deno.env.get("META_ONBOARDING_ENABLED") !== "true") throw new HttpError(503, "meta_onboarding_disabled");
  const state = await findState(config, user, workspaceId, "instagram_messenger", input.state);
  if (!state.code_exchanged_at || !state.access_token_ciphertext || !state.access_token_iv) {
    throw new HttpError(409, "instagram_authorization_not_prepared");
  }
  if (state.token_expires_at && Date.parse(state.token_expires_at) <= Date.now()) throw new HttpError(409, "instagram_authorization_expired");
  const pageId = safeMetaId(input.pageId);
  if (!pageId) throw new HttpError(400, "invalid_instagram_page");
  const userToken = await decrypt(state.access_token_ciphertext, state.access_token_iv);
  const pages = await listInstagramPages(config, userToken);
  const selected = pages.find((page) => page.id === pageId);
  if (!selected) throw new HttpError(403, "instagram_page_not_authorized");

  const page = await graph(config, pageId, userToken, {
    query: { fields: "id,name,access_token,instagram_business_account{id,username}" },
    failCode: "instagram_page_token_failed"
  });
  const pageToken = typeof page.access_token === "string" ? page.access_token : "";
  const igId = safeMetaId(page.instagram_business_account?.id);
  if (String(page.id || "") !== pageId || !pageToken || igId !== selected.instagramAccountId) {
    throw new HttpError(422, "instagram_page_account_mismatch");
  }
  await ensureAccountIsAvailable(config, "instagram_messenger", igId, workspaceId);
  // Page subscription is required for the Page-linked Messenger route. The
  // app-level Instagram webhook fields still have to be enabled in Meta's app.
  await graph(config, `${pageId}/subscribed_apps`, pageToken, {
    method: "POST",
    query: { subscribed_fields: "messages,messaging_postbacks" },
    failCode: "instagram_page_webhook_subscription_failed"
  });

  const saved = await saveConnection(config, {
    workspace_id: workspaceId,
    provider: "instagram_messenger",
    external_account_id: igId,
    external_messaging_account_id: null,
    external_business_id: null,
    external_page_id: pageId,
    display_name: String(page.instagram_business_account?.username || page.name || selected.name || "Instagram").slice(0, 120),
    status: "connected",
    scopes: ["instagram_basic", "instagram_manage_messages", "pages_manage_metadata", "pages_show_list"],
    connection_metadata: {
      page_id: pageId,
      page_name: String(page.name || selected.name || "").slice(0, 120),
      instagram_account_id: igId,
      instagram_username: String(page.instagram_business_account?.username || "").slice(0, 80)
    }
  }, pageToken, null);
  await patchState(config, state.id, { consumed_at: "is.null" }, {
    consumed_at: new Date().toISOString(),
    access_token_ciphertext: null,
    access_token_iv: null,
    token_expires_at: null,
    state_metadata: {}
  });
  return {
    ok: true,
    provider: "instagram_messenger",
    connection: {
      id: saved.id,
      displayName: saved.display_name,
      status: saved.status,
      externalAccountId: saved.external_account_id,
      externalPageId: saved.external_page_id
    }
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins().includes(origin)) return json(request, 403, { error: "origin_not_allowed" });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, 405, { error: "method_not_allowed" });
  const length = Number(request.headers.get("content-length") || "0");
  if (length > MAX_BODY_BYTES) return json(request, 413, { error: "request_too_large" });

  let config;
  try { config = envConfig(); }
  catch (error) { return json(request, error.status || 503, { error: error.code || "server_not_configured" }); }

  const user = await getUser(request, config);
  if (!user) return json(request, 401, { error: "unauthorized" });

  let input;
  try {
    const raw = await requestBytes(request);
    if (!raw.length || raw.length > MAX_BODY_BYTES) return json(request, 413, { error: "request_too_large" });
    input = JSON.parse(new TextDecoder().decode(raw));
  } catch (_) {
    return json(request, 400, { error: "invalid_json" });
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) return json(request, 400, { error: "invalid_request" });

  try {
    const action = String(input.action || "");
    if (action === "start") {
      const workspaceId = String(input.workspaceId || "");
      const provider = String(input.provider || "");
      if (!UUID_RE.test(workspaceId)) throw new HttpError(400, "invalid_workspace");
      if (!["whatsapp_cloud", "instagram_messenger"].includes(provider)) throw new HttpError(400, "unsupported_provider");
      const result = await startState(config, user, workspaceId, provider);
      return json(request, 200, result);
    }
    if (action === "whatsapp_finish") return json(request, 200, await handleWhatsAppFinish(config, user, input));
    if (action === "instagram_prepare") return json(request, 200, await handleInstagramPrepare(config, user, input));
    if (action === "instagram_select") return json(request, 200, await handleInstagramSelect(config, user, input));
    throw new HttpError(400, "unsupported_action");
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const code = error instanceof HttpError ? error.code : "meta_onboarding_failed";
    return json(request, status, { error: code });
  }
});
