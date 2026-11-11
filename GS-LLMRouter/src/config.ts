import { resolve } from "node:path";

export interface RouterConfig {
  apiKey: string;
  adminToken: string;
  baseUrl: URL;
  databasePath: string;
  port: number;
  host: string;
  blacklist: string[];
  catalogRefreshHours: number;
}

function required(name: string, value: string | undefined): string {
  const result = value?.trim();
  if (!result) throw new Error(`Missing required environment variable: ${name}`);
  return result;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): RouterConfig {
  const portText = env.ROUTER_PORT?.trim() || "8000";
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("ROUTER_PORT must be an integer between 1 and 65535");
  }

  const catalogRefreshHours = Number(env.ROUTER_CATALOG_REFRESH_HOURS?.trim() || "6");
  if (!Number.isFinite(catalogRefreshHours) || catalogRefreshHours < 0.1 || catalogRefreshHours > 168) {
    throw new Error("ROUTER_CATALOG_REFRESH_HOURS must be between 0.1 and 168");
  }

  const baseUrl = new URL(env.ROUTELLM_BASE_URL?.trim() || "https://routellm.abacus.ai/v1");
  if (baseUrl.protocol !== "https:" && baseUrl.hostname !== "localhost" && baseUrl.hostname !== "127.0.0.1") {
    throw new Error("ROUTELLM_BASE_URL must use HTTPS unless it targets localhost");
  }
  baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, "");

  return {
    apiKey: required("ABACUSAI_GS_EBS_BRAIN_KEY", env.ABACUSAI_GS_EBS_BRAIN_KEY),
    adminToken: required("ROUTER_ADMIN_TOKEN", env.ROUTER_ADMIN_TOKEN),
    baseUrl,
    databasePath: resolve(env.ROUTER_DB_PATH?.trim() || "data/router.sqlite"),
    port,
    host: env.ROUTER_HOST?.trim() || "127.0.0.1",
    blacklist: (env.ROUTER_BLACKLIST || "smaug").split(",").map((entry) => entry.trim()).filter(Boolean),
    catalogRefreshHours,
  };
}
