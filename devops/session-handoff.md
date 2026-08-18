# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

All three Tier 0 items that don't need real AWS *networking/compute* are now `passing`:
- `devops.dockerfile_api` — `passing`. Merged (PR #5).
- `devops.dockerfile_web` — `passing`. Merged (PR #6).
- `devops.terraform_backend` — **`passing`** (2026-08-18, this session). Real S3 bucket
  (`scribe-terraform-state-404063516240`, versioning/SSE/public-access-block all confirmed
  live) + real DynamoDB lock table (`scribe-terraform-locks`, `ACTIVE`) provisioned and fully
  verified against real AWS — including an actual concurrent-apply lock test, not just
  config inspection. `infra/terraform/` now has a real remote state object. Full story
  (three rounds of IAM-permission discovery, each documented as it happened) in
  `devops/progress.md`'s 2026-08-18 entry and `devops/manual.md`.

**Not yet committed/PR'd**: the `devops.terraform_backend` status flip + this session's
progress/manual.md updates are sitting as local changes as of this handoff — commit them on a
branch/PR before starting anything else (see devops/AGENTS.md workflow rules — never commit to
`main` directly).

## Next feature to work

**`devops.terraform_oidc_github`** or **`devops.terraform_ecr`** (Tier 0, both `dependsOn:
["devops.terraform_backend"]`, now unblocked). Both need their own scoped `devops-agent` IAM
grant first — follow the same discover-by-running-it pattern documented in `devops/manual.md`
(start with the grant already drafted there for `terraform_oidc_github`'s OIDC provider + role
management, but expect a round 2/3 the same way `terraform_backend` needed — the AWS provider's
post-create read-backs reliably need more read permissions than initially obvious; don't assume
one grant is enough, test by actually running `terraform apply`).

`devops-agent` already has a `scribe-devops-infra` managed policy attached (EC2/RDS/ECR/SSM,
for later networking/compute/deploy features) — `terraform_ecr`'s `EcrRepos`/`EcrAuth`
statements in that policy may already cover what it needs; check before drafting a new grant.

**`devops.terraform_networking_rds`** / **`devops.terraform_compute_envs`** remain genuinely
`blocked` for the reasons already on file (domain name for certbot; sequencing after
OIDC/ECR/backend). Unaffected by this session.

## Known gaps

- `GET /health` (`apps/api/src/health/health.controller.ts`) queries the DB pool directly — it
  is NOT a DB-independent liveness check. Relevant for `devops.ci_build_images` /
  `devops.ci_image_scan_trivy` later — CI will need a real reachable Postgres service container.
- The web container's `/api/*` proxy behavior was inspected, not curl-tested end-to-end.
- Domain name for certbot (`devops.terraform_compute_envs`) not yet decided.
- `devops-agent` IAM user cannot self-inspect its own policy (`iam:ListAttachedUserPolicies`/
  `ListUserPolicies`/`ListGroupsForUser` all `AccessDenied`) — verifying what's actually granted
  requires the AWS console or an admin profile, not the agent asking itself.
- **New this session:** granting `devops-agent` permissions via IAM policy JSON is genuinely
  iterative in this account — expect 2-3 rounds per new AWS service touched (Terraform/AWS
  provider read-backs need more granular read permissions than the acceptance criteria alone
  suggest). Budget for this when picking up `terraform_oidc_github`/`terraform_ecr` rather than
  assuming a single upfront grant will be enough. `devops/manual.md` is the running log of every
  grant round so far — keep appending to it rather than starting fresh each time.
