# Request flow

Status: draft for review.

## Chat completion

1. Client sends `POST /v1/chat/completions` with `model: "route-llm"`.
2. The server reads the body with a size limit and rejects invalid JSON.
3. Any other model value is rejected with `400`; it is never forwarded.
4. The router estimates input tokens from the message text and output tokens from
   `max_completion_tokens` or `max_tokens`, capped.
5. The router classifies the request as simple or complex, and notes whether tools are present.
6. The eligibility filter removes blacklisted, disabled, unpriced and unsuitable models, and for
   complex requests those below quality tier 3.
7. The selector scores the remaining models and picks one.
8. A decision row is written.
9. The server sends the request to RouteLLM `chat/completions` with the selected model ID and the
   provider credential. There is no retry on failure.
10. The response status, selected headers and body are streamed back to the client.
11. If the client disconnects, the upstream request is aborted.

If no model is eligible, the router returns `503` with a `no_eligible_model` error. It does not fall
back to a model outside the eligible set.

## Catalog sync

1. The sync calls the provider's `models` endpoint with the provider credential. It is triggered at
   startup, on the `ROUTER_CATALOG_REFRESH_HOURS` interval, and by `POST /admin/sync`.
2. The response is parsed into catalog records.
3. In one transaction, all models are marked unavailable, then each parsed model is upserted and
   marked available.
4. An empty or unrecognised response is treated as a failure and changes nothing.

## Feedback

1. An operator or client posts a decision id and a success flag.
2. The router records the outcome once per decision.
3. Later selections use the recorded success rate for that model and complexity class.

## Failure handling

| Condition | Response |
| --- | --- |
| Invalid JSON | `400` |
| Body over the size limit | `413` |
| Model other than `route-llm` | `400` |
| No eligible model | `503` |
| Provider unreachable or erroring | `502`, or the provider status passed through |
| Missing admin token or wrong token | `401` |
| Unknown decision id | `404` |
| Duplicate feedback | `409` |
