# Components

Status: draft for review.

## HTTP server

Accepts client requests and admin requests. Validates the body, enforces the `route-llm` alias, and
streams the upstream response back to the client, including server-sent events.

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness and catalog size |
| GET | `/v1/models` | Advertises only the `route-llm` alias |
| POST | `/v1/chat/completions` | Client chat completions |
| GET | `/admin/models` | Catalog, profiles and blacklist |
| POST | `/admin/sync` | Refresh the catalog from the provider |
| POST | `/admin/profile` | Set quality tier, enabled flag, tool support |
| POST | `/admin/blacklist` | Add or remove a blacklist pattern |
| POST | `/admin/feedback` | Record the outcome of a decision |

Admin endpoints require a bearer token compared in constant time.

## Catalog store

A SQLite database owned by the router. Tables:

- `models` — id, name, type, input and output price per million tokens, context window, API
  formats, tool support, quality tier, enabled flag, availability, raw provider record, sync time.
- `blacklist` — case-insensitive patterns matched against model id and name.
- `decisions` — one row per routing decision: id, model, complexity, timestamp.
- `feedback` — one row per decision: success flag, optional short note, timestamp.

The database file path is configuration. It is not committed.

## Catalog synchroniser

Fetches `GET /models` under the provider base URL, parses it, and replaces the availability flags in
one transaction (`refreshCatalog` in `server.ts`). It runs on `POST /admin/sync`. A failed sync leaves
the previous catalog in place.

The `server.ts` entry block also syncs at startup and every `ROUTER_CATALOG_REFRESH_HOURS`. It creates
the `ModelCatalog` itself and passes the same instance to `createRouterServer` and to both syncs
(fixed; see ERR-010 in `../tickets/`). After the fix, `/health` returned `modelCatalogCount: 132` and
the log showed 132 records synchronised.

Known limitation: the parser does not read the price and tool fields RouteLLM actually returns, so no
synchronised model has a price and none is eligible. See ERR-001 to ERR-004 in `../tickets/`.

## Eligibility filter

Applied before scoring. A model is eligible only when all hold:

- It is present and available in the current catalog.
- It is enabled.
- It does not match any blacklist pattern.
- It has a known input and output price.
- Its API formats include chat completions, when formats are declared.
- It is not an image, embedding, classification, audio or speech model.
- For complex requests, its quality tier is at least 3 (an unset tier counts as 1). Simple requests
  have no tier requirement. The threshold is a constant in `catalog.ts`.
- For requests with tools, tool support is confirmed.
- Its context window covers the estimated input plus output tokens.

## Selector

Scores eligible models and picks one. See `05-routing-policy.md`.

## Provider adapters

Not implemented as a component. The upstream call to Abacus RouteLLM is an inline `fetch` to
`chat/completions` in `server.ts`, sent with the selected model ID and the provider credential. A
shared adapter interface for Ollama and Claude is planned; see `07-multi-provider.md`.

## Decision recorder

Writes a decision row for every routed request and returns the decision id to the client in the
`x-router-decision-id` response header, alongside `x-router-selected-model`.

## Feedback intake

Accepts an outcome for a decision id. Used by operators or by a client that can judge the result.
Feedback is one per decision. The endpoint accepts `decisionId` and `success` only; the stored
`note` column is supported by the catalog but is not exposed through the API.

## Configuration

Loaded from the environment at startup and validated. Missing or invalid values stop the process.

| Variable | Required | Default |
| --- | --- | --- |
| `ABACUSAI_GS_EBS_BRAIN_KEY` | yes | none |
| `ROUTER_ADMIN_TOKEN` | yes | none |
| `ROUTELLM_BASE_URL` | no | `https://routellm.abacus.ai/v1` |
| `ROUTER_DB_PATH` | no | `data/router.sqlite` |
| `ROUTER_HOST` | no | `127.0.0.1` |
| `ROUTER_PORT` | no | `8000` |
| `ROUTER_BLACKLIST` | no | `smaug` (comma-separated) |
| `ROUTER_CATALOG_REFRESH_HOURS` | no | `6` (0.1 to 168) |

There are no cheap/strong model settings; the model is chosen from the catalog.
