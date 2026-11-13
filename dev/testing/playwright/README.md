# External API tests

This package tests the router strictly through HTTP. It does not import application source modules.

## Run

```sh
npm install
npm test
```

The Playwright `webServer` starts `test/servers.mjs`, which starts a deterministic mock RouteLLM HTTP server and launches the router as a separate Node.js process. The router uses a temporary SQLite database and test-only credentials. Both processes and the temporary database are cleaned up after the test run.

To target a router that is already running instead, set `PLAYWRIGHT_BASE_URL` and run `npm test`. In that mode Playwright does not start the local mock or router; the target must be configured to use a compatible mock upstream if completion forwarding is being tested.

No browser binaries are needed for these API-only tests; Playwright's request fixture exercises the public HTTP API.

## Code coverage

```bash
npm run test:coverage
```

Playwright's built-in coverage only covers browser JavaScript, so this runs the router with Istanbul instrumentation instead. `test/coverage-preload.mjs` and `test/coverage-loader.mjs` are loaded into the router process when `COVERAGE_DIR` is set. The loader transpiles and instruments `GS-LLMRouter/src/**` with a source map, and the counters are written when Playwright stops the router. `nyc report` then prints a text summary and writes the HTML report to `coverage/index.html` in this folder. The app source and its `package.json` are not changed.

## Live tests against the real AI service

```bash
npm run test:live
```

`tests/live/router-live.spec.ts` runs the same router against the real RouteLLM upstream instead of the mock. The provider key is read from `GS-LLMRouter/.env` through `node --env-file`; it is never copied into this package. The chat test sends one short completion capped at 16 output tokens, which spends a small amount of real credits. The offline `npm test` suite stays mock-only and untouched. To target a router you started yourself, set `PLAYWRIGHT_BASE_URL` and run `npm run test:live`.
