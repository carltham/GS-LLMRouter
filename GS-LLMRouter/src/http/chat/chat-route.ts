import type { IncomingMessage, ServerResponse } from "node:http";
import { routeRequest } from "../../routing/route-request.js";
import { ROUTER_ALIAS, type ChatRequest } from "../../routing/types.js";
import type { RouteContext } from "../context.js";
import { readJson, sendJson } from "../json.js";
import { forwardToUpstream } from "./forward-upstream.js";

/** Handles POST /v1/chat/completions: validate, pick a model, forward upstream. */
export async function handleChatCompletion(request: IncomingMessage, response: ServerResponse, { config, catalog }: RouteContext): Promise<void> {
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
  await forwardToUpstream(request, response, config, routed.decision, { ...body, model: routed.decision.modelId });
}
