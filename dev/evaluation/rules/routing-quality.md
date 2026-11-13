# Router-quality evaluation rules

Evaluate the router as a policy decision system, not just as a text generator. Every scenario declares the expected complexity class and request capabilities. The runner checks the returned model against the current admin catalog:

- A selected model must exist, be enabled, have known input/output prices, declare text output, and not match a blacklist pattern.
- A complex scenario must select a model whose configured `qualityTier` meets `requireQualityTierForComplex` (currently 3).
- A scenario with tools must select a model with `toolsSupported: true`.
- Every successful route must include the router decision header. A 503/no candidate, provider error, missing model, or policy violation is a failure.

Use small, safe prompts and output caps. The runner calls the actual router and therefore may incur upstream usage. Current cases cover simple requests, a complexity keyword, and tool-bearing requests. Add cases for context-window boundaries, blacklists, disabled models, cost/latency trade-offs, and feedback ranking as those policies are configured and observable.

The suite does not currently assert the exact internal complexity label (the router does not expose it), nor does it prove that the upstream provider honored the selected model ID. It validates only the returned selection header and catalog-visible constraints. Those gaps should be addressed with explicit, safe observability or separate live provider checks before treating results as a hard routing guarantee.
