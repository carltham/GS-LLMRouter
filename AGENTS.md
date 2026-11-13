# Project instructions

## Project

GS-LLMRouter is a development-only OpenAI-compatible proxy, written in TypeScript for Node.js. The application is in `GS-LLMRouter/`; consult `CLAUDE.md` for the project-specific scope, Git, secrets, and documentation rules.

## Commands

Run these from `GS-LLMRouter/`:

```sh
npm run build
npm test
npm run dev
npm start
```

- `npm test` runs the Vitest suite configured in `../dev/testing/vitest/vitest.config.ts`.
- `npm run test:watch` starts Vitest in watch mode; `npm run test:coverage` writes text, HTML, and LCOV coverage reports under `dev/testing/vitest/coverage/`.
- External API tests use the separate Playwright package: from the repository root run `cd dev/testing/playwright && npm test`. Playwright starts the router and mock upstream server itself. Add coverage with `npm run test:coverage` (Istanbul-instrumented router, HTML report in `dev/testing/playwright/coverage/index.html`). Live tests against the real RouteLLM upstream run with `npm run test:live`; the provider key comes from `GS-LLMRouter/.env` and the chat test spends a small amount of real credits.
- There are no lint, format, or single-test-file scripts defined in `package.json`.
- For local setup and environment loading, follow `GS-LLMRouter/README.md`; keep real credentials in the ignored `.env` file.

## Layout

- `GS-LLMRouter/src/` — router application, grouped by concern: `catalog/` (parsing, SQLite schema, blacklist, sync, profiles, selection, feedback, `ModelCatalog` facade), `config/`, `routing/` (complexity, token estimates, `routeRequest`), `http/` (server, public, admin and chat routes), `upstream/` (catalog refresh), and `server.ts` (process entry point).
- `GS-LLMRouter/` — application package, TypeScript config, README, and environment example.
- `dev/testing/vitest/` — source-level Vitest tests and their coverage output.
- `dev/testing/playwright/` — standalone Playwright package for external, black-box API tests.
- `dev/evaluation/` — standalone model-quality and routing-quality evaluation cases, scoring rules, runner, and ignored result reports. Live evaluation commands and credit implications are documented in its README.
- `dev/architecture/` — architecture documentation that should remain consistent with implementation.
- `dev/planning/`, `dev/tickets/`, `dev/TODO.md` — planning and issue tracking.

## User-approved operating rules

- Don’t change project files unless explicitly asked.
- Don’t treat a question as permission to change code or setup.
- Ask before installing dependencies or changing manifests, lockfiles, scripts, or configuration.
- Preserve unrelated working-tree changes.
- Stop immediately when asked to stop.
- Follow repository instructions.
- Verify changes before claiming they’re complete.

## Conventions and scope


- Keep TypeScript in strict mode and preserve the existing Node.js ESM import style (relative source imports use `.js` extensions).
- Tests use Vitest; keep test files under `dev/testing/vitest/` and use Vitest's `describe`, `it`, and `expect` APIs.
- The current project phase is architecture: do not change application code unless the user asks. Keep architecture docs aligned with the code.
- Record each user message in `dev/COMMAND-HISTORY.md` before acting, newest first, numbered in message order, with at most 100 records; redact secrets as `<redacted-api-key>`.
- Treat committed content as public. Never write, print, or commit credentials; `.env.example` contains placeholders only.
- Do not commit runtime SQLite data under `GS-LLMRouter/data/`.
- Follow `CLAUDE.md` for the full restrictions on Git commands and other project-specific rules.

## Gotchas

- Vitest configuration and tests live in `dev/testing/vitest/`; run the test scripts from `GS-LLMRouter/` so the configured repository-root paths resolve correctly.
- Runtime configuration is environment-based; see `.env.example` and the application README rather than adding secrets to source or docs.
