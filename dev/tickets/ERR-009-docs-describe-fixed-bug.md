# ERR-009: Docs still describe the startup sync as broken

Severity: Low. Status: Fixed.

Fix: `dev/architecture/02-components.md`, `dev/architecture/03-request-flow.md`,
`GS-LLMRouter/README.md` and `What-Is-This-Good-For.md` now describe startup and interval sync as
working, and point to ERR-001 to ERR-004 for the price and tier problems.

## Symptom
Documentation says the startup and interval catalog sync does not work, but ERR-010 was fixed.

## Evidence
- Observed after the fix: `/health` returned `modelCatalogCount: 132` and the log showed
  "Synchronized 132 model records".
- Not updated: `dev/architecture/02-components.md`, `dev/architecture/03-request-flow.md` and
  `GS-LLMRouter/README.md` still describe the sync as broken.

## Expected
The three files describe startup and interval sync as working.
