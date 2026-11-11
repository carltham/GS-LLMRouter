# Instructions for AI agents

GS-LLMRouter is an open-source application and is published as such. Treat everything committed here
as public.

## Git

- Never run a destructive or state-changing git command. This includes reset, rebase, amend, force
  push, branch or ref deletion, `git rm`, `git clean`, `git checkout --`, `git stash drop`, and any
  other history rewrite.
- Run only read-only git commands (`status`, `log`, `diff`, `ls-files`, `check-ignore`, `remote -v`).
- When a change to the repository or its history is needed, give the command to the user as text and
  let them run it.

## Layout

- Only the actual application lives in `GS-LLMRouter/` (source, tests, package files, app README).
- Everything else lives in the project root: `dev/architecture/`, `dev/planning/`, `dev/TODO.md`,
  `dev/COMMAND-HISTORY.md`, `What-Is-This-Good-For.md`, and this file.
- Do not put development docs inside `GS-LLMRouter/GS-LLMRouter/`.

## Scope

- The current phase is architecture. Do not change application code unless the user asks for it.
- Keep the architecture docs in `dev/architecture/` consistent with the code.

## Command history

- Record each user message in `dev/COMMAND-HISTORY.md` before acting on it: newest first, numbered in
  the order sent, verbatim, at most 100 records.
- Redact API keys and other secrets in the log as `<redacted-api-key>`.

## Secrets and published files

- Never print, log, commit or write a credential into any file. Refer to secrets by variable name.
- Credentials live in the untracked `GS-LLMRouter/.env`; `.env.example` holds placeholders only.
- Runtime state (`GS-LLMRouter/data/`, SQLite files) must not be committed.
