import { describe, expect, it } from "vitest";
import { loadConfig } from "../../../GS-LLMRouter/src/config.js";

const requiredEnv: NodeJS.ProcessEnv = {
  ABACUSAI_GS_EBS_BRAIN_KEY: "test-key",
  ROUTER_ADMIN_TOKEN: "test-admin-token",
};

describe("loadConfig", () => {
  it("requires non-empty API and admin credentials", () => {
    expect(() => loadConfig({ ROUTER_ADMIN_TOKEN: "admin" })).toThrow(/ABACUSAI_GS_EBS_BRAIN_KEY/);
    expect(() => loadConfig({ ABACUSAI_GS_EBS_BRAIN_KEY: "key" })).toThrow(/ROUTER_ADMIN_TOKEN/);
    expect(() => loadConfig({ ...requiredEnv, ROUTER_ADMIN_TOKEN: "  " })).toThrow(/ROUTER_ADMIN_TOKEN/);
  });

  it("applies defaults and resolves the database path", () => {
    const config = loadConfig(requiredEnv);
    expect(config).toMatchObject({
      apiKey: "test-key",
      adminToken: "test-admin-token",
      baseUrl: new URL("https://routellm.abacus.ai/v1"),
      port: 8000,
      host: "127.0.0.1",
      blacklist: ["smaug"],
      catalogRefreshHours: 6,
    });
    expect(config.databasePath).toMatch(/data[\\/]router\.sqlite$/);
  });

  it("trims and applies supported overrides", () => {
    expect(loadConfig({
      ...requiredEnv,
      ROUTER_PORT: " 9000 ",
      ROUTER_HOST: " 0.0.0.0 ",
      ROUTER_DB_PATH: " /tmp/router.sqlite ",
      ROUTER_BLACKLIST: " a, , B ",
      ROUTER_CATALOG_REFRESH_HOURS: "1.5",
      ROUTELLM_BASE_URL: "https://example.test/v1///",
    })).toMatchObject({
      port: 9000,
      host: "0.0.0.0",
      databasePath: "/tmp/router.sqlite",
      blacklist: ["a", "B"],
      catalogRefreshHours: 1.5,
      baseUrl: new URL("https://example.test/v1"),
    });
  });

  it.each(["0", "65536", "1.1", "NaN", "nope"]) ("rejects invalid port %s", (port) => {
    expect(() => loadConfig({ ...requiredEnv, ROUTER_PORT: port })).toThrow(/ROUTER_PORT/);
  });

  it.each(["0.09", "168.1", "Infinity", "bad"]) ("rejects invalid catalog interval %s", (hours) => {
    expect(() => loadConfig({ ...requiredEnv, ROUTER_CATALOG_REFRESH_HOURS: hours })).toThrow(/ROUTER_CATALOG_REFRESH_HOURS/);
  });

  it("accepts HTTP only for loopback development endpoints", () => {
    expect(loadConfig({ ...requiredEnv, ROUTELLM_BASE_URL: "http://localhost:8080/v1" }).baseUrl.protocol).toBe("http:");
    expect(loadConfig({ ...requiredEnv, ROUTELLM_BASE_URL: "http://127.0.0.1:8080/v1" }).baseUrl.hostname).toBe("127.0.0.1");
    expect(() => loadConfig({ ...requiredEnv, ROUTELLM_BASE_URL: "http://example.com/v1" })).toThrow(/HTTPS/);
  });

  it("rejects malformed base URLs", () => {
    expect(() => loadConfig({ ...requiredEnv, ROUTELLM_BASE_URL: "not a URL" })).toThrow();
  });
});
