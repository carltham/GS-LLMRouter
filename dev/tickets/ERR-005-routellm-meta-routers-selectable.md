# ERR-005: RouteLLM's own routers are selectable, and the blacklist misses indirect Smaug use

Severity: Medium. Status: Open.

## Symptom
The catalog includes RouteLLM's own routing models, so this router could select a model that then
chooses another model itself.

## Evidence (observed)
- The catalog contains `route-llm`, `route-llm-code` and `route-llm-code-low`.
- The description of `route-llm-code-low` says it routes to Smaug Flash. The blacklist matches model
  ids and names only, so it does not catch this.
- The router's own policy then no longer controls which model answers.

## Expected
Models that route onward are excluded or flagged, and the blacklist policy states whether it also
covers models that may route to a blacklisted model.
