# Data model

Status: draft for review.

## models

| Column | Type | Notes |
| --- | --- | --- |
| id | text, primary key | Provider model ID |
| name | text | Display name, defaults to id |
| model_type | text | Text, image, classification, and so on |
| input_price | real, nullable | Intended: per million input tokens. Currently always null; see below |
| output_price | real, nullable | Intended: per million output tokens. Currently always null; see below |
| context_window | integer, nullable | Tokens |
| api_formats | text | JSON array of supported formats |
| tools_supported | integer, nullable | 1, 0, or unknown |
| quality_tier | integer, nullable | 1 to 5, set by review |
| enabled | integer | 1 by default |
| available | integer | 1 when present in the latest sync |
| raw_json | text | Provider record, for audit |
| catalog_updated_at | text | ISO timestamp of last sync |

### Fields RouteLLM returns versus fields the parser reads

Observed in the stored `raw_json` of 132 models (87 of type `text_generation`):

| Meaning | RouteLLM field (observed) | Parser reads | Ticket |
| --- | --- | --- | --- |
| Input price | `input_token_rate`, string, for example `'0.000002'` | `input_price_per_million_tokens` and similar | ERR-001, ERR-002 |
| Output price | `output_token_rate`, string | `output_price_per_million_tokens` and similar | ERR-001, ERR-002 |
| Cached input price | `cached_input_token_rate` | not read | ERR-001 |
| Context window | `context_length` | `context_length` (read) | none |
| Tool support | `tools`, boolean | `supports_tools`, `tool_calling`, `function_calling` | ERR-003 |

The rates look per-token, not per million; the response has no unit field, so this is an inference
and needs confirming (ERR-002). Result today: 0 of 132 models have a price and 0 have a quality tier.

## blacklist

| Column | Type | Notes |
| --- | --- | --- |
| pattern | text, primary key, case-insensitive | Substring matched against id and name |

Patterns are seeded from configuration on first start and can be changed through the admin API.
Removing a pattern from configuration does not remove it from the database.

## decisions

| Column | Type | Notes |
| --- | --- | --- |
| id | text, primary key | UUID returned to the client |
| model_id | text | Selected model |
| complexity | text | `simple` or `complex` |
| created_at | text | ISO timestamp |

No prompt text, message content, or credential is stored.

## feedback

| Column | Type | Notes |
| --- | --- | --- |
| id | integer, primary key | |
| decision_id | text, unique, references decisions | One outcome per decision |
| success | integer | 1 or 0 |
| note | text, nullable | Truncated to 500 characters |
| created_at | text | ISO timestamp |

## Retention

Decisions and feedback are kept for research. A retention period and an export format are open
questions; see `../planning/04-open-decisions.md`.
