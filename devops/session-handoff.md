# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

`devops.dockerfile_api`, `devops.dockerfile_web`, `devops.terraform_backend`,
`devops.terraform_oidc_github`, `devops.ci_secret_scan` — all `passing`. First three merged to
`main`; `terraform_oidc_github`'s bug fixes are on PR #10, not yet merged; `ci_secret_scan` is
on PR #12, not yet merged (neither merged this session — don't merge on someone else's behalf).

**New this session:** `main` now has branch protection (previously had none) requiring the
`secret-scan` status check to pass before merge — added surgically, no other protection
settings enabled. This affects every future PR to `main` from any workstream, not just devops.

`devops.ci_secret_scan` (2026-08-18, this session) — **passing**.
`.github/workflows/secret-scan.yml` (`gitleaks/gitleaks-action@v2`, `pull_request` trigger)
runs on every PR. Verified for real: it fired and failed on its own introducing PR (caught a
literal fake key I'd accidentally written into `sprint-contract.md`'s docs — fixed, squashed
out of history, re-verified green); branch protection created fresh on `main` requiring it;
a genuine throwaway PR (#13, branched off the feature branch, closed+deleted after) with a fake
`AKIA...` string in `scratch.txt` got a **failing** `secret-scan` check and
`mergeStateStatus: BLOCKED`. Branch `feat/devops-ci-secret-scan`, PR #12 open, not merged.
Full detail: `devops/progress.md` 2026-08-18 entry.

`devops.terraform_ecr` — **`blocked`** (2026-08-18, this session), not resumable by an agent
alone. Terraform is fully written and correct (`infra/terraform/main.tf`:
`aws_ecr_repository.scribe` for_each over `scribe-api`/`scribe-web` with
`image_tag_mutability = "IMMUTABLE"` + `scan_on_push = true`, plus
`aws_ecr_lifecycle_policy.scribe_expire_untagged` expiring untagged images after 7 days).
`terraform plan` is clean (`4 to add, 0 to change, 0 to destroy`). `terraform apply` fails on a
real `AccessDenied` for `ecr:TagResource` on both repo ARNs — the existing
`scribe-devops-infra` policy's `EcrRepos` statement covers `CreateRepository` but not the
separate `TagResource` action that gets bundled into the same API call because of the
provider's `default_tags`. No partial resources created (confirmed via `describe-repositories`
and `terraform state list`). Exact minimal fix in `devops/manual.md` Step 9 — an admin needs to
add `ecr:TagResource`/`ecr:UntagResource`/`ecr:ListTagsForResource` to that policy's `EcrRepos`
statement (same `arn:aws:ecr:*:*:repository/scribe-*` scope) via `create-policy-version`.

Branch `feat/devops-terraform-ecr`, PR opened this session (see PR list / `gh pr list` for
URL) — **not merged**, contains real Terraform + docs changes, no faked `passing` status.

## Next feature to work

Once Step 9's grant lands: re-run `AWS_PROFILE=devops-agent terraform apply` in
`infra/terraform/` for `devops.terraform_ecr`, then the full verify sequence — especially the
**double-push immutability test** (push `scribe-api:smoke-test-tag` twice, second push must be
REJECTED — this is the load-bearing proof per the feature's acceptance criteria, not just
`describe-repositories` showing `IMMUTABLE`). Also run `aws ecr get-lifecycle-policy` for both
repos to confirm the untagged-7-day-expiry rule, and clean up the smoke-test tag afterward.

`devops.terraform_ecr` is still the only unblocked-in-principle-but-actually-blocked Tier 0
item — `terraform_networking_rds` and `terraform_compute_envs` are blocked for unrelated
reasons (domain name, sequencing). `devops.ci_secret_scan` (Tier 1, this session) had
`dependsOn: []` so it was explicitly dispatched ahead of full Tier 0 completion — that's a
one-off, not a change to the "Tier 0 before Tier 1" rule; don't treat it as license to jump to
other Tier 1 items (`ci_build_images`, `ci_image_scan_trivy`) without the same explicit
go-ahead. Flag Tier 0's blocked state back to the user rather than deciding unilaterally to
keep working Tier 1.

## Known gaps

- `GET /health` (`apps/api/src/health/health.controller.ts`) queries the DB pool directly — not
  a DB-independent liveness check. Relevant for `devops.ci_build_images` /
  `devops.ci_image_scan_trivy` later.
- The web container's `/api/*` proxy behavior was inspected, not curl-tested end-to-end.
- Domain name for certbot (`devops.terraform_compute_envs`) not yet decided.
- `devops-agent` IAM user cannot self-inspect its own policy (`iam:ListAttachedUserPolicies`/
  `ListUserPolicies`/`ListGroupsForUser` all `AccessDenied`) — verifying what's actually granted
  requires the AWS console or an admin profile.
- `devops-agent`'s create/manage IAM grants don't automatically cover verification/read actions
  like `iam:SimulatePrincipalPolicy` — a distinct category from the `Get*`/`Describe*`
  read-back gaps found in `devops.terraform_backend`.
- **New this session:** a resource's "create" action grant does not automatically cover
  `TagResource` when the Terraform AWS provider applies `default_tags` at creation time — a
  third distinct category of IAM gap (alongside "Create* doesn't cover Get*/Describe* read-back"
  and "manage actions don't cover Simulate*/verification actions") worth checking for
  proactively on the next new resource type (RDS, EC2) rather than discovering it fresh each
  time.
- **`workflow_dispatch` can get permanently stuck for a workflow's lifetime if its GitHub
  Actions "workflow ID" was first registered while the file only existed on a non-default
  branch** — merging to `main` does NOT reliably fix it. The `pull_request` trigger worked
  immediately and is the reliable fallback. Documented in `devops/manual.md`.
- `actionlint` (installed via `brew install actionlint`) is available locally — lint any
  new/edited workflow YAML with it before pushing.
- **New this session — refines the `workflow_dispatch` note above:** a brand-new
  `pull_request`-triggered workflow (no `workflow_dispatch`) DOES run on the very PR that
  introduces it (confirmed for `secret-scan.yml` on PR #12) — the "needs to exist on the
  default branch first" behavior observed for `oidc-smoke-test.yml` was specific to
  `workflow_dispatch`'s dispatch-eligibility cache, not a general `pull_request` limitation.
  The real remaining constraint: a `pull_request`-triggered workflow only fires for a PR whose
  diff/merge-view actually contains that workflow file — a PR based purely on unmerged `main`
  (which doesn't have the file yet) won't trigger it. That's why this session's smoke-test PR
  (#13) was branched off the feature branch itself rather than off `main`.
