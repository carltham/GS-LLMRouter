# Error tickets

One file per ticket, named `ERR-NNN-short-title.md`. Status: Open, Fixed, or Unconfirmed. Evidence
is what was actually observed; anything not re-run is marked as such.

| ID | Title | Severity | Status |
| --- | --- | --- | --- |
| [ERR-001](ERR-001-catalog-price-fields-not-parsed.md) | Catalog parser does not read RouteLLM price fields | High | Open |
| [ERR-002](ERR-002-price-unit-mismatch.md) | Price unit and type mismatch (per token, strings) | High | Open |
| [ERR-003](ERR-003-tool-support-not-parsed.md) | Tool support field is not parsed | Medium | Open |
| [ERR-004](ERR-004-no-quality-tiers.md) | No model has a quality tier, so complex requests cannot be routed | High | Open |
| [ERR-005](ERR-005-routellm-meta-routers-selectable.md) | RouteLLM's own routers are selectable, and the blacklist misses indirect Smaug use | Medium | Open |
| [ERR-006](ERR-006-env-example-stale.md) | `.env.example` is stale | Medium | Open |
| [ERR-007](ERR-007-config-test-stale-and-hang.md) | `config.test.ts` is stale and `npm test` hung | Medium | Open |
| [ERR-008](ERR-008-sqlite-files-committed.md) | Runtime SQLite files are in the commit | High | Fixed (old commits unconfirmed) |
| [ERR-009](ERR-009-docs-describe-fixed-bug.md) | Docs still describe the startup sync as broken | Low | Fixed |
| [ERR-010](ERR-010-startup-sync-undefined-function.md) | Startup sync called an undefined function | High | Fixed |
