import type { IncomingMessage, ServerResponse } from "node:http";
import type { RouterConfig } from "../../config/router-config.js";
import type { DecisionRecord } from "../../catalog/types.js";
import { sendJson } from "../json.js";

const RESPONSE_HEADERS = ["content-type", "cache-control", "x-request-id", "openai-version"] as const;

function copyResponseHeaders(upstream: Response, response: ServerResponse): void {
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) response.setHeader(name, value);
  }
  response.setHeader("x-accel-buffering", "no");
}

/** Sends the rewritten chat request to RouteLLM and streams the answer back to the client. */
export async function forwardToUpstream(
  request: IncomingMessage,
  response: ServerResponse,
  config: RouterConfig,
  decision: DecisionRecord,
  upstreamBody: Record<string, unknown>,
): Promise<void> {
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
  response.setHeader("x-router-decision-id", decision.id);
  response.setHeader("x-router-selected-model", decision.modelId);
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
}
