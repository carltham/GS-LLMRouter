# LLM Router — Architecture Overview

Status: draft for review. Nothing here is agreed until Carl approves it.

## Purpose

The router is an OpenAI-compatible service that accepts chat-completion requests from clients,
decides which model should answer each request, and forwards the request to that model's provider.
The decision is made by the router from its own researched data and policy, not delegated to an
upstream routing service.

## Scope

In scope:

- One client-facing model alias, `route-llm`, on `POST /v1/chat/completions`.
- A local model catalog with pricing and capability data, refreshed from the provider.
- A blacklist that excludes models before any selection is made.
- A routing policy that selects among eligible models.
- Recorded outcomes used to improve later selections.
- Abacus RouteLLM as the single upstream provider (called inline from the server). Provider
  adapters for local Ollama and Claude are planned, not implemented; see `07-multi-provider.md`.

Out of scope for this architecture:

- The GSAccount accounting domain.
- A user interface beyond the HTTP API.
- Training or fine-tuning models.

## Context

```
Client (IDE extension, script, service)
        |  POST /v1/chat/completions  model=route-llm
        v
+-------------------+        +----------------------+
|   LLM Router      | -----> |  Model catalog (SQLite)|
|  (TypeScript)     |        |  models, prices,      |
|                   |        |  profiles, blacklist, |
|                   |        |  decisions, feedback  |
+-------------------+        +----------------------+
        |
        |  provider adapter, chosen model ID
        v
+-------------------+   +-------------+   +-------------+
| Abacus RouteLLM   |   | Ollama      |   | Claude API  |
+-------------------+   +-------------+   +-------------+
```

## Principles

1. The blacklist is a hard constraint. No policy, fallback, or learned preference may select a
   blacklisted model.
2. The router chooses the model. An upstream routing alias is never used to make the choice.
3. Only enabled models with a known price are eligible. Complex requests additionally require a
   quality tier of at least 3 set by review; simple requests do not require a profile.
4. Prompt content is not stored by default; routing outcomes are recorded without request text.
5. Credentials come from the environment or a secret store, never from source or the database.
6. A request that cannot be routed to an eligible model fails explicitly rather than silently
   falling back to an unvetted model. There is no automatic retry on provider failure.
