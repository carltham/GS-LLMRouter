import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const appRoot = fileURLToPath(new URL("../../../GS-LLMRouter/", import.meta.url));

let directory: string;
let upstream: Server;
let upstreamPort: number;
let catalogStatus: number;
let child: ChildProcess | undefined;

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve((server.address() as { port: number }).port));
  });
}

async function freePort(): Promise<number> {
  const probe = createServer();
  const port = await listen(probe);
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

function startRouter(port: number): { output: () => string; waitFor: (pattern: RegExp) => Promise<void> } {
  let text = "";
  child = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
    cwd: appRoot,
    env: {
      PATH: process.env.PATH,
      ABACUSAI_GS_EBS_BRAIN_KEY: "test-key",
      ROUTER_ADMIN_TOKEN: "test-admin-token",
      ROUTER_PORT: String(port),
      ROUTER_HOST: "127.0.0.1",
      ROUTER_DB_PATH: join(directory, "router.sqlite"),
      ROUTELLM_BASE_URL: `http://127.0.0.1:${upstreamPort}/v1`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const waiters: Array<{ pattern: RegExp; resolve: () => void }> = [];
  const onData = (chunk: Buffer) => {
    text += chunk.toString("utf8");
    for (const waiter of [...waiters]) {
      if (waiter.pattern.test(text)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve();
      }
    }
  };
  child.stdout!.on("data", onData);
  child.stderr!.on("data", onData);
  return {
    output: () => text,
    waitFor: (pattern) => new Promise<void>((resolve, reject) => {
      if (pattern.test(text)) return resolve();
      waiters.push({ pattern, resolve });
      child!.once("exit", (code) => reject(new Error(`Router exited with ${code}: ${text}`)));
    }),
  };
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "gsllm-entry-"));
  catalogStatus = 200;
  upstream = createServer((incoming, response) => {
    if (incoming.url === "/v1/models") {
      response.writeHead(catalogStatus, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ id: "entry/model", input_price_per_million_tokens: 1, output_price_per_million_tokens: 1 }] }));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  upstreamPort = await listen(upstream);
});

afterEach(async () => {
  if (child && child.exitCode === null) {
    const exited = new Promise((resolve) => child!.once("exit", resolve));
    child.kill();
    await exited;
  }
  child = undefined;
  upstream.closeAllConnections();
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
  await rm(directory, { recursive: true, force: true });
});

describe("server entrypoint", () => {
  it("listens on the configured port and performs the initial catalog sync", async () => {
    const port = await freePort();
    const router = startRouter(port);
    await router.waitFor(/LLM router listening on http:\/\/127\.0\.0\.1:\d+/);
    await router.waitFor(/Synchronized 1 model records/);
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(await health.json()).toEqual({ status: "ok", modelCatalogCount: 1 });
  }, 20_000);

  it("keeps serving and logs the error when the initial catalog sync fails", async () => {
    catalogStatus = 500;
    const port = await freePort();
    const router = startRouter(port);
    await router.waitFor(/LLM router listening/);
    await router.waitFor(/Initial model catalog sync failed: RouteLLM model catalog returned HTTP 500/);
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(await health.json()).toEqual({ status: "ok", modelCatalogCount: 0 });
    expect(router.output()).not.toContain("test-key");
  }, 20_000);
});
