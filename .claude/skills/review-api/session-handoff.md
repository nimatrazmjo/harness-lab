# review-api — Session Handoff

_Overwritten every time this skill runs. Read this FIRST — see SKILL.md / review-shared/PROCEDURE.md._

## Where things stand

No review cycles yet. `feature-list.json` is empty — no pending `apps/api` work as of 2026-08-19
(everything currently merged/`passing` in the root `feature-list.json`).

## Next action

Nothing pending. If invoked with no target named, this is a clean no-op — confirm via
`git log main..<any api-scoped branch>` that nothing new landed before reporting "nothing to
review."

## Known gaps / notes for next session

- No prior review cycles have completed through this skill — no real benchmarks/precedent yet.
- No nested `apps/api/CLAUDE.md`/`AGENTS.md` exists — harness-compliance checks use root
  `AGENTS.md` §2 directly (see `SKILL.md`).
