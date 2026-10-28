// Node smoke tests for the Deno send endpoint; all network calls are mocked.
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const source = fs.readFileSync(new URL("./index.ts", import.meta.url), "utf8");
const env = new Map();
let handler;
let messageInsertCount = 0;
let graphSendCount = 0;
let lastInboundAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
let selectedChannel = "whatsapp";
let conversationExternalId = "123456789012345:201234567890";
let clientMessageId = "40000000-0000-4000-8000-000000000004";
const calls = [];
const workspaceId = "10000000-0000-4000-8000-000000000001";
const conversationId = "20000000-0000-4000-8000-000000000002";
const connectionId = "30000000-0000-4000-8000-000000000003";
const userId = "50000000-0000-4000-8000-000000000005";
const messageId = "60000000-0000-4000-8000-000000000006";
const accessToken = "test-meta-page-or-cloud-token";
const keyBytes = Buffer.alloc(32, 3);
const ivBytes = Buffer.alloc(12, 9);
const ivB64 = ivBytes.toString("base64");
const keyB64 = keyBytes.toString("base64");
const key = await webcrypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
const encryptedToken = Buffer.from(await webcrypto.subtle.encrypt(
  { name: "AES-GCM", iv: ivBytes }, key, new TextEncoder().encode(accessToken)
)).toString("base64");

function responseJson(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

const context = {
  console, TextEncoder, TextDecoder, Uint8Array, Array, Set, String,
  URL, URLSearchParams, Response, Request, btoa, atob, crypto: webcrypto,
  setTimeout, clearTimeout, AbortController,
  fetch: async (url, init = {}) => {
    const parsed = new URL(String(url));
    calls.push({ url: parsed, init });
    if (parsed.hostname === "graph.facebook.com") {
      graphSendCount++;
      const body = JSON.parse(init.body);
      if (init.headers.Authorization !== `Bearer ${accessToken}`) throw new Error("Token was not decrypted server-side");
      if (selectedChannel === "whatsapp") {
        if (body.to !== "201234567890") throw new Error("Unexpected WhatsApp recipient");
        return responseJson({ messages: [{ id: "wamid.smoke-1" }] });
      }
      if (body.recipient?.id !== "123456789012345") throw new Error("Unexpected Instagram recipient");
      return responseJson({ message_id: "ig.mid.smoke-1" });
    }
    if (parsed.pathname === "/auth/v1/user") return responseJson({ id: userId });
    if (parsed.pathname === "/rest/v1/workspaces") return responseJson([{ id: workspaceId }]);
    if (parsed.pathname === "/rest/v1/conversations") {
      if (init.method === "PATCH") return new Response(null, { status: 204 });
      return responseJson([{
        id: conversationId, workspace_id: workspaceId, contact_id: "70000000-0000-4000-8000-000000000007",
        channel: selectedChannel, status: "open", last_inbound_at: lastInboundAt,
        external_id: conversationExternalId
      }]);
    }
    if (parsed.pathname === "/rest/v1/contacts") return responseJson([{
      id: "70000000-0000-4000-8000-000000000007", channel: selectedChannel,
      external_id: selectedChannel === "whatsapp" ? "201234567890" : "123456789012345"
    }]);
    if (parsed.pathname === "/rest/v1/channel_connections") return responseJson([{
      id: connectionId, provider: selectedChannel === "whatsapp" ? "whatsapp_cloud" : "instagram_messenger",
      external_account_id: selectedChannel === "whatsapp" ? "123456789012345" : "ig-account-1",
      external_page_id: selectedChannel === "instagram" ? "123456789012345" : null,
      status: "connected"
    }]);
    if (parsed.pathname === "/rest/v1/channel_connection_secrets") return responseJson([{
      connection_id: connectionId, access_token_ciphertext: encryptedToken,
      access_token_iv: ivB64, token_expires_at: null
    }]);
    if (parsed.pathname === "/rest/v1/messages" && init.method === "POST") {
      messageInsertCount++;
      if (messageInsertCount === 1) {
        const body = JSON.parse(init.body);
        if (body.client_message_id !== clientMessageId || body.provider_status !== "sending") {
          throw new Error("Pending idempotency row was not created");
        }
        return responseJson([{ id: messageId, created_at: body.created_at }], 201);
      }
      return responseJson([], 201); // ON CONFLICT DO NOTHING on same client ID.
    }
    if (parsed.pathname === "/rest/v1/messages" && init.method === "GET") return responseJson([{
      id: messageId, provider_status: "sent", provider_message_id: "wamid.smoke-1",
      created_at: new Date().toISOString()
    }]);
    if (parsed.pathname === "/rest/v1/messages" && init.method === "PATCH") return new Response(null, { status: 204 });
    throw new Error(`Unexpected mocked request: ${init.method} ${parsed.pathname}`);
  },
  Deno: { env: { get: (name) => env.get(name) }, serve: (fn) => { handler = fn; } }
};
vm.runInNewContext(source, context, { filename: "meta-send.js" });

env.set("SUPABASE_URL", "https://example.supabase.co");
env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role");
env.set("SUPABASE_ANON_KEY", "test-anon-key");
env.set("CHANNEL_TOKEN_ENCRYPTION_KEY", keyB64);
env.set("META_GRAPH_API_VERSION", "v26.0");
env.set("APP_ALLOWED_ORIGINS", "https://app.test");

const requestBody = () => JSON.stringify({ workspaceId, conversationId, connectionId, clientMessageId, text: "Hello from Chatora" });
const makeRequest = (origin = "https://app.test") => new Request("https://edge.test/meta-send", {
  method: "POST",
  headers: { origin, authorization: "Bearer test-user-jwt", "content-type": "application/json" },
  body: requestBody()
});

const blockedOrigin = await handler(makeRequest("https://attacker.test"));
if (blockedOrigin.status !== 403) throw new Error("Untrusted browser origin was accepted");
const disabled = await handler(makeRequest());
if (disabled.status !== 503) throw new Error("Kill switch did not keep sending disabled by default");
env.set("META_SEND_ENABLED", "true");
conversationExternalId = "other-account:201234567890";
const mismatchedConnection = await handler(makeRequest());
const mismatchBody = await mismatchedConnection.json();
if (mismatchedConnection.status !== 409 || mismatchBody.error !== "conversation_connection_mismatch" || graphSendCount !== 0 || messageInsertCount !== 0) {
  throw new Error("A conversation was not blocked from sending through the wrong Meta account");
}
conversationExternalId = "123456789012345:201234567890";

const sent = await handler(makeRequest());
const sentBody = await sent.json();
if (sent.status !== 200 || sentBody.status !== "sent" || graphSendCount !== 1) {
  throw new Error("Valid WhatsApp reply did not complete");
}
if (sent.headers.get("access-control-allow-origin") !== "https://app.test") throw new Error("Allowed CORS origin missing");
const providerRequest = calls.find((call) => call.url.hostname === "graph.facebook.com");
if (providerRequest.url.pathname !== "/v26.0/123456789012345/messages") throw new Error("Unexpected WhatsApp Graph endpoint");

const duplicate = await handler(makeRequest());
const duplicateBody = await duplicate.json();
if (duplicate.status !== 200 || !duplicateBody.duplicateRequest || graphSendCount !== 1) {
  throw new Error("Idempotent retry issued a second provider message");
}

lastInboundAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
const expired = await handler(makeRequest());
const expiredBody = await expired.json();
if (expired.status !== 409 || expiredBody.error !== "reply_window_expired_or_unknown" || graphSendCount !== 1) {
  throw new Error("Expired messaging window was not blocked");
}

selectedChannel = "instagram";
conversationExternalId = "ig-account-1:123456789012345";
clientMessageId = "40000000-0000-4000-8000-000000000005";
messageInsertCount = 0;
graphSendCount = 0;
lastInboundAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
const igSent = await handler(makeRequest());
const igSentBody = await igSent.json();
if (igSent.status !== 200 || igSentBody.status !== "sent" || graphSendCount !== 1) {
  throw new Error("Valid Instagram reply did not complete");
}
const igRequest = calls.filter((call) => call.url.hostname === "graph.facebook.com").at(-1);
if (igRequest.url.pathname !== "/v26.0/123456789012345/messages") {
  throw new Error("Unexpected Instagram Graph endpoint");
}

console.log("Meta send smoke tests passed for WhatsApp and Instagram: origin gate, auth path, token decryption, reply window, provider send, idempotent retry.");
