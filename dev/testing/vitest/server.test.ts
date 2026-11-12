import { createServer, request as httpRequest, type Server, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ModelCatalog, type CatalogModel } from "../../../GS-LLMRouter/src/catalog.js";
import { createRouterServer, refreshCatalog } from "../../../GS-LLMRouter/src/server.js";
import type { RouterConfig } from "../../../GS-LLMRouter/src/config.js";

const ADMIN_TOKEN = "test-admin-token";
const API_KEY = "test-api-key";

function makeModel(overrides: Partial<CatalogModel> = {}): CatalogModel {
  const id = overrides.id ?? "provider/model-alpha";
  return {
    id,
    name: id,
    modelType: "text",
    inputPrice: 1,
    outputPrice: 2,
    contextWindow: 32_000,
    apiFormats: ["openai-chat-completions"],
    toolsSupported: true,
    raw: { id },
    ...overrides,
  };
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  if (!server.listening) return Promise.resolve();
  server.closeAllConnections();
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

let directory: string;
let catalog: ModelCatalog;
let upstream: Server;
let router: Server;
let config: RouterConfig;
let baseUrl: string;
let catalogPayload: unknown;
let catalogStatus: number;
let chatStatus: number;
let chatBody: unknown;
let chatResponseBody: unknown;
let chatAuthorization: string | undefined;
let chatAccept: string | undefined;
let chatMode: "json" | "sse" | "empty" | "drop" | "partial" | "large";
const LARGE_BODY_BYTES = 8 * 1024 * 1024;

async function json(response: Response): Promise<any> {
  return response.json();
}

async function request(path: string, init: RequestInit = {}, authenticated = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (authenticated) headers.set("authorization", `Bearer ${ADMIN_TOKEN}`);
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

async function postJson(path: string, body: unknown, authenticated = true): Promise<Response> {
  return request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }, authenticated);
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "gsllm-http-"));
  catalog = new ModelCatalog(join(directory, "router.sqlite"), ["smaug"]);
  catalog.sync([makeModel()]);
  catalogPayload = { data: [
    { id: "synced/model", name: "Synced", input_price_per_million_tokens: 0.5, output_price_per_million_tokens: 1, context_window: 8000, api_formats: ["openai-chat-completions"], supports_tools: true },
  ] };
  catalogStatus = 200;
  chatStatus = 200;
  chatBody = undefined;
  chatResponseBody = { choices: [{ message: { content: "ok" } }] };
  chatAuthorization = undefined;
  chatAccept = undefined;
  chatMode = "json";

  upstream = createServer(async (incoming: IncomingMessage, response: ServerResponse) => {
    if (incoming.url === "/v1/models") {
      response.writeHead(catalogStatus, { "content-type": "application/json" });
      response.end(JSON.stringify(catalogPayload));
      return;
    }
    if (incoming.url === "/v1/chat/completions") {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      chatBody = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      chatAuthorization = incoming.headers.authorization;
      chatAccept = incoming.headers.accept;
      if (chatMode === "drop") {
        incoming.socket.destroy();
        return;
      }
      if (chatMode === "partial") {
        response.writeHead(200, { "content-type": "text/event-stream" });
        response.write("data: partial\n\n", () => setTimeout(() => incoming.socket.destroy(), 20));
        return;
      }
      if (chatMode === "large") {
        response.writeHead(200, { "content-type": "application/octet-stream" });
        response.end(Buffer.alloc(LARGE_BODY_BYTES, 97));
        return;
      }
      if (chatMode === "empty") {
        response.writeHead(204);
        response.end();
        return;
      }
      if (chatMode === "sse") {
        response.writeHead(chatStatus, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          "x-request-id": "upstream-request",
          "openai-version": "2025-01-01",
          "x-not-forwarded": "private",
        });
        response.end("data: {\"ok\":true}\n\n");
        return;
      }
      response.writeHead(chatStatus, { "content-type": "application/json", "x-request-id": "upstream-request" });
      response.end(JSON.stringify(chatResponseBody));
      return;
    }
    response.writeHead(404);
    response.end();
  });
  await listen(upstream);
  const upstreamPort = (upstream.address() as { port: number }).port;
  config = {
    apiKey: API_KEY,
    adminToken: ADMIN_TOKEN,
    baseUrl: new URL(`http://127.0.0.1:${upstreamPort}/v1`),
    databasePath: join(directory, "router.sqlite"),
    port: 0,
    host: "127.0.0.1",
    blacklist: ["smaug"],
    catalogRefreshHours: 6,
  };
  router = createRouterServer(config, catalog);
  await listen(router);
  baseUrl = `http://127.0.0.1:${(router.address() as { port: number }).port}`;
});

afterEach(async () => {
  await close(router);
  await close(upstream);
  await rm(directory, { recursive: true, force: true });
});

describe("public HTTP endpoints", () => {
  it("returns health with the current available model count", async () => {
    const response = await request("/health", {}, false);
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ status: "ok", modelCatalogCount: 1 });
  });

  it("advertises only the router alias", async () => {
    const response = await request("/v1/models", {}, false);
    expect(await json(response)).toEqual({
      object: "list",
      data: [{ id: "route-llm", object: "model", owned_by: "local-router" }],
    });
  });

  it("returns 404 for unsupported paths and methods", async () => {
    expect((await request("/missing", {}, false)).status).toBe(404);
    expect((await request("/v1/models", { method: "POST" }, false)).status).toBe(404);
  });

  it("rejects malformed, primitive, and oversized completion request bodies", async () => {
    const malformed = await request("/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{broken",
    }, false);
    expect(malformed.status).toBe(400);

    const primitive = await request("/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json" }, body: "[]",
    }, false);
    expect(primitive.status).toBe(400);

    const oversized = await request("/v1/chat/completions", {
      method: "POST", headers: { "content-type": "application/json" }, body: `{"x":"${"x".repeat(10 * 1024 * 1024)}"}`,
    }, false);
    expect(oversized.status).toBe(413);
  });

  it("rejects unknown model aliases without contacting the upstream", async () => {
    const response = await postJson("/v1/chat/completions", { model: "provider/model-alpha", messages: [] }, false);
    expect(response.status).toBe(400);
    expect(chatBody).toBeUndefined();
  });

  it("returns 503 when no model is eligible", async () => {
    catalog.setBlacklistedPattern("provider", true);
    const response = await postJson("/v1/chat/completions", { model: "route-llm", messages: [{ content: "hello" }] }, false);
    expect(response.status).toBe(503);
    expect((await json(response)).error.type).toBe("no_eligible_model");
  });
});

describe("admin authentication and catalog operations", () => {
  it.each([undefined, "Basic test", "Bearer wrong-length", "Bearer wrong-token"])("rejects invalid admin authorization (%s)", async (authorization) => {
    const headers = authorization ? { authorization } : {};
    const response = await fetch(`${baseUrl}/admin/models`, { headers });
    expect(response.status).toBe(401);
  });

  it("lists models and blacklist with a valid token", async () => {
    const response = await request("/admin/models");
    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({ data: [{ id: "provider/model-alpha" }], blacklist: ["smaug"] });
  });

  it("syncs the catalog from the upstream and sends API authorization", async () => {
    const response = await postJson("/admin/sync", {});
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ synced: 1 });
    expect(catalog.listModels()).toEqual([expect.objectContaining({ id: "synced/model", inputPrice: 0.5 })]);
  });

  it.each([
    [503, { data: [] }, /HTTP 503/],
    [200, { data: [] }, /empty or unrecognized/],
    [200, { invalid: true }, /data array/],
  ])("reports sync failure and preserves current catalog", async (status, payload, message) => {
    catalogStatus = status;
    catalogPayload = payload;
    const response = await postJson("/admin/sync", {});
    expect(response.status).toBe(502);
    expect((await json(response)).error.message).toMatch(message);
    expect(catalog.listModels().map(({ id }) => id)).toEqual(["provider/model-alpha"]);
  });

  it("returns 404 for unknown admin routes", async () => {
    expect((await request("/admin/unknown")).status).toBe(404);
  });

  it("closes the catalog cleanly when the server closes", async () => {
    expect(router.listening).toBe(true);
    await close(router);
    expect(router.listening).toBe(false);
    router = createRouterServer(config, new ModelCatalog(join(directory, "second.sqlite"), []));
    await listen(router);
  });
});

describe("admin model profiles and blacklist", () => {
  it("updates a model profile and optional tool capability", async () => {
    const response = await postJson("/admin/profile", { id: "provider/model-alpha", qualityTier: 4, enabled: false, toolsSupported: false });
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ updated: "provider/model-alpha" });
    expect(catalog.listModels()[0]).toMatchObject({ qualityTier: 4, enabled: false, toolsSupported: false });
  });

  it.each([
    {},
    { id: 3, qualityTier: 3, enabled: true },
    { id: "x", qualityTier: 0, enabled: true },
    { id: "x", qualityTier: 6, enabled: true },
    { id: "x", qualityTier: 2.5, enabled: true },
    { id: "x", qualityTier: 2, enabled: "true" },
    { id: "x", qualityTier: 2, enabled: true, toolsSupported: "yes" },
  ])("rejects invalid model profile %#", async (body) => {
    expect((await postJson("/admin/profile", body)).status).toBe(400);
  });

  it.each(["/admin/profile", "/admin/blacklist"])("rejects malformed JSON on %s", async (path) => {
    const response = await request(path, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{oops",
    });
    expect(response.status).toBe(400);
    expect((await json(response)).error.type).toBe("invalid_request_error");
  });

  it("returns 404 when profiling an unavailable model", async () => {
    expect((await postJson("/admin/profile", { id: "missing", qualityTier: 3, enabled: true })).status).toBe(404);
  });

  it("adds and removes a blacklist pattern", async () => {
    const added = await postJson("/admin/blacklist", { pattern: "Vendor", blocked: true });
    expect(added.status).toBe(200);
    expect((await json(added)).blacklist).toEqual(["smaug", "vendor"]);
    const removed = await postJson("/admin/blacklist", { pattern: "vendor", blocked: false });
    expect((await json(removed)).blacklist).toEqual(["smaug"]);
  });

  it.each([{}, { pattern: 4, blocked: true }, { pattern: "x", blocked: "true" }, { pattern: " ", blocked: true }])(
    "rejects invalid blacklist payload %#", async (body) => {
      expect((await postJson("/admin/blacklist", body)).status).toBe(400);
    },
  );
});

describe("admin feedback", () => {
  async function createDecision(): Promise<string> {
    const response = await postJson("/v1/chat/completions", { model: "route-llm", messages: [{ content: "hi" }] }, false);
    expect(response.status).toBe(200);
    return response.headers.get("x-router-decision-id")!;
  }

  it("records feedback once, reports duplicates, and rejects unknown decisions", async () => {
    const decisionId = await createDecision();
    expect((await postJson("/admin/feedback", { decisionId, success: true })).status).toBe(200);
    expect((await postJson("/admin/feedback", { decisionId, success: false })).status).toBe(409);
    expect((await postJson("/admin/feedback", { decisionId: "unknown", success: true })).status).toBe(404);
  });

  it("validates feedback fields and malformed JSON", async () => {
    expect((await postJson("/admin/feedback", { decisionId: "x", success: 1 })).status).toBe(400);
    const response = await request("/admin/feedback", {
      method: "POST", headers: { "content-type": "application/json" }, body: "not-json",
    });
    expect(response.status).toBe(400);
  });
});

describe("chat completion forwarding", () => {
  it("substitutes the selected model, forwards auth/accept, and exposes decision headers", async () => {
    const response = await request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ model: "route-llm", messages: [{ role: "user", content: "hello" }] }),
    }, false);
    expect(response.status).toBe(200);
    expect(chatBody).toMatchObject({ model: "provider/model-alpha" });
    expect(chatAuthorization).toBe(`Bearer ${API_KEY}`);
    expect(chatAccept).toBe("application/json");
    expect(response.headers.get("x-router-selected-model")).toBe("provider/model-alpha");
    expect(response.headers.get("x-router-decision-id")).toBeTruthy();
    expect((await json(response)).choices[0].message.content).toBe("ok");
  });

  it("passes through SSE content and only the allow-listed upstream headers", async () => {
    chatMode = "sse";
    const response = await postJson("/v1/chat/completions", { model: "route-llm", messages: [], stream: true }, false);
    expect(response.headers.get("content-type")).toBe("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.headers.get("x-request-id")).toBe("upstream-request");
    expect(response.headers.get("openai-version")).toBe("2025-01-01");
    expect(response.headers.get("x-not-forwarded")).toBeNull();
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(await response.text()).toBe("data: {\"ok\":true}\n\n");
  });

  it("passes upstream status codes and handles an empty upstream body", async () => {
    chatStatus = 204;
    chatMode = "empty";
    const response = await postJson("/v1/chat/completions", { model: "route-llm", messages: [] }, false);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
  });

  it("waits for drain when a slow client applies backpressure, then delivers the full body", async () => {
    chatMode = "large";
    const port = (router.address() as { port: number }).port;
    const received = await new Promise<number>((resolve, reject) => {
      const outgoing = httpRequest({ host: "127.0.0.1", port, path: "/v1/chat/completions", method: "POST", headers: { "content-type": "application/json" } }, (incoming) => {
        let bytes = 0;
        incoming.pause();
        setTimeout(() => {
          incoming.on("data", (chunk: Buffer) => { bytes += chunk.length; });
          incoming.on("end", () => resolve(bytes));
          incoming.resume();
        }, 200);
      });
      outgoing.on("error", reject);
      outgoing.end(JSON.stringify({ model: "route-llm", messages: [] }));
    });
    expect(received).toBe(LARGE_BODY_BYTES);
  });

  it("destroys the client response when the upstream stream fails mid-body", async () => {
    chatMode = "partial";
    const response = await postJson("/v1/chat/completions", { model: "route-llm", messages: [], stream: true }, false);
    expect(response.status).toBe(200);
    await expect(response.text()).rejects.toThrow();
  });

  it("returns 502 when the upstream connection fails", async () => {
    chatMode = "drop";
    const response = await postJson("/v1/chat/completions", { model: "route-llm", messages: [] }, false);
    expect(response.status).toBe(502);
    expect((await json(response)).error.type).toBe("upstream_error");
  });

  it("propagates an upstream non-success response without rewriting its body", async () => {
    chatStatus = 429;
    chatResponseBody = { error: { message: "rate limited" } };
    const response = await postJson("/v1/chat/completions", { model: "route-llm", messages: [] }, false);
    expect(response.status).toBe(429);
    expect(await json(response)).toEqual(chatResponseBody);
  });
});

describe("refreshCatalog directly", () => {
  it("uses the configured endpoint and API key", async () => {
    const count = await refreshCatalog(config, catalog);
    expect(count).toBe(1);
    expect(catalog.listModels()[0].id).toBe("synced/model");
  });
});
