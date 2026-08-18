# Progress Log — DevOps / CI-CD workstream

Rolling log for the `devops/` workstream only — separate from the repo-root `progress.md` on
purpose, so a product-coding session never has to load infra history into context. Read at the
**start** of every `/devops` session, updated at the **end**. Newest entry on top.

> **How to maintain (agent):**
> - **Session start:** read "Current state" below, then the latest 2–3 log entries.
> - **After each feature / session end:** update "Current state" and prepend a dated entry.
> - Reference features by their `devops/feature-list.json` id. Keep entries short: what changed,
>   what's next, and whether it's actually `verify`-green or still `blocked`.

---

## Current state

`devops.dockerfile_api` and `devops.dockerfile_web` are both `passing` and merged to `main`
(2026-08-18) — `apps/api/Dockerfile` and `apps/web/Dockerfile` built and smoke-tested for
real. All Tier 0 items needing no AWS access are done — only the two AWS-account-blocked items
(`terraform_networking_rds`, `terraform_compute_envs`) plus three unblocked-but-needs-real-AWS
items (`terraform_backend`, `terraform_oidc_github`, `terraform_ecr`) remain in Tier 0.

## Log

### 2026-08-18 — devops.dockerfile_web: passing
Multi-stage `apps/web/Dockerfile`, sibling to the just-finished `devops.dockerfile_api`.
Build stage: `node:22-slim` (same digest as the API image, same reason — `pnpm@11.13.1`
requires Node >=22.13 to run at all), builds `@scribe/shared-types` then `pnpm --filter web
run build` (`tsc --noEmit && vite build` -> `apps/web/dist`). Runtime stage:
`nginxinc/nginx-unprivileged:stable-alpine` pinned by sha256 digest — ships a built-in
non-root `nginx` user (uid 101) and listens on 8080 by default, so no manual non-root setup
needed. COPYs only the built `dist/` into `/usr/share/nginx/html`; no `node_modules`, no
`.ts`/`.tsx` source anywhere in the final image (confirmed via `find` inside the running
container — both empty).

New `apps/web/nginx.container.conf.template` — an envsubst template (processed by the base
image's built-in `20-envsubst-on-templates.sh` entrypoint into
`/etc/nginx/conf.d/default.conf` at container start) mirroring `infra/nginx.conf`'s two
`/api/*` location blocks verbatim in intent: the SSE-safe `proxy_buffering off` route for
`/api/encounters/*/scribe/*` (note-generation streaming) and the generic `/api/` strip-and-
proxy for everything else, plus `location / { try_files $uri /index.html; }` for the SPA.
Upstream host is `${API_UPSTREAM}`, defaulted to the literal IP `http://127.0.0.1:3000` (not a
DNS name) specifically so nginx never fails to *start* when no API container is linked, as in
this feature's standalone smoke test — a real docker-compose deployment overrides it.
`infra/nginx.conf` itself untouched (read for reference only — it's the real EC2-host config
that also does TLS termination, a different job than this container's).

`.dockerignore`: written fresh on this branch (cut from `main` before the API Dockerfile PR
merged) — kept both `apps/api/src` and `apps/web/src` un-excluded since both Dockerfiles now
need their own app's source when this and the API branch eventually share one `.dockerignore`
on `main`.

Ran every literal `verify` command for real, end-to-end: `docker build` -> 0 exit; `docker run
-d -p 8099:8080` -> container up, nginx logs show config templated and workers started; `curl
-f http://localhost:8099/ | grep -qi 'AI Clinical Scribe'` -> matched (index.html's `<title>`);
`docker stop` -> clean. Extra evidence: `docker exec ... id` -> `uid=101(nginx)`; `nginx -t`
inside the container -> syntax ok; rendered `/etc/nginx/conf.d/default.conf` inspected and
confirmed the `/api/` and SSE-route blocks match `infra/nginx.conf`'s rewrite/proxy_buffering
behavior (verify command itself never exercises the proxy — no linked API container — so this
part is inspected, not curl-tested).

`devops/feature-list.json` → `devops.dockerfile_web` `passing`. Next: both Dockerfile PRs are
merged — pick up `devops.terraform_backend` or `devops.terraform_oidc_github` (Tier 0,
unblocked, no real-AWS-account provisioning needed for backend/OIDC bootstrap itself — just
`terraform init`/`plan` against the account already available via the `devops-agent` profile).

### 2026-08-18 — devops.dockerfile_api: passing
Multi-stage `apps/api/Dockerfile` (`node:22-slim` pinned by sha256 digest — see below for why
22 not the workspace's ">=20" floor). Build stage: `pnpm install --frozen-lockfile` (needs
`apps/api`, `apps/web`, `libs/shared-types`, `libs/ai` package.json + root
`tsconfig.base.json` copied first), builds `@scribe/shared-types` -> `@scribe/ai` -> `api` in
dependency order, then `CI=true pnpm install --frozen-lockfile --prod` prunes devDeps.
Runtime stage mirrors the build stage's `/repo` layout (so pnpm's relative node_modules
symlinks into the shared `.pnpm` store keep resolving) and COPYs only `dist/` +
`package.json` + `node_modules` per package — no `src/`, `test/`, `tsconfig*`, `apps/web`.
Runs as the base image's built-in `node` user (uid 1000).

New: `apps/api/Dockerfile`, `apps/api/.env.example` (didn't exist before — the feature's
`verify` commands need it for `--env-file`; docker-smoke-only values, no real secrets),
root `.dockerignore` (didn't exist before).

Two real findings, recorded in the Dockerfile/`.env.example` comments and
`devops/session-handoff.md`:
- `packageManager: pnpm@11.13.1` requires Node >=22.13 to run at all (confirmed:
  `ERR_UNKNOWN_BUILTIN_MODULE node:sqlite` under Node 20) — forced the base image to
  `node:22-slim`, not the workspace's `engines: >=20`. This is pnpm's own runtime floor, not a
  choice about the app's target Node version.
- `GET /health` (`apps/api/src/health/health.controller.ts`) queries the DB pool directly —
  it is not a DB-independent liveness check. Verified real 200 by pointing
  `apps/api/.env.example`'s `DATABASE_URL` at `host.docker.internal:5433`, the already-running
  local `scribe-postgres` compose container (`infra/docker-compose.yml`) — no AWS, no faked
  backend beyond what the task already allowed (`AI_PROVIDER=mock`). No app-code touched.

Ran every literal `verify` command from `devops/feature-list.json` for real, in order,
end-to-end: `docker build` → 0 exit; `docker run -d --env-file apps/api/.env.example -e
AI_PROVIDER=mock` → container up, Nest logs show all modules initialized + all routes mapped;
`curl -f http://localhost:3099/health` → `{"status":"ok","db":true}`; `docker exec ... whoami |
grep -v root` → `node` (exit 0); `docker stop` → clean. Extra evidence beyond the literal list:
`find / -name '*.ts' -not -name '*.d.ts' -not -path '*/node_modules/*'` inside the built image
→ empty (no real TS source shipped, only compiled `.d.ts` alongside `dist/`); `node_modules`
has no `typescript`/`jest`/`ts-node` (devDeps pruned); `id` inside container →
`uid=1000(node) gid=1000(node)`.

`devops/feature-list.json` → `devops.dockerfile_api` `passing`. Next:
`devops.dockerfile_web` (sibling Tier 0 item, same unblocked status, no AWS needed).

### 2026-08-18 — workstream created, isolated from root context
Moved `devops-feature-list.json` from repo root into `devops/feature-list.json`, added
`devops/AGENTS.md` (scoped harness contract) + `devops/CLAUDE.md` (bridge) + this file, and a
`/devops` skill (`.claude/skills/devops/SKILL.md`) that dispatches the actual work to a
worktree-isolated subagent — so neither the devops context nor its work-in-progress ever
lands in a normal coding session. Root `AGENTS.md` trimmed to a one-line pointer. Next: pick up
`devops.dockerfile_api` or `devops.dockerfile_web` (Tier 0, unblocked, no AWS access needed).
