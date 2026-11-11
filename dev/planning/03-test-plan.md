# Test plan

Status: draft for review.

## Unit tests

- Catalog parsing: ids, prices, context windows, API formats, tool support, and rejection of an
  empty or malformed payload.
- Blacklist matching: case-insensitive substring match on id and name; add and remove patterns.
- Eligibility: each filter rule removes the expected models.
- Selection: ranking by success rate, then cost, then id; the minimum sample size rule.
- Configuration: missing required values, invalid port, invalid refresh interval, non-HTTPS base URL.

## Integration tests

- `POST /v1/chat/completions` with `route-llm` against a mock provider: the selected model is the
  expected one and the response streams.
- A blacklisted model is never selected, even when it is the cheapest and highest ranked.
- A model other than `route-llm` is rejected and never forwarded.
- No eligible model returns `503`.
- Admin endpoints reject a missing or wrong token.
- Catalog sync marks removed models unavailable and keeps the previous catalog on failure.
- Feedback is recorded once per decision; a duplicate returns `409`.

## Manual checks

- Start against the real RouteLLM endpoint with a valid key and confirm a sync populates the catalog.
- Confirm the client sees `x-router-decision-id` and `x-router-selected-model`.

## Current state

The prototype's earlier tests passed before the redesign. The redesign is incomplete and has not
been built or tested.
