import type { IncomingMessage, ServerResponse } from "node:http";
import type { RouteContext } from "../context.js";
import { readJson, sendJson } from "../json.js";

export async function handleBlacklist(request: IncomingMessage, response: ServerResponse, { catalog }: RouteContext): Promise<void> {
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
}
