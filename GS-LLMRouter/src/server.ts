import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ModelCatalog } from "./catalog/model-catalog.js";
import { loadConfig } from "./config/load-config.js";
import { createRouterServer } from "./http/create-server.js";
import { refreshCatalog } from "./upstream/refresh-catalog.js";

// Process entry point: `node --import tsx src/server.ts` (or `npm run dev` / `npm start`).
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const config = loadConfig();
  const catalog = new ModelCatalog(config.databasePath, config.blacklist);
  const server = createRouterServer(config, catalog);
  server.listen(config.port, config.host, () => {
    console.log(`LLM router listening on http://${config.host}:${config.port}`);
  });
  void refreshCatalog(config, catalog).then((count) => {
    console.log(`Synchronized ${count} model records into the local SQLite catalog`);
  }).catch((error: unknown) => {
    console.error(`Initial model catalog sync failed: ${error instanceof Error ? error.message : "unknown error"}`);
  });
  const refreshTimer = setInterval(() => {
    void refreshCatalog(config, catalog).then((count) => {
      console.log(`Synchronized ${count} model records into the local SQLite catalog`);
    }).catch((error: unknown) => {
      console.error(`Model catalog refresh failed: ${error instanceof Error ? error.message : "unknown error"}`);
    });
  }, config.catalogRefreshHours * 60 * 60 * 1000);
  refreshTimer.unref();
}
