#!/usr/bin/env bash
# .claude/skills/review-infra/init.sh -- toolchain gate for the review-infra skill.
# Mirrors devops/init.sh's checks, including its hard root-credential breakpoint -- this domain
# touches real AWS state during review verification (re-running `verify` commands), so the same
# rule applies with the same force.
set -euo pipefail

cd "$(dirname "$0")"

echo "=== review-infra skill -- Toolchain Verification ==="
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

echo "[1/3] Checking required CLIs..."
check git "committing/pushing the reviewed branch"
check gh "opening/commenting on/inspecting the PR"
check docker "building/running images for verification"
check terraform "re-checking terraform plan/apply state"
check aws "verifying real AWS state referenced by a devops PR's verify commands"
check trivy "re-running image vulnerability scans if relevant"
check jq "parsing gh/GitHub API / aws CLI output"
check python3 "validating this skill's feature-list.json"
echo ""

echo "[2/3] Checking feature-list.json is valid JSON..."
python3 -c "import json; json.load(open('feature-list.json'))" \
  && echo "  [ok] feature-list.json parses" \
  || { echo "  [FAIL] feature-list.json is not valid JSON"; missing=1; }
echo ""

echo "[3/3] Checking AWS auth isn't the account root user..."
root_creds=0
if command -v aws >/dev/null 2>&1; then
  if identity_arn=$(aws sts get-caller-identity --profile "${AWS_PROFILE:-devops-agent}" --query Arn --output text 2>/dev/null); then
    echo "  [ok] AWS credentials resolve: $identity_arn"
    if [[ "$identity_arn" =~ ^arn:aws:iam::[0-9]+:root$ ]]; then
      root_creds=1
    fi
  else
    echo "  [info] No AWS credentials configured locally for profile '${AWS_PROFILE:-devops-agent}'"
    echo "         -- fine for drafting a review, but any real verify command will fail until"
    echo "         this resolves."
  fi
fi
echo ""

if [ "$root_creds" -eq 1 ]; then
  echo "=============================================================================="
  echo "  STOP: resolved AWS credentials are the ACCOUNT ROOT USER ($identity_arn)."
  echo "  Same hard breakpoint as devops/init.sh -- fix the credentials, then re-run:"
  echo "      bash .claude/skills/review-infra/init.sh"
  echo "=============================================================================="
  exit 1
fi

if [ "$missing" -eq 1 ]; then
  echo "=== Toolchain incomplete. Install the missing tools above before starting a review. ==="
  exit 1
fi

echo "=== Toolchain ready. Read session-handoff.md next. ==="
