// Node smoke test for the account-delete Edge Function (no live network calls).
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const env = new Map();
let handler;
const calls = [];
let passwordOk = true;
const USER = { id: "11111111-1111-4111-8111-111111111111", email: "owner@example.test" };

const fetchMock = async (input, init = {}) => {
  const url = new URL(String(input));
  calls.push({ url, init });
  if (url.pathname === "/auth/v1/user") {
    return init.headers.Authorization === "Bearer good-token"
      ? new Response(JSON.stringify(USER), { status: 200 })
      : new Response("{}", { status: 401 });
  }
  if (url.pathname === "/auth/v1/token") {
    const body = JSON.parse(init.body);
    assert.equal(body.email, USER.email);
    return passwordOk && body.password === "correct horse"
      ? new Response(JSON.stringify({ user: { id: USER.id } }), { status: 200 })
      : new Response("{}", { status: 400 });
  }
  if (url.pathname === `/auth/v1/admin/users/${USER.id}`) {
    assert.equal(init.method, "DELETE");
    assert.equal(init.headers.apikey, "service-key");
    return new Response("{}", { status: 200 });
  }
  throw new Error("Unexpected fetch " + url.pathname);
};

const source = await readFile(new URL("./index.ts", import.meta.url), "utf8");
vm.runInNewContext(source, {
  Deno: { env: { get: (k) => env.get(k) || "" }, serve: (fn) => { handler = fn; } },
  fetch: fetchMock, URL, Request, Response, Headers, TextDecoder, TextEncoder, Uint8Array,
  Number, String, Object, JSON, console: { error() {} }
}, { filename: "account-delete.js" });

const post = (body, token = "good-token") => handler(new Request("https://edge.test/account-delete", {
  method: "POST",
  headers: Object.assign({ "content-type": "application/json" }, token ? { authorization: "Bearer " + token } : {}),
  body: JSON.stringify(body)
}));

assert.equal((await post({ confirm: "DELETE", password: "x" })).status, 503, "must refuse when unconfigured");
env.set("SUPABASE_URL", "https://supabase.example.test");
env.set("SUPABASE_SERVICE_ROLE_KEY", "service-key");
env.set("SUPABASE_ANON_KEY", "anon-key");

assert.equal((await handler(new Request("https://edge.test/account-delete"))).status, 405);
assert.equal((await post({ confirm: "DELETE", password: "x" }, "")).status, 401);
assert.equal((await post({ password: "correct horse" })).status, 400, "explicit confirmation required");
assert.equal((await post({ confirm: "DELETE" })).status, 400, "password required");
assert.equal((await post({ confirm: "DELETE", password: "x" }, "bad-token")).status, 401);
assert.ok(!calls.some((c) => c.url.pathname.includes("/admin/")), "nothing deleted so far");

assert.equal((await post({ confirm: "DELETE", password: "wrong" })).status, 403);
assert.ok(!calls.some((c) => c.url.pathname.includes("/admin/")), "wrong password must not delete");

const ok = await post({ confirm: "DELETE", password: "correct horse" });
assert.equal(ok.status, 200);
assert.deepEqual(await ok.json(), { deleted: true });
assert.equal(calls.filter((c) => c.url.pathname.includes("/admin/users/")).length, 1);

const foreign = await handler(new Request("https://edge.test/account-delete", {
  method: "POST", headers: { origin: "https://evil.example", authorization: "Bearer good-token" },
  body: JSON.stringify({ confirm: "DELETE", password: "correct horse" })
}));
assert.equal(foreign.status, 403, "unknown origins are rejected");

console.log("account-delete smoke tests passed (no live network calls).");
