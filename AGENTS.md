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

- `npm test` runs the TypeScript tests under `../dev/testing/*.test.ts` with `tsx --test`.
- There are no lint, format, or single-test-file scripts defined in `package.json`.
- For local setup and environment loading, follow `GS-LLMRouter/README.md`; keep real credentials in the ignored `.env` file.

## Layout

- `GS-LLMRouter/src/` — router application: catalog, configuration, routing, and HTTP server.
- `GS-LLMRouter/` — application package, TypeScript config, README, and environment example.
- `dev/testing/` — current test files; they are outside the application package directory.
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
- Tests use Node's built-in test runner and strict assertions, executed through `tsx`.
- The current project phase is architecture: do not change application code unless the user asks. Keep architecture docs aligned with the code.
- Record each user message in `dev/COMMAND-HISTORY.md` before acting, newest first, numbered in message order, with at most 100 records; redact secrets as `<redacted-api-key>`.
- Treat committed content as public. Never write, print, or commit credentials; `.env.example` contains placeholders only.
- Do not commit runtime SQLite data under `GS-LLMRouter/data/`.
- Follow `CLAUDE.md` for the full restrictions on Git commands and other project-specific rules.

## Gotchas

- The test files are in `dev/testing/`, not `GS-LLMRouter/test/`; the package test script already points to their current location.
- Runtime configuration is environment-based; see `.env.example` and the application README rather than adding secrets to source or docs.
