#!/usr/bin/env bash
# init.sh -- Verify the project builds cleanly before starting work.
# Run this after cloning, after pulling changes, or when resuming a session.
#
# Scope is deliberately narrow: install + typecheck + build. No Docker, no
# database, no seeding -- this never touches infrastructure or data, so it's
# safe and fast to run every single session.
#
#   - Just resumed work and want to know "does the code still compile"?
#     That's this script.
#   - First time on this machine, or need local Postgres/pgvector + seed data?
#     Use `pnpm setup` (which runs tools/init.sh) instead -- that's the
#     heavier, one-time environment bootstrap.
set -euo pipefail

cd "$(dirname "$0")"

echo "=== AI Clinical Scribe -- Build Verification ==="
echo ""
echo "[1/3] Installing dependencies..."
pnpm install
echo ""
echo "[2/3] Running type checks..."
pnpm run build:libs
pnpm -r run typecheck
echo ""
echo "[3/3] Building project..."
pnpm -r run build
echo ""
echo "=== Init complete. All checks passed. ==="
echo "Run 'pnpm dev' to launch the application."
