import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer as createHttpServer } from "node:http";
import test from "node:test";
import { createRouterServer } from "../src/server.js";

const testConfig = (upstreamPort: number) => ({
  apiKey: "test-key",
  baseUrl: new URL(`http://127.0.0.1:${upstreamPort}/v1`),
  cheapModel: "approved-cheap",
  strongModel: "approved-strong",
  port: 0,
  host: "127.0.0.1",
});

test("only advertises the alias and rejects arbitrary model IDs", async (t) => {
  const upstream = createHttpServer((_request, response) => response.end("unexpected"));
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const upstreamPort = (upstream.address() as { port: number }).port;
  const router = createRouterServer(testConfig(upstreamPort));
  router.listen(0, "127.0.0.1");
  await once(router, "listening");
  t.after(() => {
    router.close();
    upstream.close();
  });
  const address = router.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const models = await fetch(`${baseUrl}/v1/models`);
  assert.deepEqual((await models.json()).data.map((model: { id: string }) => model.id), ["route-llm"]);

  const rejected = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "smaug-flash", messages: [] }),
  });
  assert.equal(rejected.status, 400);
});

test("replaces the alias with a configured model and passes through SSE", async (t) => {
  let receivedModel = "";
  let receivedAuthorization = "";
  const upstream = createHttpServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { model: string };
      receivedModel = body.model;
      receivedAuthorization = request.headers.authorization || "";
      response.writeHead(200, { "content-type": "text/event-stream" });
      response.end("data: {\"ok\":true}\n\n");
    });
  });
  upstream.listen(0, "127.0.0.1");
  await once(upstream, "listening");
  const upstreamPort = (upstream.address() as { port: number }).port;
  const router = createRouterServer(testConfig(upstreamPort));
  router.listen(0, "127.0.0.1");
  await once(router, "listening");
  t.after(() => {
    router.close();
    upstream.close();
  });
  const address = router.address() as { port: number };
  const response = await fetch(`http://127.0.0.1:${address.port}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "route-llm", messages: [{ role: "user", content: "hello" }], stream: true }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.equal(await response.text(), "data: {\"ok\":true}\n\n");
  assert.equal(receivedModel, "approved-cheap");
  assert.equal(receivedAuthorization, "Bearer test-key");
});
