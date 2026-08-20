# review-harness — Session Handoff

_Overwritten every time this skill runs. Read this FIRST — see SKILL.md / review-shared/PROCEDURE.md._

## Where things stand

One entry logged, retroactively: `review-harness-2026-08-19-01-devops-request-grant-pr23`,
status `merged`. This is the real PR #23 cycle that happened before this skill existed — logged
so the schema has a real, non-fabricated example and so the lesson it produced (verify fixes
against the real remote branch, not local state) is traceable to where it came from.

This skill itself (review-api/web/infra/harness, all four, plus review-shared/) is new as of
2026-08-19 and has not yet gone through its own first live review cycle.

## Next action

Nothing pending beyond this skill infrastructure's own first cycle (reviewing itself, via
`/code-review` + this domain's own harness-compliance pass, before it's merged) — see whichever
PR introduces these four skills for that cycle's actual entry.

## Known gaps / notes for next session

- No `markdownlint` soft-check has actually caught anything yet — it's wired in `init.sh` but
  unexercised.
- This domain has the widest scope of the four (touches files across the whole repo) — be
  deliberate about not over-claiming "harness compliance" for files that are really api/web/infra
  content just because they're referenced from a harness doc.
