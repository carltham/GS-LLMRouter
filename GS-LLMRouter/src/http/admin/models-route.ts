import type { ServerResponse } from "node:http";
import type { RouteContext } from "../context.js";
import { sendJson } from "../json.js";

export function handleListModels(response: ServerResponse, { catalog }: RouteContext): void {
  sendJson(response, 200, { data: catalog.listModels(), blacklist: catalog.blacklist() });
}
