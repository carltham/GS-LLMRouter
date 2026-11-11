# What Is This Good For?

GS-LLMRouter is a local, OpenAI-compatible proxy that decides which AI model should answer each
request. Clients talk to one model alias, `route-llm`, and the router picks the actual model from its
own researched catalog, then forwards the request to Abacus RouteLLM.

Status: development prototype. It is not production-ready.

## Good for

- **One endpoint for many models.** Point any OpenAI-compatible client (IDE extension, script,
  service) at `http://127.0.0.1:8000/v1` with model `route-llm`, and the router handles model choice.
- **Controlling cost.** Models are ranked by recorded success rate and then estimated cost, so cheaper
  models are preferred when they work equally well.
- **Matching the model to the task.** Complex requests (long text, tools, or words like debug,
  refactor, design) are limited to models with a higher quality tier. Simple requests can use cheaper ones.
- **Forbidding models.** A blacklist (default: `smaug`) removes models before any selection. It cannot
  be overridden by the routing policy.
- **Learning from outcomes.** You can report whether a decision worked (`/admin/feedback`), and later
  selections use that success rate per model and request class.
- **Keeping research data.** The router keeps its own SQLite database of model prices, profiles,
  decisions and feedback, and stores no prompt text.
- **Staying in control of keys.** Provider credentials stay in the router's environment, not in
  clients.

## Planned (not implemented)

- Choosing between a local Ollama model, Abacus RouteLLM, Claude, and other providers, based on
  privacy, cost, latency and availability. See `dev/architecture/07-multi-provider.md` and `dev/TODO.md`.
- Eventual integration into GS-EBS-Brain as its LLM router.

## Not good for (today)

- **Production use.** There is no automatic retry or fallback, and the startup/interval catalog sync is
  broken; sync with `POST /admin/sync`.
- **Non-RouteLLM providers.** Only Abacus RouteLLM is supported as an upstream.
- **Responses API or Anthropic Messages formats.** Only `POST /v1/chat/completions` is handled.
- **Guaranteeing which model really answered.** The router cannot stop a provider from substituting a
  different model behind the requested ID.
- **Arbitrary client model names.** Any model other than `route-llm` is rejected.

## More detail

- Design: `dev/architecture/`
- Plans: `dev/planning/`
- Open work: `dev/TODO.md`
- Setup: `README.md`
