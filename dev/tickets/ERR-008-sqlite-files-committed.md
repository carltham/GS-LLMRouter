# ERR-008: Runtime SQLite files are in the commit

Severity: High (open-source repository). Status: Fixed in the branch; old commits unconfirmed.

## Symptom
Runtime state was published with the source.

## Evidence (observed)
- `git ls-tree -r HEAD` for commit `e0711aa` listed `GS-LLMRouter/data/router.sqlite`, `-shm` and
  `-wal`. Commit `4490078` had been pushed with the same files.
- The committed copies held 132 model records, 1 blacklist row, 0 decisions and 0 feedback rows. A
  search for key-like strings (`s2_` plus hex) found none. Other patterns were not searched.

## Fix
The owner removed the files from the commit and force-pushed.

## Verification (observed)
- `git ls-tree -r HEAD` for `3d12e32` lists no `data/` or `.env` files. It lists `LICENSE` and
  `CLAUDE.md`.
- `git rev-parse HEAD` and `git ls-remote origin refs/heads/main` both returned `3d12e32`.

## Not confirmed
Whether `4490078` and `e0711aa` are still reachable on GitHub (direct URL, forks). A purge can be
requested from GitHub Support.
