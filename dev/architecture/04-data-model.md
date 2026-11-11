# Data model

Status: draft for review.

## models

| Column | Type | Notes |
| --- | --- | --- |
| id | text, primary key | Provider model ID |
| name | text | Display name, defaults to id |
| model_type | text | Text, image, classification, and so on |
| input_price | real, nullable | Per million input tokens |
| output_price | real, nullable | Per million output tokens |
| context_window | integer, nullable | Tokens |
| api_formats | text | JSON array of supported formats |
| tools_supported | integer, nullable | 1, 0, or unknown |
| quality_tier | integer, nullable | 1 to 5, set by review |
| enabled | integer | 1 by default |
| available | integer | 1 when present in the latest sync |
| raw_json | text | Provider record, for audit |
| catalog_updated_at | text | ISO timestamp of last sync |

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
