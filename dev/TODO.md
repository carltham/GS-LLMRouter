# Development TODO

## Multi-provider routing

- [ ] Evolve the router from RouteLLM-only model selection into a multi-provider router that can choose between local Ollama, Abacus RouteLLM, Claude, and additional providers.
- [ ] Add provider-specific adapters behind a shared request/response interface; use OpenAI-compatible APIs where supported and a provider-native adapter where needed (for example, Claude).
- [ ] Define routing criteria that account for request requirements, model capabilities, privacy, cost, latency, and provider availability.
- [ ] Add provider configuration and secure credential handling without hardcoding secrets.
- [ ] Add tests covering provider selection, adapter behavior, and fallback when a provider is unavailable.
