# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

Both Tier 0 Dockerfile items are `passing` and merged to `main`:
- `devops.dockerfile_api` — `passing`. Branch `feat/devops-dockerfile-api`, PR
  https://github.com/nimatrazmjo/harness-lab/pull/5, merged.
- `devops.dockerfile_web` — `passing`. Branch `feat/devops-dockerfile-web`, PR
  https://github.com/nimatrazmjo/harness-lab/pull/6, merging now (this branch was rebased/
  merged against `main` post-#5 to resolve the expected `.dockerignore` + tracking-file
  conflict — see progress.md).

All Tier 0 items that need no AWS access are now done. Only three Tier 0 items remain:
`terraform_backend`, `terraform_oidc_github`, `terraform_ecr` (all unblocked, need real AWS),
plus the two genuinely `blocked` items below.

AWS credentials ARE confirmed working this session (`devops/init.sh` resolved
`arn:aws:iam::404063516240:user/devops-agent` via `AWS_PROFILE=devops-agent`) — unlike what
an earlier handoff assumed, real-AWS Tier 0 items (`terraform_backend`,
`terraform_oidc_github`, `terraform_ecr`) are NOT actually blocked on account access anymore.
They involve provisioning real (if small/reversible) AWS resources — S3 bucket, DynamoDB
table, IAM OIDC provider/role — which is a bigger step than a local Docker build. Flag this to
the user before provisioning anything real; don't just auto-provision because credentials
happen to resolve.

## Next feature to work

**`devops.terraform_backend`** (Tier 0, unblocked, needs real AWS — S3 + DynamoDB state
backend, bootstrapped once outside the main Terraform config). This is the natural next pick
since `devops.terraform_oidc_github` and `devops.terraform_ecr` will want a remote state
backend to write into rather than local `.tfstate` (never committed, and AGENTS.md's
clean-state gates assume no local state file left behind). Get explicit user go-ahead before
provisioning real AWS resources, unlike the Dockerfile items which were fully local.

**`devops.terraform_networking_rds`** / **`devops.terraform_compute_envs`** remain genuinely
`blocked` — not on AWS access, but on: a decided domain name for certbot
(`terraform_compute_envs`), and generally being larger/riskier applies best done after the
OIDC/ECR/backend foundation exists so CI can eventually own `terraform apply` (per
devops/AGENTS.md: "`terraform apply` only ever runs from CI on merge to main" — running it
locally against real/shared infra state should stay rare and explicit).

## Known gaps

- `GET /health` (`apps/api/src/health/health.controller.ts`) queries the DB pool directly — it
  is NOT a DB-independent liveness check. The API Dockerfile's smoke test works around this by
  pointing at the already-running local `infra/docker-compose.yml` postgres via
  `host.docker.internal:5433` (see `apps/api/.env.example`). Relevant for
  `devops.ci_build_images` / `devops.ci_image_scan_trivy` later — CI will need a real reachable
  Postgres service container for the API image's health check to pass, not just
  `AI_PROVIDER=mock`.
- The web container's `/api/*` proxy behavior was inspected (rendered nginx conf +
  `nginx -t`), not curl-tested — the feature's literal `verify` command never links an API
  container, so the proxy path was never actually exercised end-to-end. Worth a real
  docker-compose-based smoke test (API + web + real `/api/*` round trip) at some point, maybe
  as part of `devops.ci_build_images`.
- Domain name for certbot (`devops.terraform_compute_envs`) not yet decided — ask before
  provisioning DNS/cert resources.
