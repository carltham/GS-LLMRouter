# GSAccount TypeScript LLM Router

A development-only, OpenAI-compatible proxy based on `docs/Build Your Own LLM Router.pdf`.
It exposes one client model alias (`route-llm`), applies a small routing heuristic, and forwards
chat-completion requests to Abacus RouteLLM. It is a prototype, not production-ready.

## Safety and current behavior

- A client must request exactly `route-llm`. Other model names are rejected; they are never
  forwarded unchanged.
- The router chooses the upstream model from its own SQLite catalog of RouteLLM models (prices,
  profiles, feedback). Models matching a blacklist pattern (default `smaug`, case-insensitive,
  set via `ROUTER_BLACKLIST` or `/admin/blacklist`) are never selected. The router does not forward
  any model name supplied directly by a client.
- `GET /v1/models` exposes only the `route-llm` alias.
- `POST /v1/chat/completions` supports JSON and streams upstream response bytes, including SSE.
- `GET /health` provides a local health check.
- The listener defaults to `127.0.0.1`; the RouteLLM API key is read from `ABACUSAI_GS_EBS_BRAIN_KEY`.
- Requests are classed complex when the text exceeds 4,000 characters, matches a keyword list
  (debug, refactor, implement, design, analyse, architecture, migrate, security review), or carries
  tools. Complex requests need a model with quality tier 3 or higher. Among eligible models the
  router ranks by recorded success rate, then estimated cost. See `../dev/architecture/`.
- Admin endpoints (`/admin/*`) require `ROUTER_ADMIN_TOKEN` as a bearer token. Sync the catalog with
  `POST /admin/sync`; the catalog is also synced at startup and on an interval (see
  `../dev/architecture/02-components.md`).

The router cannot protect against an upstream service silently changing or falling back to a different
model. Verify model IDs and upstream behavior before relying on this as a hard guarantee.

## Run locally

Requires Node.js 20 or newer. From this directory:

1. Copy `.env.example` to `.env` and set `ABACUSAI_GS_EBS_BRAIN_KEY` and `ROUTER_ADMIN_TOKEN`. Keep
   the real `.env` file private; it is ignored by git.
2. Install dependencies with `npm install`.
3. Start in development mode with environment variables loaded by your shell:

   ```sh
   set -a; . ./.env; set +a
   npm run dev
   ```

4. Configure the compatible client base URL as `http://127.0.0.1:8000/v1` and model as `route-llm`.

For a compiled run, use `npm run build` and then `npm start`, with the same environment variables.

## Test

```sh
npm test
npm run build
```
