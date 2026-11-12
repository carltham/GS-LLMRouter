import type { IncomingMessage, ServerResponse } from "node:http";
import { ROUTER_ALIAS } from "../routing/types.js";
import type { RouteContext } from "./context.js";
import { sendJson } from "./json.js";

/** Handles GET /health and GET /v1/models. Returns true when the request was answered. */
export function handlePublicRoute(request: IncomingMessage, response: ServerResponse, path: string, { catalog }: RouteContext): boolean {
  if (request.method === "GET" && path === "/health") {
    sendJson(response, 200, { status: "ok", modelCatalogCount: catalog.listModels().length });
    return true;
  }

  if (request.method === "GET" && path === "/v1/models") {
    sendJson(response, 200, {
      object: "list",
      data: [{ id: ROUTER_ALIAS, object: "model", owned_by: "local-router" }],
    });
    return true;
  }

  return false;
}
