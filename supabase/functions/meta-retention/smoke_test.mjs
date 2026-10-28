import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const SUPABASE_URL = "https://supabase.example.test";
const SERVICE_KEY = "service-role-test-key";
const CRON_SECRET = "retention-cron-secret-with-at-least-32-characters";
const env = new Map();
let handler;
let failDb = false;
const calls = [];

const fetchMock = async (input, init = {}) => {
  const url = input instanceof URL ? input : new URL(String(input));
  calls.push({ url, init });
  if (failDb) return new Response("", { status: 500 });
  assert.equal(init.method, "DELETE");
  assert.equal(new Headers(init.headers).get("apikey"), SERVICE_KEY);
  assert.equal(new Headers(init.headers).get("authorization"), `Bearer ${SERVICE_KEY}`);
  assert.equal(new Headers(init.headers).get("prefer"), "return=minimal,count=exact");
  assert.match(url.searchParams.get("expires_at"), /^lt\./);
  assert.ok(!url.href.includes(CRON_SECRET));
  const count = url.pathname.endsWith("meta_oauth_states") ? 2 : 5;
  return new Response(null, { status: 204, headers: { "content-range": `*/${count}` } });
};

const source = await readFile(new URL("./index.ts", import.meta.url), "utf8");
const context = {
  Deno: { env: { get: (key) => env.get(key) || "" }, serve: (fn) => { handler = fn; } },
  fetch: fetchMock,
  URL,
  Request,
  Response,
  Headers,
  TextEncoder,
  Uint8Array,
  Math,
  Date,
  JSON,
  Error,
  console
};
vm.runInNewContext(source, context, { filename: "meta-retention.js" });
assert.equal(typeof handler, "function");

async function call(headers = {}, method = "POST") {
  const response = await handler(new Request("https://function.example.test/meta-retention", {
    method,
    headers,
    body: method === "POST" ? "" : undefined
  }));
  return { status: response.status, body: await response.json() };
}

// Configuration and authorization fail closed; no DB requests run.
let result = await call({ authorization: `Bearer ${CRON_SECRET}` });
assert.equal(result.status, 503);
assert.equal(result.body.error, "retention_not_configured");
assert.equal(calls.length, 0);

env.set("SUPABASE_URL", SUPABASE_URL);
env.set("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);
env.set("META_RETENTION_CRON_SECRET", CRON_SECRET);
result = await call({ origin: "https://attacker.example", authorization: `Bearer ${CRON_SECRET}` });
assert.equal(result.status, 403);
result = await call({ authorization: "Bearer wrong-secret" });
assert.equal(result.status, 401);
assert.equal(calls.length, 0);

// Valid scheduled invocation deletes only rows already expired at the cutoff.
result = await call({ authorization: `Bearer ${CRON_SECRET}` });
assert.equal(result.status, 200, JSON.stringify(result.body));
assert.equal(result.body.ok, true);
assert.equal(result.body.oauthStatesDeleted, 2);
assert.equal(result.body.webhookRowsDeleted, 5);
assert.deepEqual(calls.map((call) => call.url.pathname), [
  "/rest/v1/meta_oauth_states",
  "/rest/v1/meta_webhook_inbox"
]);
assert.ok(calls.every((call) => call.url.searchParams.get("expires_at").startsWith("lt.")));

// A database failure returns a generic error and never leaks provider data.
failDb = true;
calls.length = 0;
result = await call({ authorization: `Bearer ${CRON_SECRET}` });
assert.equal(result.status, 503);
assert.equal(result.body.error, "retention_database_failed");
assert.equal(calls.length, 1);

console.log("meta-retention smoke tests passed (mocked Supabase requests only)");
