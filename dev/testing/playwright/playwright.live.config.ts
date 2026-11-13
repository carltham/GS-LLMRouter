import { defineConfig } from "@playwright/test";

process.env.LIVE_ROUTER = "1";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:18766";

export default defineConfig({
  testDir: "./tests/live",
  timeout: 120_000,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { outputFolder: "test-results/live-html-report", open: "never" }]],
  use: {
    baseURL,
    extraHTTPHeaders: { accept: "application/json" },
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "node test/servers-live.mjs",
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    stdout: "pipe",
    stderr: "pipe",
  },
  outputDir: "test-results/live-artifacts",
});
