import type { IncomingMessage, ServerResponse } from "node:http";
import type { RouteContext } from "../context.js";
import { sendJson } from "../json.js";
import { isAdmin } from "./admin-auth.js";
import { handleBlacklist } from "./blacklist-route.js";
import { handleFeedback } from "./feedback-route.js";
import { handleListModels } from "./models-route.js";
import { handleProfile } from "./profile-route.js";
import { handleSync } from "./sync-route.js";

/** Authenticates and dispatches every /admin/* request. */
export async function handleAdminRoute(request: IncomingMessage, response: ServerResponse, path: string, context: RouteContext): Promise<void> {
  if (!isAdmin(request, context.config.adminToken)) {
    sendJson(response, 401, { error: { message: "Admin bearer token required", type: "authentication_error" } });
    return;
  }

  if (request.method === "GET" && path === "/admin/models") return handleListModels(response, context);
  if (request.method === "POST" && path === "/admin/sync") return handleSync(response, context);
  if (request.method === "POST" && path === "/admin/profile") return handleProfile(request, response, context);
  if (request.method === "POST" && path === "/admin/blacklist") return handleBlacklist(request, response, context);
  if (request.method === "POST" && path === "/admin/feedback") return handleFeedback(request, response, context);

  sendJson(response, 404, { error: { message: "Admin endpoint not found", type: "not_found_error" } });
}
