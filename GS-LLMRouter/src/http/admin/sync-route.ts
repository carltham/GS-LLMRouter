import type { ServerResponse } from "node:http";
import { refreshCatalog } from "../../upstream/refresh-catalog.js";
import type { RouteContext } from "../context.js";
import { sendJson } from "../json.js";

export async function handleSync(response: ServerResponse, { config, catalog }: RouteContext): Promise<void> {
  try {
    const count = await refreshCatalog(config, catalog);
    sendJson(response, 200, { synced: count });
  } catch (error) {
    sendJson(response, 502, { error: { message: error instanceof Error ? error.message : "Catalog sync failed", type: "catalog_error" } });
  }
}
