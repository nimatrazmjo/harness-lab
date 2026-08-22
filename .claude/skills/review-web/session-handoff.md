# review-web — Session Handoff

_Overwritten every time this skill runs. Read this FIRST — see SKILL.md / review-shared/PROCEDURE.md._

## Where things stand

**Open cycle:** `review-web-2026-08-19-01-autosave-race-guard` (see `feature-list.json`) —
status `requested`. Real, unreviewed work sits on branch `fix/autosave-race-guard` (two commits:
autosave-race serialization fix, red-flags mount-time seq-gate fix), not yet PR'd. This skill's
dispatch flow has never actually run yet — this entry is seeded from real repo state, not a
placeholder.

## Next action

1. Run `bash .claude/skills/review-web/init.sh`.
2. Follow `review-shared/PROCEDURE.md` starting at step 3 (the target isn't PR'd yet) for
   `review-web-2026-08-19-01-autosave-race-guard`.

## Known gaps / notes for next session

- No prior review cycles have completed through this skill — no real benchmarks/precedent yet.
- `apps/web` has no nested `CLAUDE.md`/`AGENTS.md` — harness-compliance checks fall back to root
  `AGENTS.md` §2's invariants as they apply to frontend code (see `SKILL.md`).
