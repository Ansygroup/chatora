// Chatora account deletion.
// A signed-in user permanently deletes their own account. Removing the auth
// user cascades through workspaces → contacts, conversations, messages, flows,
// broadcasts (ON DELETE CASCADE), so no workspace data outlives the account.
// The caller must re-enter their password: a stolen session alone cannot
// destroy an account.

const MAX_BODY_BYTES = 4 * 1024;
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
    headers: Object.assign({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }, corsHeaders(request))
  });
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins().includes(origin)) return json(request, 403, { error: "origin_not_allowed" });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, 405, { error: "method_not_allowed" });
  if (Number(request.headers.get("content-length") || "0") > MAX_BODY_BYTES) {
    return json(request, 413, { error: "request_too_large" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceKey || !anonKey) return json(request, 503, { error: "server_not_configured" });

  const authorization = request.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return json(request, 401, { error: "unauthorized" });

  let input;
  try {
    const raw = new Uint8Array(await request.arrayBuffer());
    if (!raw.length || raw.length > MAX_BODY_BYTES) return json(request, 413, { error: "request_too_large" });
    input = JSON.parse(new TextDecoder().decode(raw));
  } catch (_) {
    return json(request, 400, { error: "invalid_json" });
  }
  const password = input && typeof input.password === "string" ? input.password : "";
  if (!input || input.confirm !== "DELETE" || !password || password.length > 256) {
    return json(request, 400, { error: "confirmation_required" });
  }

  try {
    const who = await fetch(new URL("/auth/v1/user", supabaseUrl), {
      headers: { apikey: anonKey, Authorization: authorization }
    });
    if (!who.ok) return json(request, 401, { error: "unauthorized" });
    const user = await who.json();
    const userId = String((user && user.id) || "");
    const email = String((user && user.email) || "");
    if (!UUID_RE.test(userId) || !email) return json(request, 401, { error: "unauthorized" });

    // Re-authenticate with the password before anything is destroyed.
    const check = await fetch(new URL("/auth/v1/token?grant_type=password", supabaseUrl), {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!check.ok) return json(request, 403, { error: "wrong_password" });
    const session = await check.json().catch(() => null);
    if (!session || !session.user || session.user.id !== userId) return json(request, 403, { error: "wrong_password" });

    const removed = await fetch(new URL(`/auth/v1/admin/users/${userId}`, supabaseUrl), {
      method: "DELETE",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ should_soft_delete: false })
    });
    if (!removed.ok && removed.status !== 404) return json(request, 503, { error: "account_delete_failed" });
    return json(request, 200, { deleted: true });
  } catch (_) {
    // Never log the password, token, email or user id.
    console.error("Account deletion failed");
    return json(request, 503, { error: "account_delete_failed" });
  }
});
