// Meta "Data Deletion Request" callback for Chatora — LOCAL SCAFFOLD, not deployed.
//
// POST  (called by Meta, form field `signed_request`): verifies the HMAC-SHA256
//       signature with the app secret, erases every contact that carries the
//       person's app-scoped ID (conversations and messages cascade), and
//       answers with the JSON Meta requires: { url, confirmation_code }.
// GET   ?code=<confirmation_code>: public status lookup for that code. Only a
//       hash of the code is stored; no personal identifier is kept or shown.

const MAX_BODY_BYTES = 16 * 1024;
const encoder = new TextEncoder();

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function toHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromBase64Url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function equalBytes(a, b) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i % (a.length || 1)] || 0) ^ b[i];
  return diff === 0;
}

async function sha256Hex(value) {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

async function parseSignedRequest(signedRequest, appSecret) {
  const parts = String(signedRequest || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1] || parts[1].length > 8192) return null;
  let signature, payload;
  try {
    signature = fromBase64Url(parts[0]);
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(parts[1])));
  } catch (_) { return null; }
  if (!payload || String(payload.algorithm || "").toUpperCase() !== "HMAC-SHA256") return null;
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(parts[1])));
  if (!equalBytes(signature, expected)) return null;
  const userId = String(payload.user_id || "");
  return /^\d{5,32}$/.test(userId) ? { userId } : null;
}

function config() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appSecret = Deno.env.get("META_APP_SECRET");
  const statusUrl = Deno.env.get("META_DATA_DELETION_STATUS_URL");
  if (!supabaseUrl || !serviceKey || !appSecret || !statusUrl || !/^https:\/\//.test(statusUrl)) return null;
  return { supabaseUrl, serviceKey, appSecret, statusUrl };
}

function serviceHeaders(cfg) {
  return { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}`, "Content-Type": "application/json" };
}

Deno.serve(async (request) => {
  const cfg = config();
  if (!cfg) return json(503, { error: "data_deletion_not_configured" });

  if (request.method === "GET") {
    const code = new URL(request.url).searchParams.get("code") || "";
    if (!/^[0-9a-f]{32}$/.test(code)) return json(400, { error: "invalid_code" });
    const url = new URL("/rest/v1/meta_data_deletion_requests", cfg.supabaseUrl);
    url.searchParams.set("select", "status,requested_at");
    url.searchParams.set("confirmation_sha256", `eq.${await sha256Hex(code)}`);
    url.searchParams.set("limit", "1");
    const response = await fetch(url, { headers: serviceHeaders(cfg) });
    if (!response.ok) return json(503, { error: "status_unavailable" });
    const rows = await response.json().catch(() => []);
    if (!Array.isArray(rows) || !rows.length) return json(404, { error: "unknown_code" });
    return json(200, { status: rows[0].status, requested_at: rows[0].requested_at });
  }

  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (Number(request.headers.get("content-length") || "0") > MAX_BODY_BYTES) return json(413, { error: "request_too_large" });

  let signedRequest = "";
  try {
    const raw = new Uint8Array(await request.arrayBuffer());
    if (!raw.length || raw.length > MAX_BODY_BYTES) return json(413, { error: "request_too_large" });
    signedRequest = new URLSearchParams(new TextDecoder().decode(raw)).get("signed_request") || "";
  } catch (_) {
    return json(400, { error: "invalid_request" });
  }

  const parsed = await parseSignedRequest(signedRequest, cfg.appSecret);
  if (!parsed) return json(401, { error: "invalid_signed_request" });

  try {
    const code = toHex(crypto.getRandomValues(new Uint8Array(16)));
    const response = await fetch(new URL("/rest/v1/rpc/chatora_delete_meta_user_data", cfg.supabaseUrl), {
      method: "POST",
      headers: serviceHeaders(cfg),
      body: JSON.stringify({ p_external_user_id: parsed.userId, p_confirmation_sha256: await sha256Hex(code) })
    });
    if (!response.ok) throw new Error("delete_failed");
    const status = new URL(cfg.statusUrl);
    status.searchParams.set("code", code);
    return json(200, { url: status.toString(), confirmation_code: code });
  } catch (_) {
    // Never log the signed request or the user id.
    console.error("Meta data deletion request failed");
    return json(503, { error: "data_deletion_failed" });
  }
});
