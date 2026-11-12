import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../../..");
const appRoot = join(repoRoot, "GS-LLMRouter");
const routerPort = Number(process.env.PLAYWRIGHT_ROUTER_PORT ?? 18765);
const expectedUpstreamKey = "playwright-test-upstream-key";
const tempDir = await mkdtemp(join(tmpdir(), "gsllm-playwright-"));

const mockUpstream = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/v1/models") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      data: [{
        id: "mock/provider-model",
        name: "Mock Provider Model",
        model_type: "text",
        input_price_per_million_tokens: 1,
        output_price_per_million_tokens: 2,
        context_window: 32768,
        api_formats: ["openai-chat-completions"],
        supports_tools: true,
      }],
    }));
    return;
  }

  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    if (request.headers.authorization !== `Bearer ${expectedUpstreamKey}`) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: "Mock upstream rejected auth" } }));
      return;
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    response.writeHead(200, { "content-type": "application/json", "x-request-id": "mock-upstream-request" });
    response.end(JSON.stringify({
      id: "mock-completion",
      object: "chat.completion",
      model: body.model,
      choices: [{ index: 0, message: { role: "assistant", content: "mock response" }, finish_reason: "stop" }],
    }));
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: { message: "Mock endpoint not found" } }));
});

await new Promise((resolveListen, reject) => {
  mockUpstream.once("error", reject);
  mockUpstream.listen(0, "127.0.0.1", resolveListen);
});
const upstreamPort = mockUpstream.address().port;

const coverageDir = process.env.COVERAGE_DIR;
const coverageArgs = coverageDir ? ["--import", join(here, "coverage-preload.mjs")] : [];
const app = spawn(process.execPath, ["--import", "tsx", ...coverageArgs, "src/server.ts"], {
  cwd: appRoot,
  env: {
    ...process.env,
    ABACUSAI_GS_EBS_BRAIN_KEY: expectedUpstreamKey,
    ROUTER_ADMIN_TOKEN: "playwright-test-admin-token",
    ROUTER_PORT: String(routerPort),
    ROUTER_HOST: "127.0.0.1",
    ROUTER_DB_PATH: join(tempDir, "router.sqlite"),
    ROUTER_BLACKLIST: "smaug",
    ROUTELLM_BASE_URL: `http://127.0.0.1:${upstreamPort}/v1`,
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
  mockUpstream.closeAllConnections();
  await new Promise((resolveClose) => mockUpstream.close(() => resolveClose()));
  await rm(tempDir, { recursive: true, force: true });
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
app.once("exit", async (code) => {
  if (!shuttingDown) {
    console.error(`Router process exited unexpectedly with code ${code}`);
    await shutdown("SIGTERM");
    process.exitCode = 1;
  }
});
