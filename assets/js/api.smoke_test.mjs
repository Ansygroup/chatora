// Offline smoke tests for assets/js/api.js. No external service is contacted.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("./api.js", import.meta.url), "utf8");
let id = 0;

function makeClient({ online = true, fetchImpl, storageThrows = false } = {}) {
  const data = new Map();
  const navigator = { onLine: online, userAgent: "api-smoke-test" };
  const crypto = { randomUUID: () => `00000000-0000-4000-8000-${String(++id).padStart(12, "0")}` };
  const window = {
    CHATORA_CONFIG: {
      SUPABASE_URL: "https://supabase.example.test",
      SUPABASE_ANON_KEY: "public-anon-test-key",
      TIMEOUT_MS: 1000
    },
    crypto,
    addEventListener() {}
  };
  const document = {
    documentElement: { lang: "en" },
    referrer: "",
    title: "API smoke test",
    readyState: "complete",
    addEventListener() {}
  };
  const localStorage = {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) {
      if (storageThrows) throw new Error("storage unavailable");
      data.set(key, String(value));
    }
  };
  const context = {
    window,
    document,
    navigator,
    location: { protocol: "https:", pathname: "/contact.html", search: "?utm_source=smoke" },
    localStorage,
    sessionStorage: { getItem() { return null; }, setItem() {} },
    fetch: fetchImpl || (async () => ({ status: 201, ok: true })),
    crypto,
    URLSearchParams,
    AbortController,
    setTimeout() { return 1; },
    clearTimeout() {},
    console,
    Date,
    JSON,
    Math,
    Promise,
    String,
    Number,
    Object,
    Array,
    Error,
    Uint8Array
  };
  vm.runInNewContext(source, context, { filename: "api.js" });
  return { api: window.ChatoraAPI, data, navigator };
}

// A successful server response is the only online success state.
{
  const client = makeClient();
  const result = await client.api.submitLead({ email: "  Test@Example.com  " });
  assert.equal(result.queued, false);
  assert.equal(client.api.pending(), 0);
}

// Transient server/network failures are queued only when local storage succeeds.
{
  const client = makeClient({ fetchImpl: async () => ({ status: 503, ok: false }) });
  const result = await client.api.submitLead({ email: "retry@example.com" });
  assert.equal(result.queued, true);
  assert.equal(client.api.pending(), 1);
}
{
  const client = makeClient({ fetchImpl: async () => { throw new TypeError("network down"); } });
  const result = await client.api.submitLead({ email: "offline@example.com" });
  assert.equal(result.queued, true);
  assert.equal(client.api.pending(), 1);
}
{
  const client = makeClient({
    fetchImpl: async () => ({ status: 503, ok: false }),
    storageThrows: true
  });
  await assert.rejects(
    () => client.api.submitLead({ email: "not-saved@example.com" }),
    (error) => error.code === "lead_queue_unavailable"
  );
  assert.equal(client.api.pending(), 0);
}

// Permanent 4xx errors are not falsely reported as saved or retried forever.
{
  const client = makeClient({ fetchImpl: async () => ({ status: 403, ok: false }) });
  await assert.rejects(
    () => client.api.submitLead({ email: "rejected@example.com" }),
    (error) => error.status === 403
  );
  assert.equal(client.api.pending(), 0);
}

// Offline queue reports success only when persisted, and never drops older rows.
{
  const client = makeClient({ online: false });
  for (let i = 0; i < 60; i++) {
    const result = await client.api.submitLead({ email: `person${i}@example.com` });
    assert.equal(result.queued, true);
  }
  const queued = JSON.parse(client.data.get("chatora.queue.v1"));
  assert.equal(queued.length, 60);
  assert.equal(queued[0].email, "person0@example.com");
  await assert.rejects(
    () => client.api.submitLead({ email: "person60@example.com" }),
    (error) => error.code === "lead_queue_unavailable"
  );
  assert.equal(client.api.pending(), 60);
}
{
  const client = makeClient({ online: false, storageThrows: true });
  await assert.rejects(
    () => client.api.submitLead({ email: "lost@example.com" }),
    (error) => error.code === "lead_queue_unavailable"
  );
  assert.equal(client.api.pending(), 0);
}

console.log("Chatora API smoke tests passed: success, transient retry, permanent rejection, storage failure, offline queue, and queue-cap preservation.");
