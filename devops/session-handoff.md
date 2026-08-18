# DevOps Session Handoff

_Overwritten each `/devops` session. Read this FIRST to resume — see devops/AGENTS.md Session
protocol. Separate from the repo-root `session-handoff.md` on purpose._

## Where things stand

`devops.dockerfile_api` is `passing` (2026-08-18) — `apps/api/Dockerfile` exists, built and
smoke-tested for real (see `devops/progress.md` for the full verify output). Branch
`feat/devops-dockerfile-api`, PR open (see below for URL once created). Everything else in
`devops/feature-list.json` (15 remaining features) is still `failing` or `blocked`.

## Next feature to work

**`devops.dockerfile_web`** (Tier 0, unblocked, no AWS needed) — the natural next pick, same
shape as the API one just finished.

Things learned building the API Dockerfile that likely transfer:
- This is a pnpm workspace monorepo (`apps/*`, `libs/*`). A build stage needs the full
  workspace manifest set copied first (`pnpm-lock.yaml`, `pnpm-workspace.yaml`, every workspace
  member's `package.json`, root `tsconfig.base.json`) before `pnpm install --frozen-lockfile`
  will resolve correctly — apps/web also depends on `@scribe/shared-types` (workspace:*), so its
  build stage needs that lib built too, same pattern as the API's.
- `packageManager: pnpm@11.13.1` needs Node **>=22.13** to run at all — use `node:22-slim`
  (or newer), not `node:20-slim`, as the base image, regardless of what the workspace's
  `engines` field says. Confirmed by hitting `ERR_UNKNOWN_BUILTIN_MODULE node:sqlite` under
  Node 20.
- `pnpm install --frozen-lockfile --prod` (to strip devDependencies before the final COPY)
  needs `CI=true` set, else it aborts non-interactively
  (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`).
- The web acceptance criteria call for nginx-unprivileged (or equivalent) serving static
  `dist/` — that's a different runtime-stage shape than the API's (no node_modules/pnpm
  concerns at all in the final image, since it's pure static files behind nginx). Pin nginx's
  base image by digest the same way.
- The web Dockerfile's verify command curls `/` for the app shell and expects the nginx
  container to also proxy `/api/*` per `infra/nginx.conf`'s existing rewrite rule — read that
  file before writing the Dockerfile's nginx config, don't invent a different one.

Do NOT start `devops.terraform_networking_rds` / `devops.terraform_compute_envs` — both
`blocked` on real AWS account access. Everything else in Tier 0
(`devops.terraform_backend`, `devops.terraform_oidc_github`, `devops.terraform_ecr`) needs an
AWS account too (to actually provision and `verify` against), so if account access still isn't
available, `devops.dockerfile_web` is the only real progress possible next session.

## Known gaps

- No AWS account connected yet — confirm with the user before attempting anything that needs
  `verify` commands to run against real AWS (Terraform apply, ECR push, etc.). Dockerfile items
  can be fully built and `verify`-tested locally with plain `docker build`/`docker run` — no AWS
  needed.
- Domain name for certbot (`devops.terraform_compute_envs`) not yet decided — ask before
  provisioning DNS/cert resources.
- `GET /health` (`apps/api/src/health/health.controller.ts`) queries the DB pool directly — it
  is NOT a DB-independent liveness check. The API Dockerfile's smoke test works around this by
  pointing at the already-running local `infra/docker-compose.yml` postgres via
  `host.docker.internal:5433` (see `apps/api/.env.example`). This is fine for local
  verification but worth knowing: any CI environment that runs this same smoke test will need
  an actual reachable Postgres too (e.g. a service container), not just `AI_PROVIDER=mock` —
  relevant for `devops.ci_build_validation` (dependsOn `devops.dockerfile_api`,
  `devops.dockerfile_web`) when that's picked up.
