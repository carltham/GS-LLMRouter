import type { IncomingMessage, ServerResponse } from "node:http";
import type { RouteContext } from "../context.js";
import { readJson, sendJson } from "../json.js";

export async function handleProfile(request: IncomingMessage, response: ServerResponse, { catalog }: RouteContext): Promise<void> {
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
}
