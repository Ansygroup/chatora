import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("./meta-send-client.js", import.meta.url), "utf8");
const config = {
  SUPABASE_URL: "https://supabase.example.test/",
  SUPABASE_ANON_KEY: "public-anon-key",
  META_SEND_ENABLED: false
};
let session = { access_token: "user-jwt" };
let response = new Response(JSON.stringify({ status: "sent" }), { status: 200 });
const requests = [];
const window = {
  CHATORA_CONFIG: config,
  CHATORA_AUTH: { ensure: async () => session }
};
const context = {
  window,
  fetch: async (url, init) => { requests.push({ url: String(url), init }); return response; },
  Response,
  JSON,
  String,
  Object,
  Error
};
vm.runInNewContext(source, context, { filename: "meta-send-client.js" });
const client = window.CHATORA_META_SEND;
assert.equal(client.isEnabled(), false);
await assert.rejects(() => client.send({ text: "Hello" }), (error) => error.code === "sending_disabled");
assert.equal(requests.length, 0, "the default-off UI gate must not call the Edge Function");

config.META_SEND_ENABLED = true;
assert.equal(client.isEnabled(), true);
const input = {
  workspaceId: "workspace-uuid",
  conversationId: "conversation-uuid",
  connectionId: "connection-uuid",
  clientMessageId: "client-message-uuid",
  text: "A safe test reply"
};
const result = await client.send(input);
assert.deepEqual(result, { status: "sent" });
assert.equal(requests.length, 1);
assert.equal(requests[0].url, "https://supabase.example.test/functions/v1/meta-send");
assert.equal(requests[0].init.method, "POST");
assert.equal(requests[0].init.cache, "no-store");
const headers = new Headers(requests[0].init.headers);
assert.equal(headers.get("apikey"), "public-anon-key");
assert.equal(headers.get("authorization"), "Bearer user-jwt");
assert.deepEqual(JSON.parse(requests[0].init.body), input);
assert.ok(!requests[0].init.body.includes("service_role"));

response = new Response(JSON.stringify({ error: "reply_window_expired_or_unknown" }), { status: 409 });
await assert.rejects(() => client.send(input), (error) =>
  error.code === "reply_window_expired_or_unknown" && error.status === 409
);
assert.equal(requests.length, 2);

session = null;
await assert.rejects(() => client.send(input), (error) => error.code === "no_session");
assert.equal(requests.length, 2);

console.log("meta-send browser-client smoke tests passed (mocked fetch only)");
