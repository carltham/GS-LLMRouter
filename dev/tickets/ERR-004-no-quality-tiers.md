# ERR-004: No model has a quality tier

Severity: High. Status: Open.

## Symptom
Complex requests need a quality tier of at least 3, so none can be routed.

## Evidence (observed)
- `data/router.sqlite`: 0 of 132 models have a `quality_tier`.
- Tiers are set only through `POST /admin/profile`. Nothing sets them automatically.

## Expected
A defined process assigns tiers (open decision 3 in `dev/planning/04-open-decisions.md`: who reviews
them), or the routing policy has a defined behaviour when no tier exists.
