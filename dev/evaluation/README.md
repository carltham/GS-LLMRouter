# Model and routing quality evaluations

This is a standalone evaluation suite. It lives outside the application and adds no runtime or test dependencies. It has two intentionally separate tracks:

- **Model quality** sends a fixed prompt set directly to explicitly named target model IDs and scores their responses against objective, case-specific checks.
- **Routing quality** sends scenarios through a running router and checks the selected model against the router's live admin catalog and routing policy.

These are live evaluations: requests can reach Abacus RouteLLM and consume credits. There is no implicit target-model fallback and no live evaluation runs by default. Start with the no-network scorer/data check:

```sh
node dev/evaluation/run.mjs --mode self-test
```

## Target model quality

Set exact model IDs explicitly; the runner refuses to guess which model to test. It performs one completion per case per model.

```sh
EVAL_TARGET_MODELS='exact-model-id' node --env-file=GS-LLMRouter/.env dev/evaluation/run.mjs --mode model-quality
```

You can list multiple IDs separated by commas. The default endpoint is `https://routellm.abacus.ai/v1`; override it with `EVAL_BASE_URL` when using another compatible endpoint. The key is read from `EVAL_API_KEY` or `ABACUSAI_GS_EBS_BRAIN_KEY` in the process environment. Never place keys in command arguments or this folder. For the shown command, Node reads the existing ignored `.env` file without printing it.

Cases and gates are defined in:

- `cases/model-quality.json` — prompt, category, weight, required status, output token cap, and per-case checks.
- `rules/model-quality.json` — minimum weighted score, required cases, latency limit and maximum completion cap.
- `rules/model-quality.md` — how to interpret and extend the rubric.

Supported checks: exact normalized text, substring, forbidden substring, JSON structural equality, and regular expression. A model passes only if every required case passes, the weighted score reaches the configured threshold, and latency gates hold. The starter suite covers instruction following, simple reasoning, and structured JSON output. It is a smoke suite, not a broad benchmark, safety certification, or substitute for human review.

## Router quality

Start the router separately with its normal configuration and current catalog, then run:

```sh
node --env-file=GS-LLMRouter/.env dev/evaluation/run.mjs --mode routing-quality
```

Optional environment overrides: `EVAL_ROUTER_URL` (default `http://127.0.0.1:8000`), `EVAL_ROUTER_ADMIN_TOKEN` (otherwise `ROUTER_ADMIN_TOKEN`), and `EVAL_TIMEOUT_MS`. It requires the router's admin API to list the current catalog. Each routing scenario sends one chat completion through the router, which can consume credits.

The suite checks simple, complex-keyword, and tool-bearing scenarios. It verifies that a decision header is present and that the selected catalog entry is enabled, priced, not blacklisted, and declares text output; complex requests need the configured quality tier, and tool requests need confirmed tool support. A failed or unavailable route fails evaluation; the suite does not silently skip a scenario.

Run both tracks with `--mode all`. This requires both the explicit target model setting and a running router, and incurs calls for both tracks. Each run writes a timestamped summary JSON to `results/`; response text and credentials are never stored. `results/` is git-ignored.

## Interpreting results

- A **model-quality** failure points to the tested model's output for a particular case/check. Re-run a failed case before concluding a regression; model outputs may vary even at temperature zero.
- A **routing-quality** failure points to a selected catalog model or missing routing decision that violated a declared policy rule. Check catalog sync and model profiles before changing routing logic.
- The suite reports latency and provider usage metadata where available, but it does not yet grade semantic quality with an LLM judge, compare costs across models, test long-run reliability, or establish statistical confidence.
