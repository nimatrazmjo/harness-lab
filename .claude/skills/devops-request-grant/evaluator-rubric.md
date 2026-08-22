# devops-request-grant — Evaluator Rubric

Adversarial scorecard applied AFTER a grant request resolves (`verified` or `denied`) — ideally
by a separate pass/subagent that didn't execute the grant, same reasoning as the repo-root and
`devops/` rubrics: an agent grading its own fresh work skews positive.

Score each dimension PASS / CONDITIONAL / FAIL for the `feature-list.json` entry under review.
A CONDITIONAL needs a stated reason and either a same-session fix or an explicit note in
`session-handoff.md` for why it's deferred. Never fabricate the answer to a check that requires a
real AWS call.

## 1. Minimality

- [ ] The applied statement's `Action` list has no `service:*`-style wildcard broader than what
      was actually needed.
- [ ] The applied statement's `Resource` is a specific ARN, not `"*"` — unless the action is
      genuinely resource-less (e.g. `sts:GetCallerIdentity`), and that exception is stated
      explicitly in the entry.
- [ ] Nothing beyond the literal blocking gap was requested — no "while we're at it" additions.

## 2. Correct target

- [ ] The statement landed on the right policy (`scribe-devops-infra` for ongoing operational
      grants, `scribe-devops-bootstrap` only for genuine one-time bootstrap actions) — verified
      via `get-policy-version`, not assumed from the request.
- [ ] The new policy version is actually `--set-as-default` — a version created but not made
      default is a silent no-op; confirmed via `list-policy-versions`.

## 3. Real re-verification, not a trusted report

- [ ] `verified` status is backed by re-attempting the **actual originally-blocked operation**
      with `AWS_PROFILE=devops-agent`, not just re-checking the policy document text.
- [ ] If still denied after the grant, the entry's `rubric` field states the exact new error —
      not "should work now" without having run it.

## 4. Credential discipline

- [ ] Root was never used, anywhere in this cycle — not by the human, not suggested to them.
- [ ] The grant-subagent used `nimat-admin` (MFA-gated assume-role), not a static long-lived key
      with standing IAM-write permissions.
- [ ] No assumed-role credentials were left exported in a shell or written to a persistent file
      after the subagent finished (`cleanup.sh` was run — see Clean State Checklist).

## 5. Audit trail

- [ ] The `feature-list.json` entry itself is a complete, honest record — drafted statement,
      target policy, real verify evidence, terminal status.
- [ ] If this grant unblocked a `devops/feature-list.json` feature, that link is recorded
      (`blockedFeature` field) and that file was updated separately.
- [ ] `progress.md` has a dated entry; `graph.md` reflects the new edge if one was added.

## Verdict

State PASS / CONDITIONAL (with reason + fix-or-deferred note) / FAIL for the cycle as a whole,
not just per-dimension. A FAIL on dimension 3 (trusting a report instead of re-verifying) should
be treated as seriously as a FAIL on dimension 4 (credential discipline) — both defeat the
entire point of this skill existing.
