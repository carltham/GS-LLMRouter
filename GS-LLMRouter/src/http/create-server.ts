import { createServer } from "node:http";
import { ModelCatalog } from "../catalog/model-catalog.js";
import { loadConfig } from "../config/load-config.js";
import type { RouterConfig } from "../config/router-config.js";
import { handleAdminRoute } from "./admin/admin-router.js";
import { handleChatCompletion } from "./chat/chat-route.js";
import { sendJson } from "./json.js";
import { handlePublicRoute } from "./public-routes.js";

export function createRouterServer(
  config: RouterConfig = loadConfig(),
  catalog: ModelCatalog = new ModelCatalog(config.databasePath, config.blacklist),
): ReturnType<typeof createServer> {
  const context = { config, catalog };
  const server = createServer(async (request, response) => {
    const path = new URL(request.url || "/", "http://localhost").pathname;
    if (handlePublicRoute(request, response, path, context)) return;

    if (path.startsWith("/admin/")) {
      await handleAdminRoute(request, response, path, context);
      return;
    }

    if (request.method !== "POST" || path !== "/v1/chat/completions") {
      sendJson(response, 404, { error: { message: "Not found", type: "not_found_error" } });
      return;
    }

    await handleChatCompletion(request, response, context);
  });
  server.on("close", () => catalog.close());
  return server;
}
