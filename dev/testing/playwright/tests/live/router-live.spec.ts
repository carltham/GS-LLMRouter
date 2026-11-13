import { expect, test } from "@playwright/test";

const adminToken = "live-test-admin-token";
const alias = "route-llm";

test.skip(!process.env.LIVE_ROUTER, "Live suite runs only through npm run test:live");

let headers: { authorization?: string } = {};

test.beforeEach(async ({ request }) => {
  headers = { authorization: `Bearer ${adminToken}` };
  await expect.poll(async () => {
    const response = await request.get("/health");
    if (!response.ok()) return 0;
    return (await response.json()).modelCatalogCount ?? 0;
  }, { message: "Waiting for the initial catalog sync", timeout: 60_000 }).toBeGreaterThan(0);
});

test("health reports the real synced catalog", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(body.modelCatalogCount).toBeGreaterThan(0);
});

test("the router exposes only its alias model", async ({ request }) => {
  const response = await request.get("/v1/models");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.data).toHaveLength(1);
  expect(body.data[0].id).toBe(alias);
});

test("admin sync pulls a non-empty catalog from the real upstream", async ({ request }) => {
  const response = await request.post("/admin/sync", { headers });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.synced).toBeGreaterThan(0);
});

test("admin models lists real models with the live catalog shape", async ({ request }) => {
  const response = await request.get("/admin/models", { headers });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.data.length).toBeGreaterThan(0);
  for (const model of body.data) {
    expect(typeof model.id).toBe("string");
    expect(model.inputPrice === null || typeof model.inputPrice === "number").toBe(true);
  }
  expect(body.data.some((model: { inputPrice: number | null }) => model.inputPrice !== null)).toBe(true);
});

test("chat completion reaches the real upstream and returns a decision", async ({ request }) => {
  const response = await request.post("/v1/chat/completions", {
    data: {
      model: alias,
      messages: [{ role: "user", content: "Reply with the single word: pong" }],
      max_completion_tokens: 64,
    },
    timeout: 90_000,
  });
  expect(response.status()).toBe(200);
  const decisionId = response.headers()["x-router-decision-id"];
  const selected = response.headers()["x-router-selected-model"];
  expect(decisionId).toBeTruthy();
  expect(selected).toBeTruthy();
  const body = await response.json();
  expect(body.model).toBe(selected);
  const choice = body.choices?.[0];
  expect(choice?.message?.role).toBe("assistant");
  expect(typeof choice?.message?.content).toBe("string");
  expect(choice.message.content.length > 0 || choice.finish_reason === "length").toBe(true);
});
