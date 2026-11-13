// Live harness: starts the router pointed at the real RouteLLM upstream.
// The provider key is read from GS-LLMRouter/.env via node --env-file; it is never printed here.
import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../..");
const appRoot = join(repoRoot, "GS-LLMRouter");
const envFile = join(appRoot, ".env");
const routerPort = Number(process.env.PLAYWRIGHT_ROUTER_PORT ?? 18766);
const tempDir = await mkdtemp(join(tmpdir(), "gsllm-live-"));

let envFileOk = false;
try {
  await access(envFile);
  envFileOk = true;
} catch {
  envFileOk = false;
}
if (!envFileOk) {
  console.error(`Live tests need provider credentials in GS-LLMRouter/.env (missing file).`);
  process.exit(1);
}

// The child errors out on its own when the key variable is missing from .env.
const app = spawn(process.execPath, ["--env-file=.env", "--import", "tsx", "src/server.ts"], {
  cwd: appRoot,
  env: {
    ...process.env,
    ROUTER_ADMIN_TOKEN: "live-test-admin-token",
    ROUTER_PORT: String(routerPort),
    ROUTER_HOST: "127.0.0.1",
    ROUTER_DB_PATH: join(tempDir, "router.sqlite"),
    ROUTER_CATALOG_REFRESH_HOURS: "12",
  },
  stdio: "inherit",
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (app.exitCode === null) {
    app.kill(signal === "SIGINT" ? "SIGINT" : "SIGTERM");
    await new Promise((resolveExit) => app.once("exit", resolveExit));
  }
  await rm(tempDir, { recursive: true, force: true });
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
app.once("exit", (code) => {
  if (!shuttingDown) {
    console.error(`Router process exited unexpectedly with code ${code}`);
    process.exitCode = 1;
  }
});
