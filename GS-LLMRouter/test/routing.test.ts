import assert from "node:assert/strict";
import test from "node:test";
import { selectModel } from "../src/routing.js";

test("routes ordinary text to the configured cheap model", () => {
  assert.equal(selectModel({ messages: [{ role: "user", content: "hello" }] }, "cheap", "strong"), "cheap");
});

test("routes long text, refactor requests, and tool calls to the configured strong model", () => {
  assert.equal(selectModel({ messages: [{ content: "x".repeat(4001) }] }, "cheap", "strong"), "strong");
  assert.equal(selectModel({ messages: [{ content: "Please REFACTOR this" }] }, "cheap", "strong"), "strong");
  assert.equal(selectModel({ messages: [{ content: "hello" }], tools: [{ type: "function" }] }, "cheap", "strong"), "strong");
});
