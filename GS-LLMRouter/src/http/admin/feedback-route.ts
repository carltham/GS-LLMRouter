import type { IncomingMessage, ServerResponse } from "node:http";
import type { RouteContext } from "../context.js";
import { readJson, sendJson } from "../json.js";

export async function handleFeedback(request: IncomingMessage, response: ServerResponse, { catalog }: RouteContext): Promise<void> {
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
}
