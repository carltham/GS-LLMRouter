# Multi-provider extension

Status: draft for review. This records the direction in `dev/TODO.md`; it is not implemented.

## Adapter interface

Each provider adapter implements:

- `listModels()` — return catalog records in the shared shape.
- `chat(request, modelId)` — send a chat completion and return a streamable response.
- `capabilities()` — declare streaming, tool support, and API format.

## Planned providers

| Provider | Model listing | Chat | Notes |
| --- | --- | --- | --- |
| Abacus RouteLLM | `GET /v1/models` | OpenAI-compatible | First adapter |
| Ollama (local) | Local model list | OpenAI-compatible endpoint | No credential, local only |
| Claude | Provider model list | Native adapter | Requires a translation layer |

## Effect on routing

The eligibility filter and selector stay provider-neutral. Provider identity becomes one more
criterion: privacy requirements may exclude remote providers, and availability may exclude a
provider that is down.

## Open questions

- Whether provider choice is part of the client request or only of policy.
- How a provider outage affects ranking and fallback.
- Whether local models carry a price of zero or are excluded from cost ranking.
