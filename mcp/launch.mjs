import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLocalEnvFile, USER_ENV_KEYS } from "./local-env.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.resolve(process.env.CHATORA_MCP_ENV_FILE || path.join(HERE, ".env"));

async function main() {
  if ((process.argv[2] || "stdio") !== "stdio") {
    console.error("Usage: node launch.mjs [stdio]");
    process.exitCode = 2;
    return;
  }
  try {
    await loadLocalEnvFile({
      envFile: ENV_FILE,
      allowedKeys: USER_ENV_KEYS,
      requiredKeys: USER_ENV_KEYS,
      required: true
    });
    const { runStdio } = await import("./server.mjs");
    await runStdio();
  } catch (error) {
    console.error(`[chatora-mcp] ${error?.message || "Local launch failed."}`);
    process.exitCode = 1;
  }
}

await main();
