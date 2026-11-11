# ERR-007: `config.test.ts` is stale and `npm test` hung

Severity: Medium. Status: Open.

## Symptom
The test suite does not give a usable result.

## Evidence
- Observed: `npm test` printed no output in 120 seconds and was killed.
- Observed earlier: `test/config.test.ts` still expects `cheapModel` and `strongModel`, which
  `config.ts` no longer provides, and fails.
- Unconfirmed: the cause of the hang. A server test that keeps a listener open is a guess only.

## Expected
Tests match the current config, and the suite exits on its own with a pass or fail result.
