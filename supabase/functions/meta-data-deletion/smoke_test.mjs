// Node smoke test for the Meta data-deletion callback (no live network calls).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { createHmac, createHash, webcrypto } from "node:crypto";

const env = new Map();
let handler;
const calls = [];
const stored = new Map();

const fetchMock = async (input, init = {}) => {
  const url = new URL(String(input));
  calls.push({ url, init });
  if (url.pathname === "/rest/v1/rpc/chatora_delete_meta_user_data") {
    const body = JSON.parse(init.body);
    stored.set(body.p_confirmation_sha256, body.p_external_user_id);
    return new Response(JSON.stringify({ deleted: 1 }), { status: 200 });
  }
  if (url.pathname === "/rest/v1/meta_data_deletion_requests") {
    const hash = url.searchParams.get("confirmation_sha256").replace(/^eq\./, "");
    return new Response(JSON.stringify(stored.has(hash)
      ? [{ status: "completed", requested_at: "2026-11-14T00:00:00Z" }] : []), { status: 200 });
  }
  throw new Error("Unexpected fetch " + url.pathname);
};

const source = await readFile(new URL("./index.ts", import.meta.url), "utf8");
vm.runInNewContext(source, {
  Deno: { env: { get: (k) => env.get(k) || "" }, serve: (fn) => { handler = fn; } },
  fetch: fetchMock, URL, URLSearchParams, Request, Response, TextDecoder, TextEncoder, Uint8Array, Array,
  Number, String, JSON, atob, crypto: webcrypto, console: { error() {} }
}, { filename: "meta-data-deletion.js" });

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function signed(payload, secret) {
  const body = b64url(JSON.stringify(payload));
  return b64url(createHmac("sha256", secret).update(body).digest()) + "." + body;
}
const post = (signedRequest) => handler(new Request("https://edge.test/meta-data-deletion", {
  method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ signed_request: signedRequest }).toString()
}));

assert.equal((await post("x.y")).status, 503, "must refuse when unconfigured");
env.set("SUPABASE_URL", "https://supabase.example.test");
env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
env.set("META_APP_SECRET", "app-secret");
env.set("META_DATA_DELETION_STATUS_URL", "https://chatora.example/data-deletion");

const payload = { algorithm: "HMAC-SHA256", user_id: "1234567890", issued_at: 1793055600 };
assert.equal((await post("garbage")).status, 401);
assert.equal((await post(signed(payload, "wrong-secret"))).status, 401, "forged signature rejected");
assert.equal((await post(signed({ algorithm: "none", user_id: "1234567890" }, "app-secret"))).status, 401);
assert.equal((await post(signed({ algorithm: "HMAC-SHA256", user_id: "1 OR 1=1" }, "app-secret"))).status, 401);
assert.equal(calls.length, 0, "nothing reaches the database before the signature is verified");

const ok = await post(signed(payload, "app-secret"));
assert.equal(ok.status, 200);
const answer = await ok.json();
assert.match(answer.confirmation_code, /^[0-9a-f]{32}$/);
assert.equal(answer.url, "https://chatora.example/data-deletion?code=" + answer.confirmation_code);
const rpc = JSON.parse(calls[0].init.body);
assert.equal(rpc.p_external_user_id, "1234567890");
assert.equal(rpc.p_confirmation_sha256, createHash("sha256").update(answer.confirmation_code).digest("hex"));
assert.ok(!calls[0].init.body.includes(answer.confirmation_code), "only the hash of the code is stored");

const status = await handler(new Request("https://edge.test/meta-data-deletion?code=" + answer.confirmation_code));
assert.equal(status.status, 200);
assert.equal((await status.json()).status, "completed");
assert.equal((await handler(new Request("https://edge.test/meta-data-deletion?code=" + "0".repeat(32)))).status, 404);
assert.equal((await handler(new Request("https://edge.test/meta-data-deletion?code=zz"))).status, 400);

console.log("meta-data-deletion smoke tests passed (no live network calls).");
