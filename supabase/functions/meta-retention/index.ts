// Scheduled Meta retention endpoint. Local scaffold only; not deployed.
// Invoke from a trusted scheduler with Authorization: Bearer <secret>.
// Deletes expired, encrypted OAuth state (including abandoned temporary
// Instagram user tokens) and webhook inbox payloads after their expires_at.

const encoder = new TextEncoder();

class HttpError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function json(status, body) {
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

function config() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const cronSecret = Deno.env.get("META_RETENTION_CRON_SECRET") || "";
  if (!supabaseUrl || !serviceKey || cronSecret.length < 32) throw new HttpError(503, "retention_not_configured");
  return { supabaseUrl, serviceKey, cronSecret };
}

async function deleteExpired(config, table, cutoff) {
  const url = new URL(`/rest/v1/${table}`, config.supabaseUrl);
  url.searchParams.set("expires_at", `lt.${cutoff}`);
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      Prefer: "return=minimal,count=exact"
    }
  });
  if (!response.ok) throw new HttpError(503, "retention_database_failed");
  const range = response.headers.get("content-range") || "";
  const match = /\/(\d+)$/.exec(range);
  return match ? Number(match[1]) : null;
}

Deno.serve(async (request) => {
  if (request.headers.has("origin")) return json(403, { error: "origin_not_allowed" });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

  let settings;
  try { settings = config(); }
  catch (error) { return json(error.status || 503, { error: error.code || "retention_not_configured" }); }

  const authorization = request.headers.get("authorization") || "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  if (!match || !constantTimeEqual(match[1], settings.cronSecret)) return json(401, { error: "unauthorized" });

  const cutoff = new Date().toISOString();
  try {
    const oauthStatesDeleted = await deleteExpired(settings, "meta_oauth_states", cutoff);
    const webhookRowsDeleted = await deleteExpired(settings, "meta_webhook_inbox", cutoff);
    return json(200, { ok: true, cutoff, oauthStatesDeleted, webhookRowsDeleted });
  } catch (error) {
    return json(error.status || 503, { error: error.code || "retention_failed" });
  }
});
