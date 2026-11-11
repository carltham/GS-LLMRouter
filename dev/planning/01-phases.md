# Implementation phases

Status: draft for review.

## Phase 1 — Working single-provider router

- Done (ERR-010): the code compiles; the startup sync now receives the catalog instance.
- Open: read RouteLLM's real price and tool fields (ERR-001 to ERR-003) and decide how tiers are
  assigned (ERR-004). Without these no model is eligible.
- Open: fix the stale `.env.example` and tests (ERR-006, ERR-007).
- SQLite catalog, blacklist, decisions and feedback tables.
- Catalog sync at startup and on an interval (working: 132 models synchronised).
- Eligibility filter and selector as described in the architecture.
- Admin endpoints with token authentication.
- Tests for parsing, eligibility, selection, blacklist enforcement, streaming and admin auth.
- Build and test run clean.

Exit criterion: a request with `model: route-llm` reaches a non-blacklisted, priced, profiled model
and streams back, and a blacklisted model is never selected.

## Phase 2 — Policy settings

- Move the complexity keywords, length threshold, quality threshold, retry setting and refresh
  interval into configuration.
- Document each setting in `.env.example`.

## Phase 3 — Feedback loop

- Operator or client feedback per decision.
- Success-rate ranking with a minimum sample size.
- A report of per-model outcomes by request class.

## Phase 4 — Multi-provider

- Adapter interface and the Ollama adapter.
- Claude adapter with a translation layer.
- Provider-aware eligibility and fallback.

## Phase 5 — Incorporation into GS-EBS-Brain

- Package the router as a module with a stable interface.
- Move the catalog and policy configuration into the host project's configuration.
- Keep the HTTP surface available for external clients.
