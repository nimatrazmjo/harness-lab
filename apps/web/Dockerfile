# syntax=docker/dockerfile:1
#
# Production image for apps/web (Vite/React). Build from the REPO ROOT so this stage can reach
# the pnpm workspace lib apps/web depends on (workspace:* -> libs/shared-types):
#   docker build -t scribe-web:local -f apps/web/Dockerfile .
#
# Both base images pinned by sha256 digest (not a floating tag) — devops.dockerfile_web
# acceptance #2.
ARG NODE_IMAGE=node:22-slim@sha256:d649c27dae7ba0137b3cef5dd75baa422c08dc3d9e3fc0c23dfb172dc3cc6436
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:stable-alpine@sha256:44e36330f74d4f3a1d4e222acca9e23b401fb87811a7597024502bb759c4dd49

# ---------------------------------------------------------------------------------------------
# Stage 1: build — installs full (dev+prod) deps, compiles the workspace lib apps/web needs,
# then runs the real build (`tsc --noEmit && vite build`) into apps/web/dist.
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build

# node:22-slim (not the workspace's ">=20" engines floor): packageManager pnpm@11.13.1 itself
# requires Node >=22.13 to run at all (ERR_UNKNOWN_BUILTIN_MODULE node:sqlite under Node 20) —
# confirmed building apps/api/Dockerfile. Unrelated to and doesn't change apps/web's own target.
RUN corepack enable && corepack prepare pnpm@11.13.1 --activate

WORKDIR /repo

# Workspace manifests only first, so `pnpm install` is correctly resolved against the full
# lockfile and Docker layer caching isn't invalidated by unrelated source edits.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY libs/shared-types/package.json libs/shared-types/package.json
COPY libs/ai/package.json libs/ai/package.json

RUN pnpm install --frozen-lockfile

# Only the source this image actually needs: libs/shared-types (apps/web's workspace:*
# dependency) and apps/web itself. apps/api source is intentionally never copied in.
COPY libs/shared-types libs/shared-types
COPY apps/web apps/web

RUN pnpm --filter @scribe/shared-types run build \
    && pnpm --filter web run build

# ---------------------------------------------------------------------------------------------
# Stage 2: runtime — nginx-unprivileged serving only the built static bundle. No node_modules,
# no source, no build tooling — acceptance #1. Non-root by construction — acceptance #3.
# ---------------------------------------------------------------------------------------------
FROM ${NGINX_IMAGE} AS runtime

COPY --from=build --chown=nginx:nginx /repo/apps/web/dist /usr/share/nginx/html
COPY --chown=nginx:nginx apps/web/nginx.container.conf.template /etc/nginx/templates/default.conf.template

# Default upstream is a literal IP (not a DNS name) so nginx never fails to *start* even with no
# API container linked (e.g. this feature's standalone smoke test) — DNS names only get resolved
# lazily at request time, but envsubst bakes this into a static nginx directive at container
# start, which nginx resolves eagerly at config-load time. A real docker-compose deployment
# overrides API_UPSTREAM to the actual API service's address.
ENV API_UPSTREAM=http://127.0.0.1:3000

# nginxinc/nginx-unprivileged already runs as its built-in non-root `nginx` user (uid 101) and
# listens on 8080 by default — no USER/EXPOSE override needed, kept explicit for clarity.
USER nginx
EXPOSE 8080
