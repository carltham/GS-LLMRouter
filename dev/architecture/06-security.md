# Security

Status: draft for review.

## Credentials

- Provider credentials are read from the environment at startup.
- The admin token is read from the environment and compared in constant time.
- No credential is written to the database, logs, or responses.
- `.env` is ignored by git; `.env.example` holds placeholders only.

## Network exposure

- The listener binds to `127.0.0.1` by default.
- Provider base URLs must use HTTPS unless they target localhost.
- Admin endpoints are reachable only with the admin token.

## Input handling

- Request bodies are capped at 10 MiB.
- Only `route-llm` is accepted as a client model value.
- Blacklist patterns are length-limited and stored case-insensitively.
- Feedback notes are truncated.

## Data minimisation

- Prompt and message content are not persisted.
- Decision rows hold model, class and timestamp only.
- Catalog records are stored for audit and contain no user data.

## Known limits

- The router cannot prevent a provider from silently substituting a different model behind the
  requested ID. This is a provider guarantee, not something the router can enforce.
- A blacklist pattern matches substrings, so a pattern must be chosen carefully to avoid blocking
  unrelated models.
