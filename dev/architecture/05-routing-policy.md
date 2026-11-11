# Routing policy

Status: draft for review. This is the policy the router applies; it is not yet agreed.

## Order of evaluation

1. Blacklist. Any model whose id or name contains a blacklist pattern is removed. This step cannot
   be overridden by any later step.
2. Availability and enablement.
3. Price known.
4. API format and model type suitable for chat completions.
5. Quality tier of at least 3 for complex requests (unset counts as 1); no tier requirement for
   simple requests.
6. Tool support, when the request carries tools.
7. Context window covers the estimated token count.

## Request classification

A request is `complex` when any of these hold, otherwise `simple`:

- It carries one or more tools.
- The combined message text exceeds 4,000 characters.
- The text matches a complexity keyword list, such as debug, refactor, implement, design, analyse,
  architecture, migrate, or security review.

The keyword list, the length threshold and the quality-tier threshold are constants in
`routing.ts` and `catalog.ts`, not configurable settings.

## Selection among eligible models

1. Compute the recorded success rate for each candidate for the request class. A candidate with
   fewer than five recorded outcomes is treated as 0.5, so new models are still tried.
2. Estimate cost from input and output prices and the token estimates.
3. Rank by success rate descending, then estimated cost ascending, then model id for determinism.
4. Select the first candidate.

## Fallback

Not implemented. If the selected model fails at the provider, the router returns the provider
status, or `502` if unreachable, and does not retry with another candidate. If fallback is added, it
must pass the same eligibility filter so a blacklisted model can never be reached by it.

## Learning

Feedback changes the success rate used in step 1. The policy does not learn from prompt content and
does not store it. A model that repeatedly fails for a request class loses rank for that class only.

## Explicit non-goals

- The router does not call an upstream routing alias to choose a model.
- The router does not use a model-name blocklist as its only defence; eligibility requires a known
  price and an enabled model as well.
