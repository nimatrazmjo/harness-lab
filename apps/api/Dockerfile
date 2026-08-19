# syntax=docker/dockerfile:1
#
# Production image for apps/api (NestJS). Build from the REPO ROOT so this stage can reach the
# pnpm workspace libs apps/api depends on (workspace:* -> libs/shared-types, libs/ai):
#   docker build -t scribe-api:local -f apps/api/Dockerfile .
#
# Base image pinned by sha256 digest (not a floating tag) — devops.dockerfile_api acceptance #2.
# node:22-slim (Debian, glibc) rather than alpine: argon2/pg native/prebuilt bindings are safest
# on glibc. Node 22 (not the workspace's ">=20" floor) because packageManager pnpm@11.13.1
# itself requires Node >=22.13 to run at all (confirmed: pnpm 11 throws ERR_UNKNOWN_BUILTIN_MODULE
# node:sqlite under Node 20) — a runtime constraint of the pinned pnpm version, not a project
# choice; unrelated to and does not change apps/api's own "engines" >=20 floor.
ARG NODE_IMAGE=node:22-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436

# ---------------------------------------------------------------------------------------------
# Stage 1: build — installs full (dev+prod) deps, compiles TypeScript for the workspace libs
# apps/api needs plus apps/api itself, then prunes devDependencies back out.
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build

RUN corepack enable && corepack prepare pnpm@11.13.1 --activate

WORKDIR /repo

# Workspace manifests only first, so `pnpm install` is correctly resolved against the full
# lockfile and Docker layer caching isn't invalidated by unrelated source edits.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY libs/shared-types/package.json libs/shared-types/package.json
COPY libs/ai/package.json libs/ai/package.json

RUN pnpm install --frozen-lockfile

# Now the real source for what this image actually runs — libs first (apps/api depends on their
# built dist/ via workspace:*), then apps/api itself. apps/web source is intentionally never
# copied into this image.
COPY libs/shared-types libs/shared-types
COPY libs/ai libs/ai
COPY apps/api apps/api

RUN pnpm --filter @scribe/shared-types run build \
    && pnpm --filter @scribe/ai run build \
    && pnpm --filter api run build

# Re-install prod-only, then explicitly prune: `pnpm install --frozen-lockfile --prod` alone
# does NOT remove devDependencies that are already on disk from the full install above (it only
# controls what gets newly fetched) — confirmed by inspection: vite/vitest/esbuild (apps/web's
# and libs/*'s devDependencies) survived that step alone and were still being copied into the
# runtime image, tripping CRITICAL/HIGH CVEs in Trivy for tooling this image never runs
# (devops.ci_image_scan_trivy). `pnpm prune --prod` is the command that actually walks the
# workspace and deletes devDependency-only packages from node_modules/.pnpm.
# CI=true: non-interactive build, no TTY to confirm the modules-dir purge.
RUN CI=true pnpm install --frozen-lockfile --prod && pnpm prune --prod

# ---------------------------------------------------------------------------------------------
# Stage 2: runtime — slim image, only compiled JS + prod node_modules + package manifests.
# No TS source, no test/ dirs, no tsconfig, no build tooling, no apps/web — acceptance #1.
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime

# node:22-slim bundles the npm CLI (/usr/local/lib/node_modules/npm) — this image only ever
# runs `node apps/api/dist/main.js` (see CMD below), never npm/npx, so that bundled CLI and its
# own vendored dependency tree (tar, sigstore, ip-address, brace-expansion, picomatch, ...) are
# pure unused attack surface, not something this app calls. Trivy correctly flagged real
# CRITICAL/HIGH CVEs in that bundled npm tree (devops.ci_image_scan_trivy) — removing the CLI
# outright is the honest fix (less code shipped, not a suppressed finding); root still owns
# these files so this must run before `USER node` below.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

ENV NODE_ENV=production
WORKDIR /repo

# Mirror the build stage's relative layout under /repo so pnpm's (relative) symlinks from each
# package's node_modules into the shared /repo/node_modules/.pnpm store keep resolving.
COPY --from=build --chown=node:node /repo/node_modules ./node_modules
COPY --from=build --chown=node:node /repo/package.json ./package.json

COPY --from=build --chown=node:node /repo/libs/shared-types/dist ./libs/shared-types/dist
COPY --from=build --chown=node:node /repo/libs/shared-types/package.json ./libs/shared-types/package.json
COPY --from=build --chown=node:node /repo/libs/shared-types/node_modules ./libs/shared-types/node_modules

COPY --from=build --chown=node:node /repo/libs/ai/dist ./libs/ai/dist
COPY --from=build --chown=node:node /repo/libs/ai/package.json ./libs/ai/package.json
COPY --from=build --chown=node:node /repo/libs/ai/node_modules ./libs/ai/node_modules

COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules

# node:22-slim ships a built-in, unprivileged `node` user (uid/gid 1000) — no need to create one.
USER node

# main.ts binds 127.0.0.1 in production (nginx is the only thing reachable on 80/443 in real
# prod, per AGENTS.md [RDS-PRIVATE] / infra/nginx.conf) but 0.0.0.0 outside production, so a
# bare `docker run -p` smoke test without NODE_ENV=production (see apps/api/.env.example) can
# still reach it. NODE_ENV here only sets defaults consistent with real deploys; the smoke-test
# env file overrides it back to non-production for local `docker run` reachability.
ENV PORT=3000
EXPOSE 3000

CMD ["node", "apps/api/dist/main.js"]
