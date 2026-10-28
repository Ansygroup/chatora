// Private retry worker for encrypted Meta webhook inbox rows. Invoke only from
// a trusted scheduler with Authorization: Bearer <META_REPLAY_CRON_SECRET>.
// Local scaffold only; do not deploy before explicit release approval.
import { normalizeMetaWebhookPayload } from "../_shared/meta-webhook-normalize.ts";

const BATCH_SIZE = 10;
const LEASE_SECONDS = 300;
const encoder = new TextEncoder();

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function reply(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

function constantTimeEqual(left, right) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) diff |= (a[i] || 0) ^ (b[i] || 0);
  return diff === 0;
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toHex(bytes) {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
}

function getConfig() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const cronSecret = Deno.env.get("META_REPLAY_CRON_SECRET") || "";
  const encryptionKeyB64 = Deno.env.get("META_WEBHOOK_ENCRYPTION_KEY") || "";
  if (!supabaseUrl || !serviceKey || cronSecret.length < 32 || !encryptionKeyB64) {
    throw new HttpError(503, "replay_not_configured");
  }
  let parsedUrl;
  let keyBytes;
  try {
    parsedUrl = new URL(supabaseUrl);
    keyBytes = fromBase64(encryptionKeyB64);
  } catch {
    throw new HttpError(503, "replay_not_configured");
  }
  if (!/^https?:$/.test(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password || keyBytes.length !== 32) {
    throw new HttpError(503, "replay_not_configured");
  }
  return { supabaseUrl: parsedUrl.origin, serviceKey, cronSecret, keyBytes };
}

function serviceHeaders(config, extra = {}) {
  return Object.assign({
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    "Content-Type": "application/json"
  }, extra);
}

async function postJson(config, path, body) {
  const response = await fetch(new URL(path, config.supabaseUrl), {
    method: "POST",
    headers: serviceHeaders(config, { Prefer: "return=representation" }),
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new HttpError(503, "replay_database_failed");
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function patchEvent(config, id, patch) {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw new HttpError(503, "replay_database_failed");
  }
  const url = new URL("/rest/v1/meta_webhook_inbox", config.supabaseUrl);
  url.searchParams.set("id", `eq.${id}`);
  const response = await fetch(url, {
    method: "PATCH",
    headers: serviceHeaders(config, { Prefer: "return=minimal" }),
    body: JSON.stringify(patch)
  });
  if (!response.ok) throw new HttpError(503, "replay_database_failed");
}

async function decryptPayload(row, config, key) {
  const iv = fromBase64(row.payload_iv);
  const ciphertext = fromBase64(row.payload_ciphertext);
  if (iv.length !== 12 || ciphertext.length < 16) throw new Error("invalid_encrypted_payload");
  const raw = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  if (typeof row.payload_sha256 !== "string" || !constantTimeEqual(toHex(digest), row.payload_sha256.toLowerCase())) {
    throw new Error("payload_hash_mismatch");
  }
  let payload;
  try { payload = JSON.parse(new TextDecoder().decode(raw)); }
  catch { throw new Error("invalid_payload_json"); }
  const info = normalizeMetaWebhookPayload(payload);
  if (!info || info.provider !== row.provider) throw new Error("provider_mismatch");
  return info;
}

async function processNormalized(config, info) {
  if (info.messages.length) {
    await postJson(config, "/rest/v1/rpc/chatora_ingest_meta_messages", {
      p_provider: info.provider,
      p_events: info.messages
    });
  }
  if (info.statuses.length) {
    await postJson(config, "/rest/v1/rpc/chatora_update_meta_statuses", {
      p_provider: info.provider,
      p_events: info.statuses
    });
  }
}

function nextRetryAt(attempts) {
  const attempt = Math.max(1, Math.min(Number(attempts) || 1, 9));
  const delayMinutes = Math.min(360, 2 ** attempt);
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

Deno.serve(async (request) => {
  if (request.headers.has("origin")) return reply(403, { error: "origin_not_allowed" });
  if (request.method !== "POST") return reply(405, { error: "method_not_allowed" });

  let config;
  try { config = getConfig(); }
  catch (error) { return reply(error.status || 503, { error: error.code || "replay_not_configured" }); }

  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") || "");
  if (!match || !constantTimeEqual(match[1], config.cronSecret)) return reply(401, { error: "unauthorized" });

  let key;
  try {
    key = await crypto.subtle.importKey("raw", config.keyBytes, { name: "AES-GCM" }, false, ["decrypt"]);
  } catch {
    return reply(503, { error: "replay_not_configured" });
  }

  try {
    const rows = await postJson(config, "/rest/v1/rpc/chatora_claim_meta_webhook_events", {
      p_limit: BATCH_SIZE,
      p_lease_seconds: LEASE_SECONDS
    });
    if (!Array.isArray(rows)) throw new HttpError(503, "replay_database_failed");

    let processed = 0;
    let deferred = 0;
    let persistenceFailed = false;
    for (const row of rows) {
      try {
        const info = await decryptPayload(row, config, key);
        await processNormalized(config, info);
        await patchEvent(config, row.id, {
          processed_at: new Date().toISOString(),
          processing_error: null,
          processing_lease_until: null,
          next_attempt_at: null
        });
        processed++;
      } catch {
        deferred++;
        try {
          await patchEvent(config, row.id, {
            processing_error: "replay_failed",
            processing_lease_until: null,
            next_attempt_at: nextRetryAt(row.processing_attempts)
          });
        } catch {
          // The lease expires on its own; a later scheduled run can retry it.
          persistenceFailed = true;
        }
      }
    }
    if (persistenceFailed) return reply(503, { error: "replay_partial_failure" });
    return reply(200, { ok: true, claimed: rows.length, processed, deferred });
  } catch (error) {
    return reply(error.status || 503, { error: error.code || "replay_failed" });
  }
});
