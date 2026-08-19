---
name: devops-request-grant
description: Get devops-agent a new AWS IAM permission after it hits AccessDenied. Drafts the minimal-scope statement, tracks it in this skill's own feature-list.json, dispatches a subagent that assumes the nimat-admin+MFA grantor role and applies it, then re-verifies the originally-blocked operation for real. Never asks for root, never self-grants. Use when a /devops session hits AccessDenied and devops-agent needs a permission it doesn't have.
---

Formalizes `devops/AGENTS.md`'s "Requesting an AWS permission grant" section — read that first if
this is new. This skill runs as its own small, self-contained harness (own `init.sh`,
`feature-list.json`, `session-handoff.md`, `clean-state-checklist.md`, `evaluator-rubric.md`,
`benchmarks.md`, `cleanup.sh`, `graph.md` — all in this directory), replacing what
`devops/manual.md` used to do with a structured, tracked log instead of prose. There is no
human-runs-the-CLI-themselves fallback: a dedicated subagent does the AWS work end to end, the
human's only involvement is supplying a live MFA code when the subagent asks for one.

## What to do

0. **Gate + orient, every invocation, including scheduled/looped ones:**
   - Run `bash .claude/skills/devops-request-grant/init.sh`. If it exits non-zero, stop and show
     the exact output — same hard-breakpoint discipline as `devops/init.sh` (most notably: never
     proceed if a credential in play resolves to the account root user).
   - Read `session-handoff.md` and `feature-list.json` in this directory.
   - **Loop/scheduled-use guard:** if there's no new grant to request AND every existing entry in
     `feature-list.json` is already in a terminal state (`verified` or `denied`), there is
     nothing to do — report that plainly and stop. Don't dispatch a subagent or prompt for MFA
     with nothing pending; that's what makes this skill safe to invoke on a recurring `/loop`
     without spamming the human. If invoked from `/loop`, this is a `noop: true` tick.

1. Confirm this is genuinely a missing grant — re-read the exact `AccessDenied` error, confirm
   the denied action + resource, rule out a caller-code bug (wrong ARN, wrong region, wrong
   profile).

2. Draft the minimal IAM statement: exact actions (no `service:*` wildcards), exact resource
   ARNs (never `Resource: "*"` unless the action is inherently resource-less — say so if used).
   Pick the target policy: `scribe-devops-infra` for ongoing operational grants (RDS/EC2/ECR/
   SSM/etc.), `scribe-devops-bootstrap` only for genuinely one-time bootstrap actions (state
   backend, OIDC provider/role management).

3. **Append a new entry to `feature-list.json`** before dispatching anything — status
   `requested`, with the drafted statement, target policy, acceptance/verify per the file's
   existing schema, and `blockedFeature` pointing at whatever `devops/feature-list.json` (or
   other) item this unblocks. This file IS the audit trail now that `devops/manual.md` is gone —
   don't skip it even for an "obvious" fix.

4. Flip the entry to `dispatched`, then dispatch a fresh subagent — `subagent_type:
   "general-purpose"`, `isolation: "worktree"` — with a self-contained prompt whose only job is
   applying this one grant:
   - Confirm `aws sts get-caller-identity --profile nimat-admin` resolves to
     `arn:...:user/nimat-admin`, never root.
   - Ask the human directly (a blocking question) for a fresh MFA code, then immediately assume
     `iam-grantor-devops-agent`:
     ```bash
     aws sts assume-role \
       --role-arn arn:aws:iam::404063516240:role/iam-grantor-devops-agent \
       --role-session-name grant-$(date +%s) \
       --serial-number <nimat-admin's MFA device ARN> \
       --token-code <fresh code> \
       --profile nimat-admin
     ```
     Codes are ~30s-valid — if it expires before use, ask for a fresh one rather than reusing a
     stale one.
   - Using the resulting temporary credentials, apply the statement:
     ```bash
     aws iam create-policy-version \
       --policy-arn arn:aws:iam::404063516240:policy/<target-policy> \
       --policy-document file://statement.json \
       --set-as-default
     ```
   - Verify the new version is actually the default (`list-policy-versions` /
     `get-policy-version`) — don't just trust the API call returning success.
   - Report back exactly what changed: which policy, which statement, confirmation it's live.
   - Include in the prompt: never suggest root as a shortcut; if the grantor role's own scope
     genuinely can't cover what's needed (e.g. a brand-new policy, a new IAM user), say so
     explicitly and stop rather than routing around it. Also: run
     `.claude/skills/devops-request-grant/cleanup.sh` before finishing, so no scratch
     `statement.json` or leftover env credentials survive the subagent.

5. Once the subagent reports success, flip the entry to `applied`, then **hand back to
   `devops-agent`** — resume with `AWS_PROFILE=devops-agent` and re-verify by re-attempting the
   actual originally-blocked operation for real. A version bump landing on the wrong policy, not
   being `--set-as-default`'d, or the `devops-agent-boundary` permissions boundary capping it are
   all real failure modes already seen in this workstream — don't trust the grant subagent's
   report alone. Only on a real, confirmed success does the entry flip to `verified`.

6. If it's still denied after the grant: flip the entry to `denied` with the exact new error in
   its `rubric` field, and repeat from step 2 with corrected scope — don't guess or retry
   blindly.

7. **Leave clean:** run `clean-state-checklist.md`'s leave-clean gate — `cleanup.sh`, overwrite
   `session-handoff.md`, prepend a dated `progress.md` entry, regenerate `graph.md`'s
   auto-generated section (`scripts/generate-feature-graph.py`, see the command in `graph.md`
   itself or `clean-state-checklist.md`) if any entry's `status`/`blockedFeature` changed, and
   (separately, via the normal `/devops` flow) update `devops/feature-list.json` if this grant
   unblocked one of its features.

8. **Evaluate, ideally separately:** score the cycle against `evaluator-rubric.md` — a subagent
   that didn't execute the grant gives a less biased read, same reasoning as the repo's other
   evaluator passes.

## Loop / scheduled use

This skill is safe to run under `/loop <interval> /devops-request-grant` — step 0's guard makes
every invocation with nothing pending a clean no-op rather than an unnecessary MFA prompt. Only
use a loop for this if you genuinely want it polled/re-attempted on a schedule (e.g. retrying a
recently-denied entry); for a one-off "I hit AccessDenied right now," just invoke it directly.

## Out of scope

- Don't run any AWS grant commands yourself in the top-level session — dispatch the subagent for
  that, per step 4. The point of the subagent boundary is that the MFA-gated credentials and the
  actual IAM write happen in one bounded, self-contained task.
- Don't widen a request beyond the literal minimal fix. "While we're at it" is a signal to stop
  and ask, not to draft a broader statement.
- Don't touch `devops/feature-list.json` from inside this skill's own dispatch flow — that's a
  separate, normal `/devops` step, kept deliberately decoupled so this skill's file stays a clean
  grant-request log, not a mixed-purpose file.
