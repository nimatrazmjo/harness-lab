#!/usr/bin/env bash
# .claude/skills/review-harness/init.sh -- toolchain gate for the review-harness skill.
set -euo pipefail

cd "$(dirname "$0")"

echo "=== review-harness skill -- Toolchain Verification ==="
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
check jq "parsing gh/GitHub API output"
check python3 "validating this skill's feature-list.json and any feature-list.json under review"
if command -v markdownlint >/dev/null 2>&1; then
  echo "  [ok] markdownlint ($(command -v markdownlint)) -- optional, will use if present"
else
  echo "  [info] markdownlint not installed -- optional soft-check, not required"
fi
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
