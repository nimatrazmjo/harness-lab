# devops-request-grant — Benchmarks

Lightweight, honest metrics on this skill's own effectiveness — not a dashboard, just a table
appended to as real grant cycles complete. Populate rows from real timestamps/counts recorded in
`feature-list.json` and `progress.md`; never estimate or backfill a row for a cycle that didn't
go through this skill (the pre-skill Gap A/B/C history in `devops/progress.md` doesn't count —
there was no `init.sh`/rubric/tracking to measure against back then).

## What gets tracked, per completed cycle (`verified` or `denied`)

| Metric | Definition |
| --- | --- |
| Time to resolution | Wall-clock from `feature-list.json` entry created (`requested`) to terminal status (`verified`/`denied`). |
| Attempts | How many times the grant-subagent had to be dispatched for this entry before it resolved (MFA expiry retries don't count as separate attempts; a wrong-scope statement that needed redrafting does). |
| First-draft-correct | Did the statement drafted in step 2 turn out to be the actual correct minimal fix, or did re-verification (rubric dimension 3) reveal it needed correction? |
| Gap category | Freeform tag for recurrence tracking — e.g. "resource-tag condition can't match an AWS-owned document" (the Gap C pattern), "inline policy character limit", "missing read-back permission for a just-created resource". Reuse an existing tag if the same root-cause shape recurs; that recurrence is itself the signal worth surfacing. |

## Log

_No completed cycles yet — 0 grant requests have been run through this skill's dispatch flow
(SKILL.md step 3). `grant-2026-08-19-01-ssm-senddocument` in `feature-list.json` is drafted and
ready to be the first real row here once it resolves. Do not add a placeholder row before that
happens._

| Entry id | Time to resolution | Attempts | First-draft-correct | Gap category |
| --- | --- | --- | --- | --- |
| _(none yet)_ | | | | |
