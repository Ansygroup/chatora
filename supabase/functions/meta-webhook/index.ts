import { normalizeMetaWebhookPayload } from "../_shared/meta-webhook-normalize.ts";

// Chatora Meta webhook: verified, encrypted intake plus synchronous normalization.
// It shares the normalizer with the private retry worker. Still a local scaffold:
// OAuth, credentials, schedules, and deployment are not configured or approved.

const MAX_BODY_BYTES = 3 * 1024 * 1024;
const encoder = new TextEncoder();

function reply(status, body, contentType = "text/plain; charset=utf-8") {
  return new Response(body, { status, headers: { "content-type": contentType, "cache-control": "no-store" } });
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function verifySignature(raw, header, appSecret) {
  const match = /^sha256=([0-9a-f]{64})$/i.exec(header || "");
  if (!match) return false;
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, raw));
  return safeEqual(toHex(signed), match[1].toLowerCase());
}

async function encrypt(raw, keyB64) {
  const keyBytes = fromBase64(keyB64);
  if (keyBytes.length !== 32) throw new Error("Webhook encryption key must decode to 32 bytes");
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, raw));
  return { ciphertext: toBase64(ciphertext), iv: toBase64(iv) };
}

async function sha256(raw) {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", raw)));
}

function serviceHeaders(serviceKey, extra = {}) {
  return Object.assign({
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json"
  }, extra);
}

async function servicePost(path, body, prefer = "return=minimal") {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase server configuration is missing");
  const url = new URL(path, supabaseUrl);
  const response = await fetch(url, {
    method: "POST",
    headers: serviceHeaders(serviceKey, { Prefer: prefer }),
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function queueEncryptedEvent(input) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase server configuration is missing");
  const url = new URL("/rest/v1/meta_webhook_inbox", supabaseUrl);
  url.searchParams.set("on_conflict", "provider,payload_sha256");
  const response = await fetch(url, {
    method: "POST",
    headers: serviceHeaders(serviceKey, {
      Prefer: "resolution=ignore-duplicates,return=minimal"
    }),
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error(`Webhook queue insert failed (${response.status})`);
}

async function markQueuedEvent(provider, hash, patch) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase server configuration is missing");
  const url = new URL("/rest/v1/meta_webhook_inbox", supabaseUrl);
  url.searchParams.set("provider", `eq.${provider}`);
  url.searchParams.set("payload_sha256", `eq.${hash}`);
  const response = await fetch(url, {
    method: "PATCH",
    headers: serviceHeaders(serviceKey, { Prefer: "return=minimal" }),
    body: JSON.stringify(patch)
  });
  if (!response.ok) throw new Error(`Webhook queue update failed (${response.status})`);
}

async function processNormalized(info) {
  if (info.messages.length) {
    await servicePost("/rest/v1/rpc/chatora_ingest_meta_messages", {
      p_provider: info.provider,
      p_events: info.messages
    });
  }
  if (info.statuses.length) {
    await servicePost("/rest/v1/rpc/chatora_update_meta_statuses", {
      p_provider: info.provider,
      p_events: info.statuses
    });
  }
}

Deno.serve(async (request) => {
  const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
  if (request.method === "GET") {
    if (!verifyToken) return reply(503, "Webhook verification is not configured");
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode") || "";
    const token = url.searchParams.get("hub.verify_token") || "";
    const challenge = url.searchParams.get("hub.challenge") || "";
    if (mode === "subscribe" && challenge && safeEqual(token, verifyToken)) return reply(200, challenge);
    return reply(403, "Forbidden");
  }

  if (request.method !== "POST") return reply(405, "Method not allowed");
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > MAX_BODY_BYTES) return reply(413, "Payload size is invalid");

  const appSecret = Deno.env.get("META_APP_SECRET");
  const encryptionKey = Deno.env.get("META_WEBHOOK_ENCRYPTION_KEY");
  if (!appSecret || !encryptionKey) return reply(503, "Webhook intake is not configured");

  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.byteLength === 0 || raw.byteLength > MAX_BODY_BYTES) return reply(413, "Payload size is invalid");

  let queueInfo = null;
  try {
    if (!(await verifySignature(raw, request.headers.get("x-hub-signature-256"), appSecret))) {
      return reply(401, "Invalid signature");
    }

    let payload;
    try { payload = JSON.parse(new TextDecoder().decode(raw)); }
    catch { return reply(400, "Invalid JSON"); }

    const info = normalizeMetaWebhookPayload(payload);
    if (!info) return reply(400, "Unsupported Meta webhook object");

    const externalIds = new Set([
      ...info.messages.map((e) => e.external_account_id),
      ...info.statuses.map((e) => e.external_account_id).filter(Boolean)
    ]);
    const externalAccountId = externalIds.size === 1 ? [...externalIds][0] : null;
    const payloadHash = await sha256(raw);
    const encrypted = await encrypt(raw, encryptionKey);
    queueInfo = { provider: info.provider, hash: payloadHash };

    await queueEncryptedEvent({
      provider: info.provider,
      external_account_id: externalAccountId,
      payload_sha256: payloadHash,
      payload_ciphertext: encrypted.ciphertext,
      payload_iv: encrypted.iv
    });
    await processNormalized(info);
    await markQueuedEvent(info.provider, payloadHash, {
      processed_at: new Date().toISOString(),
      processing_error: null,
      next_attempt_at: null
    });
    return reply(200, "EVENT_RECEIVED");
  } catch (error) {
    // Do not log payload bodies, customer IDs, access tokens, or secret values.
    if (queueInfo) {
      try {
        await markQueuedEvent(queueInfo.provider, queueInfo.hash, { processing_error: "processing_failed" });
      } catch (_) { /* Preserve the original failure; Meta will retry the event. */ }
    }
    console.error("Meta webhook intake/processing failed", error instanceof Error ? error.message : "unknown error");
    return reply(503, "Webhook intake unavailable");
  }
});
