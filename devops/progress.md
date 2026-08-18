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

`devops.dockerfile_api` is `passing` (2026-08-18) — `apps/api/Dockerfile` built and
smoke-tested for real. `devops.dockerfile_web` and the rest of Tier 0 are still `failing`
(unblocked) or `blocked` (the two real-AWS items). No Terraform, no workflows exist yet.

## Log

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
