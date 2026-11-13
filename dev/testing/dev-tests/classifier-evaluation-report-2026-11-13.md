# Local model classifier reliability report

**Run date:** 2026-11-13  
**Source:** `classifier-evaluation-results/classifications-2026-11-13T14-51-13-341Z.json`  
**Test set:** 24 hand-labelled prompts across chat, translation, summarisation, extraction, code, and reasoning. Each prompt was classified 3 times per model (72 calls/model).  
**Environment:** local Ollama at `http://localhost:11434`; temperature 0; thinking disabled; JSON output requested.

## Results

| Model | Valid JSON | Kind accuracy | Difficulty exact | Difficulty within 1 level | Repeat consistency | Median latency | P95 latency |
|---|---:|---:|---:|---:|---:|---:|---:|
| `qwen3.5:2b` | 96% | 75% | 71% | 92% | 96% | 608 ms | 839 ms |
| `qwen3.5:4b` | **100%** | **88%** | **79%** | **100%** | **100%** | 1,507 ms | 2,102 ms |
| `qwen2.5-coder:3b` | 92% | 67% | 63% | 92% | 92% | 798 ms | 1,226 ms |

No transport/API errors occurred. The `errors` metric does not count malformed or invalid-value JSON; those are captured by valid JSON percentage.

## Interpretation

- **Best overall: `qwen3.5:4b`.** It had the strongest measured accuracy and returned the same classification on every repeat. Its median latency was about 1.5 seconds, roughly 2.5 times that of `qwen3.5:2b`.
- **Fastest: `qwen3.5:2b`.** Median latency was about 0.6 seconds, with useful but lower classification accuracy. It produced invalid JSON or labels on 4% of calls.
- **Not a good general classifier: `qwen2.5-coder:3b`.** It was slower than the 2b model and less accurate on this mixed task set; its code specialization did not produce an overall advantage.
- These results support treating model classification as a fallible signal, not a source of truth. A router should retain deterministic fallback/guardrails and avoid making a high-impact decision from a single classification.

## Error patterns

Patterns below are based on the repeated outputs in the raw report; repeated errors count once per prompt here.

- **Difficulty underestimation:** both Qwen 3.5 models labelled the moderate translation, summarisation and extraction examples as simple. The 2b model also labelled the complex translation prompt simple. Thus high within-one-level scores conceal errors on exact difficulty.
- **Kind ambiguity:** `qwen3.5:2b` often called reasoning prompts chat, and classified the complex code-debug prompt as chat. `qwen2.5-coder:3b` also confused reasoning with chat and mislabeled some extraction/code prompts. `qwen3.5:4b` made fewer kind errors, but labelled complex summarisation as reasoning and one code explanation as extraction.
- **Invalid labels/format:** the 2b model gave an invalid kind for the `git stash pop` code prompt on all three attempts. The coder model returned invalid values on one code prompt and invalid JSON on one reasoning prompt.

## Limitations

1. **Small, hand-labelled set:** 24 examples are not enough to establish production reliability. Labels reflect one person's judgement, especially for difficulty.
2. **Coverage gaps:** some prompts describe long documents or code that are not actually attached. The model sees the short placeholder description, so those cases test classification of the described task, not processing of the implied full input.
3. **Prompt and configuration specific:** results apply to this prompt, Ollama versions, model quantisations and settings. Different system prompts or structured-output handling may change results.
4. **Repeated calls are not independent evidence:** temperature was zero, so repeat consistency may partly reflect deterministic decoding; three repeats do not establish robustness to paraphrases.
5. **Latency excludes model loading:** the runner warmed each model before measurement. Actual cold-start latency is higher.

## Recommendation

For a local classifier prototype, `qwen3.5:4b` is the best candidate among these three if roughly 1.5 seconds median latency is acceptable. `qwen3.5:2b` is a latency-oriented alternative if classification is advisory and the router can fall back safely. Before using either to route real requests, expand and independently review the labelled set, add paraphrase variants, and test the real request shapes and prompt template.

## Reproduction

From the repository root:

```sh
node dev/testing/dev-tests/run-classifier-evaluation.mjs --repeats 3
```

The JSON source report is git-ignored under `dev/testing/dev-tests/classifier-evaluation-results/`.
