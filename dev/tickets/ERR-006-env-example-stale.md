# ERR-006: `.env.example` is stale

Severity: Medium. Status: Open.

## Symptom
Following `.env.example` produces a router that does not start.

## Evidence
- Observed earlier: `.env.example` lists `ROUTER_CHEAP_MODEL` and `ROUTER_STRONG_MODEL`, which
  `config.ts` no longer reads.
- Observed earlier: it does not list `ROUTER_ADMIN_TOKEN`, which `config.ts` requires.
- Not re-read since the key was renamed to `ABACUSAI_GS_EBS_BRAIN_KEY`.

## Expected
`.env.example` lists exactly the variables in the table in `dev/architecture/02-components.md`, with
placeholders only.
