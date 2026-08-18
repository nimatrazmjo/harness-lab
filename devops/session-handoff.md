# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

`devops.dockerfile_api`, `devops.dockerfile_web`, `devops.terraform_backend`,
`devops.terraform_oidc_github` — all `passing`, all merged to `main`.

`devops.terraform_ecr` — **`passing`** (2026-08-18, this session). Both ECR repos
(`scribe-api`, `scribe-web`) live in AWS: `imageTagMutability = IMMUTABLE`, `scanOnPush = true`,
7-day untagged-image expiry lifecycle policy — all confirmed via direct AWS API calls.
Immutability proven with a **real double-push test**: pushed `alpine:3.19` as
`scribe-api:smoke-test-tag` (succeeded), then pushed a different image to the same tag —
rejected by ECR with "cannot be overwritten because the tag is immutable." Took 2 rounds of IAM
grants past the initial blocked state (`devops/manual.md` Steps 9-10). Branch
`feat/devops-terraform-ecr`, PR #11 — **not yet merged**, needs a normal merge.

**All Tier 0 items that don't need real EC2/RDS networking are now `passing`.** Only
`devops.terraform_networking_rds` and `devops.terraform_compute_envs` remain in Tier 0, both
genuinely `blocked` for unrelated reasons (see below) — not an agent-actionable gap right now.

## Next feature to work

**Merge PR #11 first**, then two paths forward:

1. **`devops.terraform_networking_rds`/`devops.terraform_compute_envs`** — if a domain name for
   certbot has been decided and the user wants to proceed with VPC/RDS/EC2 provisioning (bigger,
   riskier applies than anything so far — get explicit go-ahead, same as every real-AWS step in
   this workstream).
2. **Tier 1 (CI gates)** — `devops.ci_secret_scan`, `devops.ci_build_images`,
   `devops.ci_image_scan_trivy` don't depend on the RDS/EC2 items, so per `devops/AGENTS.md`'s
   "Tier 0 must be fully `passing` before Tier 1 starts" rule, technically Tier 0 isn't 100%
   done (2 blocked items remain) — **check with the user whether "Tier 0 done" should be
   interpreted as "everything not blocked on an external decision" before jumping to Tier 1**,
   since the two remaining Tier 0 items aren't stalled on IAM/technical issues, just a pending
   product decision (domain name) and their own inherent risk level.

## Known gaps

- `GET /health` (`apps/api/src/health/health.controller.ts`) queries the DB pool directly — not
  a DB-independent liveness check. Relevant for `devops.ci_build_images` /
  `devops.ci_image_scan_trivy` later.
- The web container's `/api/*` proxy behavior was inspected, not curl-tested end-to-end.
- Domain name for certbot (`devops.terraform_compute_envs`) not yet decided.
- `devops-agent` IAM user cannot self-inspect its own policy — verifying what's actually
  granted requires the AWS console or an admin profile.
- `devops-agent`'s create/manage IAM grants don't automatically cover verification/read actions
  like `iam:SimulatePrincipalPolicy`, and a resource's "create" grant doesn't automatically
  cover `TagResource` when the provider applies `default_tags` at creation time. Both are
  distinct gap categories from the `Get*`/`Describe*` read-back gaps — check proactively for
  all three categories (create, tag-on-create, read-back) on the next new resource type
  (RDS, EC2) rather than discovering each fresh.
- **A GitHub Actions workflow's `workflow_dispatch` trigger can get permanently stuck if its
  workflow ID was first registered on a non-default branch** — merging to `main` does not fix
  it. Use the `pull_request` trigger instead if this happens again. Documented in
  `devops/manual.md`.
- `actionlint` (installed via `brew install actionlint`) is available locally — lint any
  new/edited workflow YAML with it before pushing.
- **New this session:** `devops-agent` also lacks `ecr:BatchDeleteImage` — couldn't clean up
  the `scribe-api:smoke-test-tag` throwaway image after the double-push test. It's harmless
  (an alpine test image) and will persist indefinitely since the lifecycle policy only expires
  *untagged* images. Not worth a dedicated IAM round; grant `ecr:BatchDeleteImage` later only
  if actually needed for something else.
