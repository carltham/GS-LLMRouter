# ERR-002: Price unit and type mismatch

Severity: High. Status: Open.

## Symptom
Even once ERR-001 is fixed, cost estimates would be wrong by a factor of one million.

## Evidence (observed)
- RouteLLM returns rates as strings, for example `input_token_rate: '0.000002'`, `output_token_rate:
  '0.00001'`.
- These look like per-token rates. (The unit field is absent from the response, so this is an
  inference from the magnitude, not a confirmed fact.)
- `src/catalog.ts:270` computes `(tokens * price + ...) / 1_000_000`, which assumes a price per
  million tokens.
- `numeric()` in `src/catalog.ts` does accept numeric strings, so the type alone is not the problem.

## Expected
The unit of the stored price and the formula agree, and the unit is documented in
`dev/architecture/04-data-model.md`.

## Open question
Confirm the unit with RouteLLM documentation before fixing.
