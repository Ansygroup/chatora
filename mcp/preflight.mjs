import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { getSupabaseConfig, verifySupabaseAccessToken } from "./server.mjs";
import { loadLocalEnvFile, USER_ENV_KEYS } from "./local-env.mjs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TABLES = ["contacts", "flows", "conversations"];

function parseJwtPayload(token) {
  try {
    const segment = String(token).split(".")[1];
    return segment ? JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) : null;
  } catch {
    return null;
  }
}

function validateEnvironment(env) {
  const missing = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "CHATORA_ACCESS_TOKEN"].filter((key) => !String(env[key] || "").trim());
  if (missing.length) {
    return { ok: false, message: `Missing required local environment variables: ${missing.join(", ")}.` };
  }
  try {
    const config = getSupabaseConfig({ supabaseUrl: env.SUPABASE_URL, supabaseAnonKey: env.SUPABASE_ANON_KEY });
    const token = String(env.CHATORA_ACCESS_TOKEN).trim();
    if (token.length < 20 || token.length > 16_384) return { ok: false, message: "CHATORA_ACCESS_TOKEN is malformed or too long." };
    if (["service_role", "supabase_admin"].includes(parseJwtPayload(token)?.role)) {
      return { ok: false, message: "A service-role/admin credential cannot be used as a user token." };
    }
    return { ok: true, config, token };
  } catch (error) {
    return { ok: false, message: error?.message || "Supabase local configuration is invalid." };
  }
}

function authHeaders(config, token) {
  return {
    apikey: config.anonKey,
    Authorization: `Bearer ${token}`,
    Accept: "application/json"
  };
}

async function verifyOwnedWorkspaces(config, token, userId, fetchImpl) {
  const url = new URL("/rest/v1/workspaces", config.baseUrl);
  url.searchParams.set("select", "id,owner");
  url.searchParams.set("owner", `eq.${userId}`);
  url.searchParams.set("limit", "21");
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: authHeaders(config, token),
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new Error("Could not reach the workspace API.");
  }
  if (!response.ok) throw new Error(`Workspace query failed (HTTP ${response.status}); verify the table, ownership policy, and RLS.`);
  let rows;
  try { rows = await response.json(); } catch { throw new Error("Workspace query returned invalid JSON."); }
  if (!Array.isArray(rows)) throw new Error("Workspace query returned an unexpected shape.");
  const owned = rows.filter((row) => UUID_RE.test(row?.id || "") && row?.owner === userId);
  if (owned.length !== rows.length) throw new Error("Workspace ownership check did not match the signed-in user.");
  if (owned.length > 20) throw new Error("The local preflight supports at most 20 owned workspaces.");
  return owned;
}

async function countTable(config, token, table, workspaceId, fetchImpl) {
  const url = new URL(`/rest/v1/${table}`, config.baseUrl);
  url.searchParams.set("select", "id");
  url.searchParams.set("workspace_id", `eq.${workspaceId}`);
  let response;
  try {
    response = await fetchImpl(url, {
      method: "HEAD",
      headers: { ...authHeaders(config, token), Prefer: "count=exact", Range: "0-0" },
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new Error(`Could not reach the ${table} table.`);
  }
  if (!response.ok) throw new Error(`${table} count failed (HTTP ${response.status}); verify the table and RLS.`);
  const range = response.headers.get("content-range") || "";
  const match = range.match(/\/(\d+|\*)$/);
  if (!match || match[1] === "*") throw new Error(`${table} count did not include an exact Content-Range.`);
  return Number(match[1]);
}

export async function runLivePreflight({ env = process.env, fetchImpl = fetch, write = console.log } = {}) {
  const checked = validateEnvironment(env);
  if (!checked.ok) throw new Error(checked.message);

  const user = await verifySupabaseAccessToken(checked.token, checked.config, fetchImpl);
  const workspaces = await verifyOwnedWorkspaces(checked.config, checked.token, user.id, fetchImpl);
  write("Supabase user-token verification: OK (user ID not printed).");
  write(`Owned workspace rows: ${workspaces.length}. No workspace names or IDs are printed.`);

  if (workspaces.length === 0) {
    write("No owned workspace was found; child-table checks were skipped. No workspace was created.");
    return { userVerified: true, workspaces: 0, counts: [] };
  }

  const counts = [];
  for (let index = 0; index < workspaces.length; index += 1) {
    const workspace = workspaces[index];
    const tableCounts = {};
    for (const table of TABLES) tableCounts[table] = await countTable(checked.config, checked.token, table, workspace.id, fetchImpl);
    counts.push(tableCounts);
    write(`Workspace ${index + 1}: contacts=${tableCounts.contacts}, flows=${tableCounts.flows}, conversations=${tableCounts.conversations}.`);
  }
  write("All checks were read-only. No rows were inserted, updated, deleted, or printed.");
  write("These requests used the user's JWT and public key; they do not prove that RLS is enabled for every table.");
  return { userVerified: true, workspaces: workspaces.length, counts };
}

function usage() {
  return [
    "Chatora MCP Supabase preflight (read-only)",
    "  node preflight.mjs --config       Validate local environment only; no network calls.",
    "  node preflight.mjs --verify-live  Explicitly call Supabase Auth and read-only PostgREST checks.",
    "  node preflight.mjs --help"
  ].join("\n");
}

async function loadPreflightEnvironment() {
  await loadLocalEnvFile({
    envFile: fileURLToPath(new URL("./.env", import.meta.url)),
    env: process.env,
    allowedKeys: USER_ENV_KEYS,
    required: false
  });
}

async function main() {
  const mode = process.argv[2] || "--help";
  if (mode === "--help" || mode === "-h") {
    console.log(usage());
    return;
  }
  if (mode === "--config" || mode === "--verify-live") {
    try {
      await loadPreflightEnvironment();
    } catch (error) {
      console.error(error?.message || "Local MCP environment could not be loaded.");
      process.exitCode = 2;
      return;
    }
  }
  if (mode === "--config") {
    const checked = validateEnvironment(process.env);
    if (!checked.ok) {
      console.error(checked.message);
      process.exitCode = 2;
      return;
    }
    console.log("Local environment is present and structurally valid. No network calls were made and no values were printed.");
    return;
  }
  if (mode === "--verify-live") {
    try {
      await runLivePreflight();
    } catch (error) {
      console.error(`Read-only Supabase preflight failed: ${error?.message || "request failed"}`);
      process.exitCode = 1;
    }
    return;
  }
  console.error(usage());
  process.exitCode = 2;
}

const entryPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entryPath === import.meta.url) await main();
