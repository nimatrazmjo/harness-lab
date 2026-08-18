# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

Both Tier 0 Dockerfile items are `passing` and merged to `main`:
- `devops.dockerfile_api` — `passing`. PR https://github.com/nimatrazmjo/harness-lab/pull/5,
  merged.
- `devops.dockerfile_web` — `passing`. PR https://github.com/nimatrazmjo/harness-lab/pull/6,
  merged.

`devops.terraform_backend` — **`blocked`** (2026-08-18), on a branch/PR, NOT merged. Terraform
config for the S3 + DynamoDB remote state backend is fully written and ready to apply
(`infra/terraform-bootstrap/`, `infra/terraform/backend.tf`+`provider.tf`+`main.tf`), but the
`devops-agent` IAM user got real `AccessDenied` from AWS on `s3:CreateBucket` and
`dynamodb:CreateTable` when the (explicitly human-authorized) bootstrap `terraform apply` was
actually run. Full error text, the exact commands run, and the minimal IAM policy fix needed
are in `devops/progress.md`'s 2026-08-18 entry — read that before touching this again.

No AWS resources exist yet for this feature (confirmed: `aws s3api head-bucket` → 404, and
`terraform state list` shows no real resources — the failed apply created nothing).

## Next feature to work

**Not a new feature — first, get `devops.terraform_backend` actually unblocked:**
1. Someone with IAM admin access needs to grant `devops-agent` `s3:CreateBucket` +
   related S3 bucket-config actions + `dynamodb:CreateTable` + related table actions (exact
   list in `devops/progress.md`'s 2026-08-18 entry, "Minimal fix needed").
2. Once granted, re-run (from `infra/terraform-bootstrap/`, `AWS_PROFILE=devops-agent`):
   `terraform init` (already done, safe to skip) → `terraform plan -out=bootstrap.tfplan` →
   `terraform apply bootstrap.tfplan`. Then re-run the three `devops.terraform_backend` verify
   commands for real (`terraform init` in `infra/terraform/`, `terraform state list`, `aws
   s3api get-bucket-versioning`), plus the concurrent-apply lock test (two `terraform apply`
   processes racing in `infra/terraform-bootstrap/` — the sprint-contract's verification plan
   has the detail). Only then flip `devops.terraform_backend` to `passing`.
3. The branch `feat/devops-terraform-backend` already has the Terraform written — don't
   recreate it, just re-run apply on it (or a fresh branch off it) once IAM is fixed.

**After that unblocks**, `devops.terraform_oidc_github` and `devops.terraform_ecr` are the
natural next picks — both `dependsOn: ["devops.terraform_backend"]` and both want this remote
backend to exist before they provision anything.

**`devops.terraform_networking_rds`** / **`devops.terraform_compute_envs`** remain genuinely
`blocked` for the reasons already on file (domain name for certbot; sequencing after
OIDC/ECR/backend). Unaffected by this session.

## Known gaps

- `GET /health` (`apps/api/src/health/health.controller.ts`) queries the DB pool directly — it
  is NOT a DB-independent liveness check. Relevant for `devops.ci_build_images` /
  `devops.ci_image_scan_trivy` later — CI will need a real reachable Postgres service container.
- The web container's `/api/*` proxy behavior was inspected, not curl-tested end-to-end.
- Domain name for certbot (`devops.terraform_compute_envs`) not yet decided.
- **New this session:** `devops-agent` IAM user cannot self-inspect its own policy
  (`iam:ListAttachedUserPolicies`/`ListUserPolicies`/`ListGroupsForUser` all `AccessDenied`
  too) — whoever fixes the S3/DynamoDB permissions will need to check the IAM console or
  CloudTrail directly rather than asking the agent to confirm the current policy.
