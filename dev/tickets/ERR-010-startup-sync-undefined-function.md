# ERR-010: Startup sync called an undefined function

Severity: High. Status: Fixed.

## Symptom
The router exited at startup with `ReferenceError: getCatalogForStartup is not defined` at
`src/server.ts:258`. `tsc` reported the same name as undefined.

## Cause
The entry block called a function that was never written. `createRouterServer` kept its catalog
private, so the sync had nothing to refresh.

## Fix
`createRouterServer` takes an optional catalog. The entry block creates the catalog and passes it to
the server and to both syncs.

## Verification (observed)
- `tsc --noEmit` reported no errors.
- `/health` returned `{"status":"ok","modelCatalogCount":132}` and the log showed 132 records synced.
