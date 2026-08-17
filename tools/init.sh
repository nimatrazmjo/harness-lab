#!/usr/bin/env bash
# `pnpm setup` — install deps, start local pg+pgvector, run migrations, seed.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example (local dev defaults, AI_PROVIDER=mock)."
fi

echo "== Installing dependencies =="
pnpm install

echo "== Building shared libs (apps consume libs/*/dist, not source, at runtime) =="
pnpm run build:libs

echo "== Starting local Postgres + pgvector (infra/docker-compose.yml) =="
docker compose -f infra/docker-compose.yml up -d
echo "Waiting for Postgres to be healthy..."
until docker compose -f infra/docker-compose.yml ps postgres | grep -q "healthy"; do
  sleep 1
done

echo "== Running migrations =="
pnpm db:migrate

echo "== Seeding demo accounts + templates =="
pnpm db:seed

echo "== Embedding ICD-10 code set =="
pnpm icd10:embed

echo "Setup complete. Run 'pnpm dev' to start the API + web app."
