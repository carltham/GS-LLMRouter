# ERR-001: Catalog parser does not read RouteLLM price fields

Severity: High. Status: Open.

## Symptom
None of the 132 stored models has an input or output price. `catalog.ts` treats a model with no price
as ineligible, so every request has no eligible model and would return 503.

## Evidence (observed)
- `data/router.sqlite`: 132 models, 0 with `input_price`, 0 with `output_price`. This includes all 87
  `text_generation` models.
- The stored `raw_json` carries `input_token_rate`, `output_token_rate` and
  `cached_input_token_rate`.
- `parseCatalog` in `src/catalog.ts:94-95` looks for `input_price_per_million_tokens`,
  `input_cost_per_1m_tokens`, `input_per_1m_tokens`, `prompt_price_per_1m_tokens`, `prompt` (and the
  output equivalents). None of these is in the RouteLLM response.

## Likely cause
The parser was written against assumed field names instead of the real `GET /models` response.

## Expected
Prices are read from the fields RouteLLM actually returns and stored for text models.

## Related
ERR-002 (unit), ERR-004, `dev/architecture/04-data-model.md`.
