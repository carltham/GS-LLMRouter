import { expect, test } from "@playwright/test";

const adminHeaders = { authorization: "Bearer playwright-test-admin-token" };

test.beforeEach(async ({ request }) => {
  await expect.poll(async () => {
    const response = await request.get("/health");
    if (!response.ok()) return 0;
    return (await response.json()).modelCatalogCount;
  }, { timeout: 10_000 }).toBe(1);
});

test("health and model discovery expose the router's public API", async ({ request }) => {
  const health = await request.get("/health");
  expect(health.ok()).toBeTruthy();
  expect(await health.json()).toEqual({ status: "ok", modelCatalogCount: 1 });

  const models = await request.get("/v1/models");
  expect(models.ok()).toBeTruthy();
  expect(await models.json()).toEqual({
    object: "list",
    data: [{ id: "route-llm", object: "model", owned_by: "local-router" }],
  });
});

test("admin API requires its bearer token and lists the synchronized mock model", async ({ request }) => {
  const unauthorized = await request.get("/admin/models");
  expect(unauthorized.status()).toBe(401);

  const response = await request.get("/admin/models", { headers: adminHeaders });
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toMatchObject({
    data: [
      expect.objectContaining({ id: "mock/provider-model", inputPrice: 2, outputPrice: 10 }),
    ],
    blacklist: ["smaug"],
  });
});

test("chat completions route through the router to the mock AI server", async ({ request }) => {
  const response = await request.post("/v1/chat/completions", {
    data: {
      model: "route-llm",
      messages: [{ role: "user", content: "hello from an external API client" }],
    },
  });

  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-router-selected-model"]).toBe("mock/provider-model");
  expect(response.headers()["x-router-decision-id"]).toBeTruthy();
  expect(await response.json()).toMatchObject({
    model: "mock/provider-model",
    choices: [{ message: { role: "assistant", content: "mock response" } }],
  });
});

test("unknown model names are rejected before reaching the upstream", async ({ request }) => {
  const response = await request.post("/v1/chat/completions", {
    data: { model: "not-the-router-alias", messages: [{ role: "user", content: "hello" }] },
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toMatchObject({ error: { type: "invalid_request_error" } });
});

test("unknown admin paths return not found when authenticated", async ({ request }) => {
  const response = await request.get("/admin/not-a-real-endpoint", { headers: adminHeaders });
  expect(response.status()).toBe(404);
  expect(await response.json()).toMatchObject({ error: { type: "not_found_error" } });
});
