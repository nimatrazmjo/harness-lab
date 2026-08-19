#!/usr/bin/env bash
# .claude/skills/review-api/init.sh -- toolchain gate for the review-api skill.
# Run first, every invocation. Checks the CLIs this skill needs exist and its own
# feature-list.json is valid JSON. Does NOT run the full app build -- see review-web/init.sh's
# comment, same reasoning.
set -euo pipefail

cd "$(dirname "$0")"

echo "=== review-api skill -- Toolchain Verification ==="
echo ""

missing=0
check() {
  if command -v "$1" >/dev/null 2>&1; then
    echo "  [ok] $1 ($(command -v "$1"))"
  else
    echo "  [MISSING] $1 -- required for $2"
    missing=1
  fi
}

echo "[1/2] Checking required CLIs..."
check git "committing/pushing the reviewed branch"
check gh "opening/commenting on/inspecting the PR"
check node "running backend tests"
check pnpm "apps/api's package manager"
check docker "local pg+pgvector for e2e tests"
check jq "parsing gh/GitHub API output"
check python3 "validating this skill's feature-list.json"
echo ""

echo "[2/2] Checking feature-list.json is valid JSON..."
python3 -c "import json; json.load(open('feature-list.json'))" \
  && echo "  [ok] feature-list.json parses" \
  || { echo "  [FAIL] feature-list.json is not valid JSON"; missing=1; }
echo ""

if [ "$missing" -eq 1 ]; then
  echo "=== Toolchain incomplete. Install the missing tools above before starting a review. ==="
  exit 1
fi

echo "=== Toolchain ready. Read session-handoff.md next. ==="
