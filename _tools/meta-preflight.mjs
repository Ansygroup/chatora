#!/usr/bin/env node
// Static, offline Meta release preflight. It never reads secrets, contacts
// Supabase/Meta, applies SQL, changes feature flags, or deploys functions.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const findings = [];
const check = (status, label, detail) => findings.push({ status, label, detail });
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

let publicConfig = null;
try {
  const context = { window: {} };
  vm.runInNewContext(read("assets/js/config.js"), context, { filename: "config.js", timeout: 1000 });
  publicConfig = context.window.CHATORA_CONFIG || null;
} catch {
  check("BLOCKED", "Public config", "Could not parse assets/js/config.js.");
}

if (publicConfig) {
  const urlValid = (() => {
    try { return new URL(publicConfig.SUPABASE_URL).protocol === "https:"; }
    catch { return false; }
  })();
  check(urlValid && !!publicConfig.SUPABASE_ANON_KEY ? "PASS" : "BLOCKED", "Supabase browser config", urlValid && publicConfig.SUPABASE_ANON_KEY ? "HTTPS URL and anon key are present." : "Missing HTTPS URL or anon key.");

  const publicIds = [
    ["Meta App ID", publicConfig.META_APP_ID],
    ["WhatsApp Embedded Signup v4 Config ID", publicConfig.META_WHATSAPP_CONFIG_ID],
    ["Instagram Facebook Login for Business Config ID", publicConfig.META_INSTAGRAM_CONFIG_ID]
  ];
  for (const [label, value] of publicIds) {
    const valid = typeof value === "string" && /^\d{5,32}$/.test(value);
    check(valid ? "PASS" : "BLOCKED", label, valid ? "Present and syntactically valid." : "Missing or not a numeric Meta ID; connect controls must remain disabled.");
  }

  const providerValid = ["tech_provider", "solution_partner"].includes(publicConfig.META_WHATSAPP_PROVIDER_TYPE);
  check(providerValid ? "PASS" : "BLOCKED", "WhatsApp provider mode", providerValid ? `Selected locally: ${publicConfig.META_WHATSAPP_PROVIDER_TYPE}. This does not verify Meta approval.` : "Set an explicit supported provider mode.");
  const graphVersionValid = /^v\d+\.\d+$/.test(String(publicConfig.META_GRAPH_API_VERSION || ""));
  check(graphVersionValid ? "PASS" : "BLOCKED", "Graph API version", graphVersionValid ? "Version string is syntactically valid; verify it against Meta before release." : "Missing or invalid version string.");
  check(publicConfig.META_SEND_ENABLED === false ? "PASS" : "BLOCKED", "Public outbound-send gate", publicConfig.META_SEND_ENABLED === false ? "Off; this is a UI gate only." : "Expected explicit false in this local scaffold.");
}

const publicFiles = [
  "assets/js/config.js", "assets/js/auth.js", "assets/js/app.js",
  "assets/js/meta-onboarding.js", "assets/js/meta-send-client.js", "_pages/app.html"
];
const secretNames = [
  "META_APP_SECRET", "SUPABASE_SERVICE_ROLE_KEY", "CHANNEL_TOKEN_ENCRYPTION_KEY",
  "META_WEBHOOK_ENCRYPTION_KEY", "META_SYSTEM_USER_ACCESS_TOKEN", "META_REPLAY_CRON_SECRET",
  "META_RETENTION_CRON_SECRET"
];
let publicScanOk = true;
for (const relative of publicFiles) {
  const source = read(relative);
  for (const name of secretNames) {
    const assignment = new RegExp(`(?:window\\.)?${name}\\s*(?::|=)\\s*[\\"'\\x60][^\\"'\\x60]+`, "m");
    if (assignment.test(source)) {
      publicScanOk = false;
      check("BLOCKED", "Browser secret scan", `A non-empty assignment for ${name} was found in ${relative}.`);
    }
  }
}
if (publicScanOk) check("PASS", "Browser secret scan", "No non-empty secret assignments found in inspected browser files.");

const expectedJwt = {
  "meta-connect": "true",
  "meta-send": "true",
  "meta-webhook": "false",
  "meta-replay": "false",
  "meta-retention": "false"
};
const supabaseConfig = read("supabase/config.toml");
for (const [name, expected] of Object.entries(expectedJwt)) {
  const section = new RegExp(`\\[functions\\.${name}\\]([\\s\\S]*?)(?=\\n\\[|$)`).exec(supabaseConfig)?.[1] || "";
  const actual = /^\s*verify_jwt\s*=\s*(true|false)\s*$/m.exec(section)?.[1] || "missing";
  check(actual === expected ? "PASS" : "BLOCKED", `JWT policy: ${name}`, actual === expected ? `verify_jwt = ${actual}.` : `Expected verify_jwt = ${expected}; found ${actual}.`);
}

const connectSource = read("supabase/functions/meta-connect/index.ts");
const sendSource = read("supabase/functions/meta-send/index.ts");
check(connectSource.includes('Deno.env.get("META_ONBOARDING_ENABLED") !== "true"') ? "PASS" : "BLOCKED", "Onboarding kill switch", "The Edge Function must require the exact server value true.");
check(sendSource.includes('Deno.env.get("META_SEND_ENABLED") !== "true"') ? "PASS" : "BLOCKED", "Server send kill switch", "The Edge Function must require the exact server value true.");
check(read("supabase/functions/meta-replay/index.ts").includes("META_REPLAY_CRON_SECRET") ? "PASS" : "BLOCKED", "Replay scheduler guard", "The private replay endpoint must require its separate bearer secret.");
check(read("supabase/functions/meta-retention/index.ts").includes("META_RETENTION_CRON_SECRET") ? "PASS" : "BLOCKED", "Retention scheduler guard", "The retention endpoint must require its separate bearer secret.");

const migration = read("supabase/migrations/20261027_meta_channel_scaffold.sql");
const migrationChecks = [
  ["Encrypted connection-token table", /CREATE TABLE IF NOT EXISTS public\.channel_connection_secrets/],
  ["Private webhook inbox", /CREATE TABLE IF NOT EXISTS public\.meta_webhook_inbox/],
  ["Atomic webhook claim RPC", /CREATE OR REPLACE FUNCTION public\.chatora_claim_meta_webhook_events/],
  ["Service-role-only RPC grant", /GRANT EXECUTE ON FUNCTION public\.chatora_claim_meta_webhook_events\(integer, integer\) TO service_role/],
  ["RLS enabled on connection secrets", /ALTER TABLE public\.channel_connection_secrets ENABLE ROW LEVEL SECURITY/]
];
for (const [label, pattern] of migrationChecks) {
  check(pattern.test(migration) ? "PASS" : "BLOCKED", `Migration scaffold: ${label}`, pattern.test(migration) ? "Found in the proposed migration." : "Missing from the proposed migration.");
}

const requiredTests = [
  "supabase/functions/meta-connect/smoke_test.mjs",
  "supabase/functions/meta-webhook/smoke_test.mjs",
  "supabase/functions/meta-send/smoke_test.mjs",
  "assets/js/meta-send-client.smoke_test.mjs",
  "supabase/functions/meta-replay/smoke_test.mjs",
  "supabase/functions/meta-retention/smoke_test.mjs"
];
for (const relative of requiredTests) {
  check(fs.existsSync(path.join(root, relative)) ? "PASS" : "BLOCKED", `Local test: ${relative}`, fs.existsSync(path.join(root, relative)) ? "Test file exists; run it separately for current results." : "Test file is missing.");
}

check("NOTE", "Remote release state", "This offline check does not query Supabase or Meta and cannot confirm migration/deployment state, approval, credentials, domains, permissions, or scheduled jobs.");

let blockers = 0;
for (const item of findings) {
  if (item.status === "BLOCKED") blockers++;
  console.log(`[${item.status}] ${item.label} — ${item.detail}`);
}
console.log(`\nPreflight result: ${blockers ? `BLOCKED (${blockers} item${blockers === 1 ? "" : "s"})` : "LOCAL CHECKS PASSED"}.`);
console.log("No network calls, secret reads, migration applications, deployments, or sends were performed.");
if (blockers) process.exitCode = 2;
