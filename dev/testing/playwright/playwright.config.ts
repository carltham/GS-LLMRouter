import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:18765";

export default defineConfig({
  testDir: "./tests",
  testIgnore: "tests/live/**",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "test-results/html-report", open: "never" }]],
  use: {
    baseURL,
    extraHTTPHeaders: { accept: "application/json" },
    trace: "retain-on-failure",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "node test/servers.mjs",
    url: `${baseURL}/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
    stdout: "pipe",
    stderr: "pipe",
  },
  outputDir: "test-results/artifacts",
});
