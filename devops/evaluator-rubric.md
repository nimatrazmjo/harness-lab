# Evaluator Rubric — DevOps / CI-CD workstream

The scorecard a **separate evaluation pass** uses to decide whether a devops sprint is
_actually_ done — judged skeptically, with evidence, against `devops/sprint-contract.md`. Same
counterweight as the repo-root `evaluator-rubric.md`: agents (including this one) grade their
own infra work far too generously, and infra is exactly the domain where "looks right" and
"is actually provisioned/secure" diverge most dangerously.

## How to run it

- **Separate the evaluator from the generator.** Run this as a **fresh session or subagent that
  did not write the Terraform/workflow/Dockerfile.** Give it: the diff, `devops/sprint-contract.md`,
  this rubric, and real access to run the `verify` commands (or explicit acknowledgment that a
  command couldn't run for a stated reason, e.g. no AWS access).
- **Adversarial stance, infra-specific.** Don't just confirm the resource exists — try to break
  the property that matters: can you actually reach RDS from outside the VPC? Does pushing the
  same tag twice actually get rejected, or does the immutability setting just look right in the
  Terraform file? Did the OIDC role's trust policy actually reject an unrelated repo, or was that
  never tested?
- **Evidence, not vibes, and not `terraform plan`.** A plan showing "0 to add, 0 to change" is
  evidence the *config* is idempotent — it is NOT evidence the *real resource* behaves correctly.
  Every PASS cites a command run against the real target (or the real running pipeline) and its
  actual output.

## Verdicts

- **PASS** — met, with cited evidence from the real target.
- **CONDITIONAL** — met with a noted caveat/risk; may proceed only if non-blocking.
- **FAIL** — not met, no evidence, or evidence came from a mock/plan-only/local-simulated source
  when the contract required the real thing.

---

## Dimensions (score every one)

**1. Contract fulfillment.** Every _Done condition_ in `devops/sprint-contract.md` is checked
with evidence. Any unchecked condition → FAIL.

**2. Correctness (real target, not a mock).** Every `verify` command in the feature's
`devops/feature-list.json` entry was actually run, against the real AWS account / real pushed
image / real running workflow — not `terraform validate`, not a local Docker Desktop stand-in
for something the contract requires to be verified in AWS.

**3. Invariants intact — devops/AGENTS.md non-negotiables + root AGENTS.md §2 (hard gates; any
violation FAILS the sprint).**

- No static AWS credentials anywhere (grep workflows, grep GitHub secrets list) — OIDC only.
- No `latest` tag anywhere in a workflow, Dockerfile, or compose file that references an image.
- ECR tag immutability actually rejects a repeat push (tested, not assumed).
- No-touch zone respected: `git diff` shows nothing under `apps/*/src` or `libs/**`.
- `terraform apply` never ran against real/shared state from a local machine (check
  `devops/progress.md`'s log, and CI run history).
- [SECRETS] (root AGENTS.md): nothing sensitive committed, including `.tfvars` with real values.
- [RDS-PRIVATE] (root AGENTS.md), if this sprint touched networking: RDS still has no public IP.

**4. Verification quality (are the `verify` commands real tests?).** Inspect the commands
themselves, not just whether they were run. A `verify` step that only checks a Terraform
resource block exists in `.tf` source (not that it was actually applied and is live) is a
tautological test → FAIL this dimension even if it "passed." Streaming-safety checks (for
`devops.terraform_compute_envs`) must show actual multiple timestamped chunks over a real
request, not just "nginx.conf contains proxy_buffering off."

**5. No regressions.** Product `pnpm verify` still green (a devops change should never break
product code — enforced by the no-touch zone, but confirm). Previously-passing devops features'
`verify` commands still pass if re-run (a later Terraform change didn't quietly break an earlier
one — e.g. a networking change didn't reopen RDS to the public).

**6. Scope discipline.** Nothing built outside the contract. No accidental provisioning of
resources not named in the sprint (check `terraform plan`/`state list` for surprises). No drift
into product code.

**7. Explainability (walkthrough readiness).** Every non-trivial infra decision can be defended
aloud — why OIDC over static keys, why Docker Compose on EC2 over ECS (the documented
`docs/ARCHITECTURE.md:54` SSE-buffering reason), why this IAM policy shape, why this tag
strategy. If it can't be explained, it isn't done.

---

## Output (the evaluator fills this in)

_No devops sprint has been evaluated yet — this workstream was just created (2026-08-18)._
Prior evaluations, once they exist, are preserved in git history the same way the repo-root
rubric preserves them (search commit messages); this section holds the latest sprint only.

**Sprint:** _none yet_
