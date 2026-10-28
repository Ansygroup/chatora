// Chatora authenticated text-reply endpoint for WhatsApp Cloud API and
// Instagram Messenger. Local scaffold only; no live Meta configuration is enabled.
// Requires a connected channel, matching external account, recent inbound message, and encrypted token.

const MAX_BODY_BYTES = 32 * 1024;
const MAX_TEXT_BYTES = 1000;
const encoder = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    headers: Object.assign({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, corsHeaders(request))
  });
}

function fromBase64(value) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function decryptToken(ciphertextB64, ivB64, keyB64) {
  const rawKey = fromBase64(keyB64);
  if (rawKey.length !== 32) throw new Error("Token encryption key must decode to 32 bytes");
  const key = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["decrypt"]);
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(ivB64) }, key, fromBase64(ciphertextB64));
  return new TextDecoder().decode(clear);
}

function envConfig() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) throw new Error("Supabase function environment is incomplete");
  return { supabaseUrl, serviceKey, anonKey };
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
  if (!response.ok) {
    const error = new Error(`database_${response.status}`);
    error.status = response.status;
    throw error;
  }
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

async function patchMessage(config, messageId, patch) {
  const path = restPath("messages", { id: `eq.${messageId}` }, "id");
  await dbRequest(config, path, { method: "PATCH", body: patch, headers: { Prefer: "return=minimal" } });
}

async function providerSend(provider, connection, contact, text, token, version) {
  let endpoint;
  let payload;
  if (provider === "whatsapp_cloud") {
    if (!/^\d{5,32}$/.test(String(connection.external_account_id || ""))) throw new Error("invalid_whatsapp_phone_number_id");
    if (!/^\d{5,20}$/.test(String(contact.external_id || ""))) throw new Error("invalid_whatsapp_recipient");
    endpoint = `https://graph.facebook.com/${version}/${encodeURIComponent(connection.external_account_id)}/messages`;
    payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: contact.external_id,
      type: "text",
      text: { body: text }
    };
  } else {
    const pageId = String(connection.external_page_id || "");
    if (!/^\d{5,32}$/.test(pageId)) throw new Error("instagram_page_not_configured");
    if (!/^\d{5,32}$/.test(String(contact.external_id || ""))) throw new Error("invalid_instagram_recipient");
    endpoint = `https://graph.facebook.com/${version}/${encodeURIComponent(pageId)}/messages`;
    payload = { recipient: { id: contact.external_id }, message: { text } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const textBody = await response.text();
    let data = null;
    try { data = textBody ? JSON.parse(textBody) : null; } catch (_) { data = null; }
    const providerCode = Number(data?.error?.code);
    if (!response.ok) return { ok: false, providerCode: Number.isFinite(providerCode) ? providerCode : null };
    const providerMessageId = provider === "whatsapp_cloud"
      ? data?.messages?.[0]?.id
      : data?.message_id;
    return { ok: true, providerMessageId: providerMessageId == null ? "" : String(providerMessageId) };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins().includes(origin)) return json(request, 403, { error: "origin_not_allowed" });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, 405, { error: "method_not_allowed" });
  if (Deno.env.get("META_SEND_ENABLED") !== "true") return json(request, 503, { error: "sending_disabled" });
  const length = Number(request.headers.get("content-length") || "0");
  if (length > MAX_BODY_BYTES) return json(request, 413, { error: "request_too_large" });

  let config;
  try { config = envConfig(); }
  catch (_) { return json(request, 503, { error: "server_not_configured" }); }

  const user = await getUser(request, config);
  if (!user) return json(request, 401, { error: "unauthorized" });

  let input;
  try {
    const raw = new Uint8Array(await request.arrayBuffer());
    if (raw.byteLength === 0 || raw.byteLength > MAX_BODY_BYTES) return json(request, 413, { error: "request_too_large" });
    input = JSON.parse(new TextDecoder().decode(raw));
  } catch (_) {
    return json(request, 400, { error: "invalid_json" });
  }

  const workspaceId = String(input?.workspaceId || "");
  const conversationId = String(input?.conversationId || "");
  const connectionId = String(input?.connectionId || "");
  const clientMessageId = String(input?.clientMessageId || "");
  const text = typeof input?.text === "string" ? input.text.trim() : "";
  if (![workspaceId, conversationId, connectionId, clientMessageId].every((id) => UUID_RE.test(id)) || !text) {
    return json(request, 400, { error: "invalid_request" });
  }
  if (encoder.encode(text).byteLength > MAX_TEXT_BYTES) return json(request, 413, { error: "message_too_long", maxUtf8Bytes: MAX_TEXT_BYTES });

  try {
    const ownedWorkspaces = await rows(config, "workspaces", {
      id: `eq.${workspaceId}`, owner: `eq.${user.id}`, limit: "1"
    }, "id");
    if (!ownedWorkspaces.length) return json(request, 403, { error: "workspace_not_owned" });

    const conversations = await rows(config, "conversations", {
      id: `eq.${conversationId}`, workspace_id: `eq.${workspaceId}`, limit: "1"
    }, "id,workspace_id,contact_id,channel,status,last_inbound_at,external_id");
    const conversation = conversations[0];
    if (!conversation) return json(request, 404, { error: "conversation_not_found" });
    if (conversation.status === "closed") return json(request, 409, { error: "conversation_closed" });

    const provider = conversation.channel === "whatsapp" ? "whatsapp_cloud"
      : conversation.channel === "instagram" ? "instagram_messenger" : null;
    if (!provider) return json(request, 409, { error: "unsupported_channel" });

    const inboundAt = Date.parse(conversation.last_inbound_at || "");
    const now = Date.now();
    const safeWindowMs = 24 * 60 * 60 * 1000 - 60 * 1000;
    if (!Number.isFinite(inboundAt) || inboundAt > now + 5 * 60 * 1000 || now - inboundAt > safeWindowMs) {
      return json(request, 409, { error: "reply_window_expired_or_unknown" });
    }

    const contacts = await rows(config, "contacts", {
      id: `eq.${conversation.contact_id}`, workspace_id: `eq.${workspaceId}`, limit: "1"
    }, "id,channel,external_id");
    const contact = contacts[0];
    if (!contact || contact.channel !== conversation.channel || !contact.external_id) {
      return json(request, 409, { error: "contact_not_connected_to_provider" });
    }

    const connections = await rows(config, "channel_connections", {
      id: `eq.${connectionId}`, workspace_id: `eq.${workspaceId}`,
      provider: `eq.${provider}`, status: "eq.connected", limit: "1"
    }, "id,provider,external_account_id,external_page_id,status");
    const connection = connections[0];
    if (!connection) return json(request, 409, { error: "channel_not_connected" });
    const externalAccountId = String(connection.external_account_id || "");
    const expectedConversationPrefix = `${externalAccountId}:`;
    if (!externalAccountId || !String(conversation.external_id || "").startsWith(expectedConversationPrefix)) {
      return json(request, 409, { error: "conversation_connection_mismatch" });
    }

    const tokenRows = await rows(config, "channel_connection_secrets", {
      connection_id: `eq.${connectionId}`, limit: "1"
    }, "connection_id,access_token_ciphertext,access_token_iv,token_expires_at");
    const tokenRow = tokenRows[0];
    if (!tokenRow) return json(request, 409, { error: "channel_token_missing" });
    if (tokenRow.token_expires_at && Date.parse(tokenRow.token_expires_at) <= now) {
      return json(request, 409, { error: "channel_token_expired" });
    }

    const key = Deno.env.get("CHANNEL_TOKEN_ENCRYPTION_KEY");
    const version = Deno.env.get("META_GRAPH_API_VERSION") || "";
    if (!key || !/^v\d+\.\d+$/.test(version)) return json(request, 503, { error: "provider_not_configured" });
    const token = await decryptToken(tokenRow.access_token_ciphertext, tokenRow.access_token_iv, key);
    if (!token) return json(request, 503, { error: "channel_token_invalid" });

    // Insert an idempotency row before contacting Meta. Retries with the same
    // clientMessageId never send a second message if the provider result is unclear.
    const insertUrl = new URL("/rest/v1/messages", config.supabaseUrl);
    insertUrl.searchParams.set("on_conflict", "conversation_id,client_message_id");
    let pendingRows;
    try {
      pendingRows = await dbRequest(config, insertUrl.pathname + insertUrl.search, {
        method: "POST",
        body: {
          conversation_id: conversationId,
          direction: "out",
          author: "human",
          body: text,
          created_at: new Date(now).toISOString(),
          provider,
          provider_status: "sending",
          provider_status_at: new Date(now).toISOString(),
          client_message_id: clientMessageId
        },
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" }
      });
    } catch (_) {
      return json(request, 503, { error: "message_recording_failed" });
    }

    const pending = Array.isArray(pendingRows) ? pendingRows[0] : null;
    if (!pending) {
      const existing = await rows(config, "messages", {
        conversation_id: `eq.${conversationId}`, client_message_id: `eq.${clientMessageId}`, limit: "1"
      }, "id,provider_status,provider_message_id,created_at");
      if (!existing[0]) return json(request, 503, { error: "idempotency_record_unavailable" });
      return json(request, 200, { message: existing[0], duplicateRequest: true });
    }

    let sent;
    try {
      sent = await providerSend(provider, connection, contact, text, token, version);
    } catch (_) {
      await patchMessage(config, pending.id, { provider_status: "unknown", provider_status_at: new Date().toISOString() }).catch(() => {});
      return json(request, 502, { error: "provider_result_unknown", retry: false, messageId: pending.id });
    }
    if (!sent.ok) {
      await patchMessage(config, pending.id, { provider_status: "failed", provider_status_at: new Date().toISOString() }).catch(() => {});
      return json(request, 502, { error: "provider_rejected", providerCode: sent.providerCode, messageId: pending.id });
    }
    if (!sent.providerMessageId) {
      await patchMessage(config, pending.id, { provider_status: "unknown", provider_status_at: new Date().toISOString() }).catch(() => {});
      return json(request, 502, { error: "provider_id_missing", retry: false, messageId: pending.id });
    }

    try {
      await patchMessage(config, pending.id, {
        provider_message_id: sent.providerMessageId,
        provider_status: "sent",
        provider_status_at: new Date().toISOString()
      });
      const conversationPath = restPath("conversations", { id: `eq.${conversationId}` }, "id");
      await dbRequest(config, conversationPath, {
        method: "PATCH",
        body: { last_at: new Date().toISOString() },
        headers: { Prefer: "return=minimal" }
      });
    } catch (_) {
      // The provider may already have accepted the send. Keep this idempotency
      // key and never auto-retry it; status reconciliation must resolve it.
      await patchMessage(config, pending.id, { provider_status: "unknown", provider_status_at: new Date().toISOString() }).catch(() => {});
      return json(request, 202, { status: "unknown", retry: false, messageId: pending.id });
    }

    return json(request, 200, {
      status: "sent",
      message: { id: pending.id, providerMessageId: sent.providerMessageId, createdAt: pending.created_at }
    });
  } catch (error) {
    console.error("Meta send endpoint failed", error instanceof Error ? error.message : "unknown error");
    return json(request, 500, { error: "send_failed" });
  }
});
