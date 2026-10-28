// Mocked smoke tests for the private replay worker; no live Supabase/Meta calls.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import cryptoNode from "node:crypto";
import { webcrypto } from "node:crypto";
import vm from "node:vm";

const env = new Map();
const supabaseUrl = "https://supabase.example.test";
const serviceKey = "test-service-role-key";
const cronSecret = "replay-cron-secret-long-enough-for-local-smoke-tests";
const rawKey = Buffer.alloc(32, 9);
const keyB64 = rawKey.toString("base64");
let handler;
let rowsToClaim = [];
let failClaim = false;
const calls = [];

const fetchMock = async (input, init = {}) => {
  const url = input instanceof URL ? input : new URL(String(input));
  const headers = new Headers(init.headers);
  calls.push({ url, init, headers });
  assert.equal(headers.get("apikey"), serviceKey);
  assert.equal(headers.get("authorization"), `Bearer ${serviceKey}`);
  if (url.pathname.endsWith("/rpc/chatora_claim_meta_webhook_events")) {
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body), { p_limit: 10, p_lease_seconds: 300 });
    if (failClaim) return new Response("", { status: 500 });
    return new Response(JSON.stringify(rowsToClaim), { status: 200 });
  }
  if (url.pathname.endsWith("/rpc/chatora_ingest_meta_messages")) {
    assert.equal(init.method, "POST");
    return new Response(JSON.stringify({ processed: 1 }), { status: 200 });
  }
  if (url.pathname.endsWith("/rpc/chatora_update_meta_statuses")) {
    assert.equal(init.method, "POST");
    return new Response(JSON.stringify({ updated: 1 }), { status: 200 });
  }
  if (url.pathname.endsWith("/rest/v1/meta_webhook_inbox")) {
    assert.equal(init.method, "PATCH");
    return new Response(null, { status: 204 });
  }
  throw new Error(`Unexpected mock request: ${url.pathname}`);
};

const sharedSource = (await readFile(new URL("../_shared/meta-webhook-normalize.ts", import.meta.url), "utf8"))
  .replace(/\nexport \{ normalizeMetaWebhookPayload \};?\s*$/, "");
const edgeSource = (await readFile(new URL("./index.ts", import.meta.url), "utf8"))
  .replace(/^import \{ normalizeMetaWebhookPayload \} from "\.\.\/_shared\/meta-webhook-normalize\.ts";\s*/m, "");
const context = {
  Deno: { env: { get: (name) => env.get(name) || "" }, serve: (fn) => { handler = fn; } },
  fetch: fetchMock,
  crypto: webcrypto,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  Array,
  URL,
  Request,
  Response,
  Headers,
  Date,
  Math,
  JSON,
  Error,
  atob,
  btoa,
  console
};
vm.runInNewContext(`${sharedSource}\n${edgeSource}`, context, { filename: "meta-replay.js" });
assert.equal(typeof handler, "function");

async function call(headers = {}, method = "POST") {
  const response = await handler(new Request("https://edge.example.test/meta-replay", {
    method,
    headers,
    body: method === "POST" ? "" : undefined
  }));
  return { status: response.status, body: await response.json() };
}

// Missing configuration, browser origins, and invalid bearer secrets fail closed.
let result = await call({ authorization: `Bearer ${cronSecret}` });
assert.equal(result.status, 503);
assert.equal(result.body.error, "replay_not_configured");
assert.equal(calls.length, 0);

env.set("SUPABASE_URL", supabaseUrl);
env.set("SUPABASE_SERVICE_ROLE_KEY", serviceKey);
env.set("META_REPLAY_CRON_SECRET", cronSecret);
env.set("META_WEBHOOK_ENCRYPTION_KEY", keyB64);
result = await call({ origin: "https://browser.example", authorization: `Bearer ${cronSecret}` });
assert.equal(result.status, 403);
result = await call({ authorization: "Bearer wrong-secret" });
assert.equal(result.status, 401);
assert.equal(calls.length, 0);

const payload = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{ changes: [{ value: {
    metadata: { phone_number_id: "phone-replay-1" },
    contacts: [{ wa_id: "201234567890", profile: { name: "Replay Contact" } }],
    messages: [{ id: "wamid.replay-1", from: "201234567890", timestamp: "1793055600", type: "text", text: { body: "Recovered by replay" } }],
    statuses: [{ id: "wamid.out-replay-1", status: "delivered", timestamp: "1793055601" }]
  } }] }]
});
const payloadBytes = Buffer.from(payload);
const hash = cryptoNode.createHash("sha256").update(payloadBytes).digest("hex");
const cryptoKey = await webcrypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt"]);
const iv = webcrypto.getRandomValues(new Uint8Array(12));
const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, payloadBytes));
const id = "11111111-2222-4333-8444-555555555555";
const validRow = {
  id,
  provider: "whatsapp_cloud",
  payload_sha256: hash,
  payload_ciphertext: Buffer.from(ciphertext).toString("base64"),
  payload_iv: Buffer.from(iv).toString("base64"),
  processing_attempts: 1
};
rowsToClaim = [validRow];
result = await call({ authorization: `Bearer ${cronSecret}` });
assert.equal(result.status, 200, JSON.stringify(result.body));
assert.deepEqual(result.body, { ok: true, claimed: 1, processed: 1, deferred: 0 });
assert.equal(calls.length, 4);
assert.equal(calls[0].url.pathname, "/rest/v1/rpc/chatora_claim_meta_webhook_events");
assert.equal(calls[1].url.pathname, "/rest/v1/rpc/chatora_ingest_meta_messages");
assert.equal(calls[2].url.pathname, "/rest/v1/rpc/chatora_update_meta_statuses");
assert.equal(calls[3].init.method, "PATCH");
const inbound = JSON.parse(calls[1].init.body);
assert.equal(inbound.p_provider, "whatsapp_cloud");
assert.equal(inbound.p_events[0].body, "Recovered by replay");
const delivery = JSON.parse(calls[2].init.body);
assert.equal(delivery.p_events[0].status, "delivered");
const completed = JSON.parse(calls[3].init.body);
assert.equal(completed.processed_at != null, true);
assert.equal(completed.processing_error, null);
assert.equal(completed.processing_lease_until, null);
assert.equal(completed.next_attempt_at, null);
assert.ok(!JSON.stringify(result.body).includes("Recovered by replay"));

// A corrupted/hash-mismatched event is deferred with a bounded retry time; its
// decrypted content is never returned, logged, or sent to the ingest RPC.
calls.length = 0;
rowsToClaim = [{ ...validRow, payload_sha256: "0".repeat(64) }];
result = await call({ authorization: `Bearer ${cronSecret}` });
assert.equal(result.status, 200);
assert.deepEqual(result.body, { ok: true, claimed: 1, processed: 0, deferred: 1 });
assert.equal(calls.length, 2);
assert.equal(calls[1].init.method, "PATCH");
const deferred = JSON.parse(calls[1].init.body);
assert.equal(deferred.processing_error, "replay_failed");
assert.equal(deferred.processing_lease_until, null);
assert.ok(Date.parse(deferred.next_attempt_at) > Date.now());

// A failed claim RPC is a generic retryable server error.
calls.length = 0;
failClaim = true;
result = await call({ authorization: `Bearer ${cronSecret}` });
assert.equal(result.status, 503);
assert.equal(result.body.error, "replay_database_failed");
assert.equal(calls.length, 1);

console.log("meta-replay smoke tests passed (mocked Supabase requests only)");
