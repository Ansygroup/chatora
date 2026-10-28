import { readFile, stat } from "node:fs/promises";

export const USER_ENV_KEYS = Object.freeze([
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "CHATORA_ACCESS_TOKEN"
]);

export function parseLocalEnv(content, allowedKeys = USER_ENV_KEYS) {
  const allow = new Set(allowedKeys);
  const values = new Map();
  for (const line of String(content).split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const key = match[1];
    if (!allow.has(key)) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    values.set(key, value);
  }
  return values;
}

export async function loadLocalEnvFile({
  envFile,
  env = process.env,
  allowedKeys = USER_ENV_KEYS,
  requiredKeys = [],
  required = false,
  requirePrivatePermissions = true
} = {}) {
  if (!envFile) throw new Error("An env-file path is required.");
  let content;
  let info;
  try {
    [content, info] = await Promise.all([readFile(envFile, "utf8"), stat(envFile)]);
  } catch {
    if (!required) return { loaded: false, values: new Map() };
    throw new Error("Local MCP .env file not found. Copy .env.example to .env and add your values locally.");
  }
  if (requirePrivatePermissions && process.platform !== "win32" && (info.mode & 0o077) !== 0) {
    throw new Error("Local MCP .env permissions are too broad. Restrict the file with chmod 600 before use.");
  }
  const values = parseLocalEnv(content, allowedKeys);
  for (const [key, value] of values) {
    if (!env[key]) env[key] = value;
  }
  for (const key of requiredKeys) {
    if (!String(env[key] || "").trim()) throw new Error(`Local MCP .env is missing ${key}.`);
  }
  return { loaded: true, values };
}
