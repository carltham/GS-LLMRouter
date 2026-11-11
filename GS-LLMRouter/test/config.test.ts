import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

const baseEnv: NodeJS.ProcessEnv = {
  ABACUSAI_GS_EBS_BRAIN_KEY: "test-key",
  ROUTER_ADMIN_TOKEN: "test-admin-token",
  ROUTER_CHEAP_MODEL: "approved-cheap",
  ROUTER_STRONG_MODEL: "approved-strong",
};

test("rejects Smaug in either configured model slot", () => {
  assert.throws(() => loadConfig({ ...baseEnv, ROUTER_CHEAP_MODEL: "Smaug-Flash" }), /blocked identifier/);
  assert.throws(() => loadConfig({ ...baseEnv, ROUTER_STRONG_MODEL: "vendor-smaug-v2" }), /blocked identifier/);
});

test("accepts configured models that do not contain the blocked identifier", () => {
  const config = loadConfig(baseEnv);
  assert.equal(config.cheapModel, "approved-cheap");
  assert.equal(config.strongModel, "approved-strong");
});
