# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

Both Tier 0 Dockerfile items are done, each on its own branch/PR (neither merged to `main`
yet as of writing):
- `devops.dockerfile_api` — `passing`. Branch `feat/devops-dockerfile-api`, PR
  https://github.com/nimatrazmjo/harness-lab/pull/5.
- `devops.dockerfile_web` — `passing`. Branch `feat/devops-dockerfile-web`, PR opened this
  session (see git remote / `gh pr list` for the URL if not recorded here yet).

Both PRs were cut from `main` independently in the same session, so each PR's
`devops/feature-list.json` diff only flips its own feature's status line — they don't
conflict with each other (different lines) but `devops/progress.md` and this file were fully
rewritten in both, so **whoever merges second will hit a conflict in those two files** —
resolve by keeping both PRs' log entries (progress.md is append/prepend-only anyway) and
writing a fresh combined "Current state" / this handoff reflecting both landed.

AWS credentials ARE confirmed working this session (`devops/init.sh` resolved
`arn:aws:iam::404063516240:user/devops-agent` via `AWS_PROFILE=devops-agent`) — unlike what
the previous handoff assumed, real-AWS Tier 0 items (`terraform_backend`,
`terraform_oidc_github`, `terraform_ecr`) are NOT actually blocked on account access anymore.
They involve provisioning real (if small/reversible) AWS resources — S3 bucket, DynamoDB
table, IAM OIDC provider/role — which is a bigger step than a local Docker build. Flag this to
the user before provisioning anything real; don't just auto-provision because credentials
happen to resolve.

## Next feature to work

Once both Dockerfile PRs are merged (or in parallel, doesn't block): **`devops.terraform_backend`**
(Tier 0, unblocked, needs real AWS — S3 + DynamoDB state backend, bootstrapped once outside
the main Terraform config). This is the natural next pick since `devops.terraform_oidc_github`
and `devops.terraform_ecr` will want a remote state backend to write into rather than local
`.tfstate` (never committed, and AGENTS.md's clean-state gates assume no local state file left
behind).

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
- Both Dockerfile branches independently wrote a repo-root `.dockerignore` from scratch (see
  "Where things stand" above) — expect a merge conflict there; both versions have the same
  intent (exclude node_modules/dist/build/coverage/.git, keep both apps' `src/` present), so
  reconciling is mechanical, not a design decision.
