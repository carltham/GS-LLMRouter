import type { ModelCatalog } from "../catalog/model-catalog.js";
import type { RouterConfig } from "../config/router-config.js";

export interface RouteContext {
  config: RouterConfig;
  catalog: ModelCatalog;
}
