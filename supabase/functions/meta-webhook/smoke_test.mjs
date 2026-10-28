// Node smoke test for the Deno Edge Function scaffold (no live Supabase/Meta calls).
import fs from "node:fs";
import vm from "node:vm";
import cryptoNode from "node:crypto";
import { webcrypto } from "node:crypto";

const sharedSource = fs.readFileSync(new URL("../_shared/meta-webhook-normalize.ts", import.meta.url), "utf8")
  .replace(/\nexport \{ normalizeMetaWebhookPayload \};?\s*$/, "");
const source = fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8")
  .replace(/^import \{ normalizeMetaWebhookPayload \} from "\.\.\/_shared\/meta-webhook-normalize\.ts";\s*/m, "");
const env = new Map();
let handler;
const fetchCalls = [];
const context = {
  console, TextEncoder, TextDecoder, Uint8Array, Array, Set, String,
  URL, URLSearchParams, Response, Request, btoa, atob, crypto: webcrypto,
  fetch: async (url, init) => {
    const requestUrl = new URL(String(url));
    fetchCalls.push({ url: requestUrl, init });
    if (requestUrl.pathname.endsWith("/meta_webhook_inbox") && init.method === "POST") {
      return new Response(null, { status: 201 });
    }
    if (requestUrl.pathname.endsWith("/rpc/chatora_ingest_meta_messages")) {
      return new Response(JSON.stringify({ processed: 1 }), { status: 200 });
    }
    if (requestUrl.pathname.endsWith("/rpc/chatora_update_meta_statuses")) {
      return new Response(JSON.stringify({ updated: 1 }), { status: 200 });
    }
    if (requestUrl.pathname.endsWith("/meta_webhook_inbox") && init.method === "PATCH") {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected mock request: ${requestUrl.pathname}`);
  },
  Deno: { env: { get: (name) => env.get(name) }, serve: (fn) => { handler = fn; } }
};
vm.runInNewContext(`${sharedSource}\n${source}`, context, { filename: "meta-webhook.js" });

const unconfigured = await handler(new Request(
  "https://edge.test/meta-webhook?hub.mode=subscribe&hub.verify_token=verify-123&hub.challenge=abc"
));
if (unconfigured.status !== 503) throw new Error("Expected safe unconfigured response");

env.set("META_WEBHOOK_VERIFY_TOKEN", "verify-123");
const validGet = await handler(new Request(
  "https://edge.test/meta-webhook?hub.mode=subscribe&hub.verify_token=verify-123&hub.challenge=abc"
));
if (validGet.status !== 200 || await validGet.text() !== "abc") throw new Error("GET verification failed");
const invalidGet = await handler(new Request(
  "https://edge.test/meta-webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc"
));
if (invalidGet.status !== 403) throw new Error("Wrong verification token was accepted");

env.set("META_APP_SECRET", "test-app-secret");
env.set("META_WEBHOOK_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
env.set("SUPABASE_URL", "https://example.supabase.co");
env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
const payload = JSON.stringify({
  object: "whatsapp_business_account",
  entry: [{
    id: "waba-1",
    changes: [{ value: {
      metadata: { phone_number_id: "phone-1" },
      contacts: [{ wa_id: "201234567890", profile: { name: "Test Contact" } }],
      messages: [{ id: "wamid.test-1", from: "201234567890", timestamp: "1793055600", type: "text", text: { body: "Hello Chatora" } }],
      statuses: [{ id: "wamid.out-1", status: "delivered", timestamp: "1793055601" }]
    } }]
  }]
});
const signature = "sha256=" + cryptoNode.createHmac("sha256", "test-app-secret")
  .update(Buffer.from(payload)).digest("hex");
const badPost = await handler(new Request("https://edge.test/meta-webhook", {
  method: "POST", headers: { "x-hub-signature-256": "sha256=" + "0".repeat(64) }, body: payload
}));
if (badPost.status !== 401 || fetchCalls.length !== 0) {
  throw new Error("Invalid signature was not rejected before persistence");
}
const goodPost = await handler(new Request("https://edge.test/meta-webhook", {
  method: "POST", headers: { "x-hub-signature-256": signature }, body: payload
}));
if (goodPost.status !== 200 || fetchCalls.length !== 4) throw new Error("Valid signed event was not queued, normalized, status-updated, and marked processed");

const stored = JSON.parse(fetchCalls[0].init.body);
if (stored.provider !== "whatsapp_cloud" || stored.external_account_id !== "phone-1") {
  throw new Error("Provider/account classification failed");
}
if (stored.payload_ciphertext.includes("phone-1") || stored.payload_ciphertext.includes("Hello Chatora")) {
  throw new Error("Webhook plaintext leaked into the queue");
}
const rpcPayload = JSON.parse(fetchCalls[1].init.body);
const inbound = rpcPayload.p_events?.[0];
if (rpcPayload.p_provider !== "whatsapp_cloud" || inbound?.external_contact_id !== "201234567890" || inbound?.body !== "Hello Chatora") {
  throw new Error("Normalized inbound message was not passed to the database processor");
}
const statusRpc = JSON.parse(fetchCalls[2].init.body);
if (statusRpc.p_provider !== "whatsapp_cloud" || statusRpc.p_events?.[0]?.status !== "delivered") {
  throw new Error("WhatsApp delivery status was not normalized");
}
if (fetchCalls[3].init.method !== "PATCH") throw new Error("Queue event was not marked processed");
const key = await webcrypto.subtle.importKey(
  "raw", Buffer.alloc(32, 7), { name: "AES-GCM" }, false, ["decrypt"]
);
const decrypted = await webcrypto.subtle.decrypt(
  { name: "AES-GCM", iv: Buffer.from(stored.payload_iv, "base64") },
  key, Buffer.from(stored.payload_ciphertext, "base64")
);
if (Buffer.from(decrypted).toString() !== payload) throw new Error("Encrypted payload failed round-trip");

const pagePayload = JSON.stringify({ object: "page", entry: [{ id: "page-1", messaging: [] }] });
const pageSignature = "sha256=" + cryptoNode.createHmac("sha256", "test-app-secret")
  .update(Buffer.from(pagePayload)).digest("hex");
const pageObject = await handler(new Request("https://edge.test/meta-webhook", {
  method: "POST", headers: { "x-hub-signature-256": pageSignature }, body: pagePayload
}));
if (pageObject.status !== 400 || fetchCalls.length !== 4) {
  throw new Error("Generic Page webhook was incorrectly routed as Instagram");
}

const igPayload = JSON.stringify({
  object: "instagram",
  entry: [{ id: "ig-account-1", messaging: [{
    sender: { id: "ig-user-1" }, recipient: { id: "ig-account-1" }, timestamp: 1793055600000,
    message: { mid: "ig.mid.smoke-1", text: "Hi from Instagram" }
  }] }]
});
const igSignature = "sha256=" + cryptoNode.createHmac("sha256", "test-app-secret")
  .update(Buffer.from(igPayload)).digest("hex");
const igResponse = await handler(new Request("https://edge.test/meta-webhook", {
  method: "POST", headers: { "x-hub-signature-256": igSignature }, body: igPayload
}));
if (igResponse.status !== 200 || fetchCalls.length !== 7) throw new Error("Instagram webhook was not processed");
const igRpc = JSON.parse(fetchCalls[5].init.body);
if (igRpc.p_provider !== "instagram_messenger" || igRpc.p_events?.[0]?.external_contact_id !== "ig-user-1" || igRpc.p_events?.[0]?.body !== "Hi from Instagram") {
  throw new Error("Instagram message normalization failed");
}

console.log("Meta webhook smoke tests passed for WhatsApp and Instagram (no live network calls). ");
