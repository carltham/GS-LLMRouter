# Dependencies and environment

Status: draft for review.

## Runtime

- Node.js 20 or newer. The current machine runs Node 22.
- SQLite through `node:sqlite`. It is marked experimental in Node 22 and prints a warning; this is
  accepted for development and must be revisited before production use.

## Development

- TypeScript, `tsx` for running tests, `@types/node`.
- No runtime npm dependencies at present.

## External services

- Abacus RouteLLM at `https://routellm.abacus.ai/v1`, with an API key.
- Later: a local Ollama instance, and the Claude API.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `ROUTELLM_API_KEY` | yes | Provider credential |
| `ROUTER_ADMIN_TOKEN` | yes | Admin endpoint bearer token |
| `ROUTER_BLACKLIST` | no | Comma-separated seed patterns, default `smaug` |
| `ROUTER_DB_PATH` | no | SQLite file, default `data/router.sqlite` |
| `ROUTER_CATALOG_REFRESH_HOURS` | no | Sync interval, default 6 |
| `ROUTER_HOST` | no | Default `127.0.0.1` |
| `ROUTER_PORT` | no | Default `8000` |
| `ROUTELLM_BASE_URL` | no | Default `https://routellm.abacus.ai/v1` |

## Repository layout

```
GS-LLMRouter/
  dev/
    architecture/
    planning/
    COMMAND-HISTORY.md
    TODO.md
  src/
  test/
  package.json
  tsconfig.json
```

The project currently sits one level too deep at `GS-LLMRouter/GS-LLMRouter/`; flattening it is a
separate step.
