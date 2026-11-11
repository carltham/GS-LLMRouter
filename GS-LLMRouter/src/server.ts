import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ModelCatalog, parseCatalog } from "./catalog.js";
import { loadConfig, type RouterConfig } from "./config.js";
import { ROUTER_ALIAS, routeRequest, type ChatRequest } from "./routing.js";

const MAX_BODY_BYTES = 10 * 1024 * 1024;
const RESPONSE_HEADERS = ["content-type", "cache-control", "x-request-id", "openai-version"] as const;

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body exceeds 10 MiB");
    chunks.push(buffer);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function isAdmin(request: IncomingMessage, token: string): boolean {
  const authorization = request.headers.authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function copyResponseHeaders(upstream: Response, response: ServerResponse): void {
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) response.setHeader(name, value);
  }
  response.setHeader("x-accel-buffering", "no");
}

export async function refreshCatalog(config: RouterConfig, catalog: ModelCatalog): Promise<number> {
  const response = await fetch(new URL("models", `${config.baseUrl.href}/`), {
    headers: { authorization: `Bearer ${config.apiKey}`, accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`RouteLLM model catalog returned HTTP ${response.status}`);
  const models = parseCatalog(await response.json());
  if (models.length === 0) throw new Error("RouteLLM returned an empty or unrecognized model catalog");
  catalog.sync(models);
  return models.length;
}

export function createRouterServer(
  config: RouterConfig = loadConfig(),
  catalog: ModelCatalog = new ModelCatalog(config.databasePath, config.blacklist),
): ReturnType<typeof createServer> {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url || "/", "http://localhost").pathname;
    if (request.method === "GET" && path === "/health") {
      sendJson(response, 200, { status: "ok", modelCatalogCount: catalog.listModels().length });
      return;
    }

    if (request.method === "GET" && path === "/v1/models") {
      sendJson(response, 200, {
        object: "list",
        data: [{ id: ROUTER_ALIAS, object: "model", owned_by: "local-router" }],
      });
      return;
    }

    if (path.startsWith("/admin/")) {
      if (!isAdmin(request, config.adminToken)) {
        sendJson(response, 401, { error: { message: "Admin bearer token required", type: "authentication_error" } });
        return;
      }

      if (request.method === "GET" && path === "/admin/models") {
        sendJson(response, 200, { data: catalog.listModels(), blacklist: catalog.blacklist() });
        return;
      }

      if (request.method === "POST" && path === "/admin/sync") {
        try {
          const count = await refreshCatalog(config, catalog);
          sendJson(response, 200, { synced: count });
        } catch (error) {
          sendJson(response, 502, { error: { message: error instanceof Error ? error.message : "Catalog sync failed", type: "catalog_error" } });
        }
        return;
      }

      if (request.method === "POST" && path === "/admin/profile") {
        let body: Record<string, unknown>;
        try {
          body = await readJson(request);
        } catch (error) {
          sendJson(response, 400, { error: { message: error instanceof Error ? error.message : "Invalid JSON", type: "invalid_request_error" } });
          return;
        }
        const { id, qualityTier, enabled, toolsSupported } = body;
        if (typeof id !== "string" || typeof qualityTier !== "number" || !Number.isInteger(qualityTier) || qualityTier < 1 || qualityTier > 5 || typeof enabled !== "boolean" || (toolsSupported !== undefined && typeof toolsSupported !== "boolean")) {
          sendJson(response, 400, { error: { message: "Provide id, integer qualityTier (1-5), boolean enabled, and optional boolean toolsSupported", type: "invalid_request_error" } });
          return;
        }
        if (!catalog.profile(id, qualityTier, enabled, toolsSupported as boolean | undefined)) {
          sendJson(response, 404, { error: { message: "Model not found in the current catalog", type: "not_found_error" } });
          return;
        }
        sendJson(response, 200, { updated: id });
        return;
      }

      if (request.method === "POST" && path === "/admin/blacklist") {
        let body: Record<string, unknown>;
        try {
          body = await readJson(request);
        } catch (error) {
          sendJson(response, 400, { error: { message: error instanceof Error ? error.message : "Invalid JSON", type: "invalid_request_error" } });
          return;
        }
        if (typeof body.pattern !== "string" || typeof body.blocked !== "boolean") {
          sendJson(response, 400, { error: { message: "Provide a string pattern and boolean blocked", type: "invalid_request_error" } });
          return;
        }
        try {
          catalog.setBlacklistedPattern(body.pattern, body.blocked);
          sendJson(response, 200, { blacklist: catalog.blacklist() });
        } catch (error) {
          sendJson(response, 400, { error: { message: error instanceof Error ? error.message : "Invalid blacklist pattern", type: "invalid_request_error" } });
        }
        return;
      }

      if (request.method === "POST" && path === "/admin/feedback") {
        let body: Record<string, unknown>;
        try {
          body = await readJson(request);
        } catch (error) {
          sendJson(response, 400, { error: { message: error instanceof Error ? error.message : "Invalid JSON", type: "invalid_request_error" } });
          return;
        }
        if (typeof body.decisionId !== "string" || typeof body.success !== "boolean") {
          sendJson(response, 400, { error: { message: "Provide decisionId and boolean success", type: "invalid_request_error" } });
          return;
        }
        try {
          if (!catalog.addFeedback(body.decisionId, body.success)) {
            sendJson(response, 404, { error: { message: "Decision not found", type: "not_found_error" } });
            return;
          }
          sendJson(response, 200, { recorded: true });
        } catch {
          sendJson(response, 409, { error: { message: "Feedback was already recorded for this decision", type: "conflict_error" } });
        }
        return;
      }

      sendJson(response, 404, { error: { message: "Admin endpoint not found", type: "not_found_error" } });
      return;
    }

    if (request.method !== "POST" || path !== "/v1/chat/completions") {
      sendJson(response, 404, { error: { message: "Not found", type: "not_found_error" } });
      return;
    }

    let body: ChatRequest;
    try {
      body = await readJson(request) as ChatRequest;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid JSON request";
      sendJson(response, message.includes("exceeds") ? 413 : 400, {
        error: { message, type: "invalid_request_error" },
      });
      return;
    }

    if (body.model !== ROUTER_ALIAS) {
      sendJson(response, 400, {
        error: {
          message: `Only model '${ROUTER_ALIAS}' is available through this router`,
          type: "invalid_request_error",
          param: "model",
        },
      });
      return;
    }

    const routed = routeRequest(body, catalog);
    if (!routed) {
      sendJson(response, 503, { error: { message: "No eligible, priced, profiled model is available; refresh the catalog and configure model research profiles", type: "no_eligible_model" } });
      return;
    }
    const upstreamBody = { ...body, model: routed.decision.modelId };
    const controller = new AbortController();
    response.on("close", () => {
      if (!response.writableEnded) controller.abort();
    });

    let upstream: Response;
    try {
      upstream = await fetch(new URL("chat/completions", `${config.baseUrl.href}/`), {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
          accept: typeof request.headers.accept === "string" ? request.headers.accept : "application/json",
        },
        body: JSON.stringify(upstreamBody),
        signal: controller.signal,
      });
    } catch (error) {
      if (!response.headersSent) {
        sendJson(response, 502, {
          error: { message: error instanceof Error ? error.message : "Upstream request failed", type: "upstream_error" },
        });
      }
      return;
    }

    response.statusCode = upstream.status;
    response.setHeader("x-router-decision-id", routed.decision.id);
    response.setHeader("x-router-selected-model", routed.decision.modelId);
    copyResponseHeaders(upstream, response);
    if (!upstream.body) {
      response.end();
      return;
    }

    try {
      for await (const chunk of upstream.body) {
        if (!response.write(Buffer.from(chunk))) {
          await new Promise<void>((resolve) => response.once("drain", resolve));
        }
      }
      response.end();
    } catch {
      if (!response.destroyed) response.destroy();
    }
  });
  server.on("close", () => catalog.close());
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const config = loadConfig();
  const catalog = new ModelCatalog(config.databasePath, config.blacklist);
  const server = createRouterServer(config, catalog);
  server.listen(config.port, config.host, () => {
    console.log(`LLM router listening on http://${config.host}:${config.port}`);
  });
  void refreshCatalog(config, catalog).then((count) => {
    console.log(`Synchronized ${count} model records into the local SQLite catalog`);
  }).catch((error: unknown) => {
    console.error(`Initial model catalog sync failed: ${error instanceof Error ? error.message : "unknown error"}`);
  });
  const refreshTimer = setInterval(() => {
    void refreshCatalog(config, catalog).then((count) => {
      console.log(`Synchronized ${count} model records into the local SQLite catalog`);
    }).catch((error: unknown) => {
      console.error(`Model catalog refresh failed: ${error instanceof Error ? error.message : "unknown error"}`);
    });
  }, config.catalogRefreshHours * 60 * 60 * 1000);
  refreshTimer.unref();
}
