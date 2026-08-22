# devops-request-grant — Session Handoff

_Overwritten every time this skill runs. Read this FIRST — see SKILL.md's protocol. Scoped to
this skill only, separate from `devops/session-handoff.md` on purpose (this workstream tracks
grant requests, not features)._

## Where things stand

**Open request:** `grant-2026-08-19-01-ssm-senddocument` (see `feature-list.json`) — status
`denied`. Two real attempts so far (PR #21's original session, and a dedicated re-verify
subagent afterward) both got the identical `AccessDeniedException` on `ssm:SendCommand` against
`arn:aws:ssm:us-east-1::document/AWS-RunShellScript`. The minimal fix statement is drafted and
recorded in the entry — it has never actually been run through *this* skill's dispatch flow
(SKILL.md step 3) yet. That's the next real action: dispatch the grant-subagent for this entry.

**Identity chain status:** `nimat-admin` + `iam-grantor-devops-agent` + the
`devops-agent-boundary` permissions boundary were set up 2026-08-19 (see `devops/AGENTS.md`).
Root credentials in the local `default` profile are confirmed revoked (`InvalidClientTokenId`).
Not yet confirmed: whether `nimat-admin` is configured as a local AWS CLI profile on this
machine — `init.sh` checks this and will say so if missing.

## Next action

1. Run `bash .claude/skills/devops-request-grant/init.sh` — confirm toolchain + no root creds.
2. Dispatch the grant-subagent for `grant-2026-08-19-01-ssm-senddocument` per SKILL.md step 3 —
   the statement is already drafted, no need to re-draft it.
3. On success, flip the entry to `applied`, then hand back to `devops-agent` and re-verify the
   real pgvector-from-inside-VPC probe (devops.terraform_networking_rds's actual blocker).
4. Only then flip to `verified`, update `devops/feature-list.json`'s
   `devops.terraform_networking_rds` entry (that's `devops/`'s file, not this skill's — a
   separate, normal `/devops` step), and run `cleanup.sh` + `clean-state-checklist.md`'s leave
   gate here.

## Known gaps / notes for next session

- This skill's `feature-list.json` currently has exactly one entry, seeded from real prior
  history (not a placeholder). Don't treat "only one entry" as "nothing's been requested before"
  — the earlier Gap A/B/C history from the now-deleted `devops/manual.md` still exists in
  `devops/progress.md`'s dated log if older context is needed, it just predates this skill.
- MFA codes are ~30s-valid — if the grant-subagent's assume-role call fails with an expired
  code, it should ask for a fresh one, not retry the same one.
- `benchmarks.md` has no real data points yet (0 completed grant cycles through this skill) — the
  first successful run through this flow should populate it for real, not with placeholders.
