#!/usr/bin/env bash
# .claude/skills/review-web/init.sh -- toolchain gate for the review-web skill.
# Run first, every invocation. Checks the CLIs this skill needs exist and its own
# feature-list.json is valid JSON. Does NOT run the full app build -- that's the repo-root
# `bash init.sh`, which the review procedure runs separately against the actual PR/branch when
# it needs a real build-verify signal, not duplicated here.
set -euo pipefail

cd "$(dirname "$0")"

echo "=== review-web skill -- Toolchain Verification ==="
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
check node "running frontend tests"
check pnpm "apps/web's package manager"
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
