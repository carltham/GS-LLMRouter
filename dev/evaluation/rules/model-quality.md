# Target-model evaluation rules

These rules apply independently to each exact model ID passed through `EVAL_TARGET_MODELS`; never compare two target models by silently changing the prompt or scoring checks between them.

## Case design

- Each case must have a stable ID, category, explicit messages, bounded `max_completion_tokens`, positive weight, and at least one objective check.
- Mark a case `required: true` when failure should block a pass, regardless of the aggregate score.
- Use deterministic checks where possible: exact output for constrained instructions, parsed JSON equality for structured output, and narrow regex/substring assertions only when exact output would be brittle.
- Keep expected answers independent of a target model's response. Do not use generated output as its own reference.
- Do not include secrets, personal data, production customer prompts, or unlicensed benchmark content.

## Pass criteria

1. Every required case passes all its checks.
2. The weighted passing-case score meets `minimumWeightedScore`.
3. Every request stays within the per-case timeout and latency bound.
4. Completion caps in the dataset must not exceed `operationalLimits.maxCompletionTokensPerCase`.
5. When `requireReturnedModelMatch` is enabled, the API response must name the exact requested target model; silent model substitution fails the case.
6. Report provider-reported usage when available, but treat missing usage as unavailable—not as zero cost. If the provider reports output tokens, they must not exceed the case's completion cap.

The runner scores a case as pass only when every check for it passes and the API returns the requested model ID. The score is the sum of passed case weights divided by all case weights. An HTTP/API error is a failed case. Output is not saved in result artifacts; provider-reported usage is retained when available.

## Limits and review

The included three cases are a small smoke test of instruction following, arithmetic, and JSON formatting. They do not measure broad knowledge, groundedness, multilingual ability, tool correctness, safety, refusal quality, bias, prompt injection resistance, or production performance. Passing is not evidence of overall model quality. Add domain-specific cases and human review before using results for model selection or release decisions. Record model ID, date, endpoint, dataset version and provider-side model changes when comparing runs.
