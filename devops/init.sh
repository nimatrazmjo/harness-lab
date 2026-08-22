#!/usr/bin/env bash
# devops/init.sh -- Verify the DevOps toolchain is ready before starting a /devops session.
# Run this first, every /devops session -- mirrors the repo-root init.sh's role (fast,
# side-effect-free build-verify gate) but for this workstream's tooling instead of the app.
#
# Scope is deliberately narrow: checks that the CLIs this workstream depends on exist and that
# devops/feature-list.json is valid JSON. It does NOT run terraform apply, docker build, or
# anything that touches real state -- that only happens as part of working an actual feature.
#
# HARD BREAKPOINT: this script refuses to pass (exit 1) if resolved AWS credentials are the
# account ROOT user. Root has no permission boundary and can't be scoped -- using it for any
# devops work (even read-only `verify` checks) is a standing security risk. Fix by creating a
# scoped IAM user/role and reconfiguring credentials (`aws configure`, an SSO profile, or an
# assumed role), then re-run this script. This check cannot be skipped/overridden from here by
# design -- do not comment it out; replace the credentials instead.
set -euo pipefail

cd "$(dirname "$0")"

echo "=== DevOps workstream -- Toolchain Verification ==="
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
check docker "building/running images locally (devops.dockerfile_api, devops.dockerfile_web)"
check terraform "provisioning infra (devops.terraform_*)"
check aws "verifying real AWS state (verify commands across most Tier 0+ items)"
check trivy "image vulnerability scanning (devops.ci_image_scan_trivy)"
check gh "triggering/checking CI workflows (devops.cd_*, devops.ci_*)"
echo ""

echo "[2/3] Checking devops/feature-list.json is valid JSON..."
python3 -c "import json,sys; json.load(open('feature-list.json'))" \
  && echo "  [ok] devops/feature-list.json parses" \
  || { echo "  [FAIL] devops/feature-list.json is not valid JSON"; missing=1; }
echo ""

echo "[3/3] Checking AWS auth (if aws CLI present)..."
root_creds=0
if command -v aws >/dev/null 2>&1; then
  if identity_arn=$(aws sts get-caller-identity --profile "${AWS_PROFILE:-devops-agent}" --query Arn --output text 2>/dev/null); then
    echo "  [ok] AWS credentials resolve: $identity_arn"
    if [[ "$identity_arn" =~ ^arn:aws:iam::[0-9]+:root$ ]]; then
      root_creds=1
    fi
  else
    echo "  [info] No AWS credentials configured locally -- expected until AWS account access is"
    echo "         set up. Tier 0 items needing real AWS stay 'blocked' until this resolves."
  fi
else
  echo "  [skip] aws CLI not installed"
fi
echo ""

if [ "$root_creds" -eq 1 ]; then
  echo "=============================================================================="
  echo "  STOP: resolved AWS credentials are the ACCOUNT ROOT USER ($identity_arn)."
  echo ""
  echo "  Root has no permission boundary and cannot be scoped -- it must never be used"
  echo "  for devops work, including read-only verify checks. This is a hard breakpoint:"
  echo "  every /devops session runs this script first, and it will keep failing here"
  echo "  until root credentials are replaced."
  echo ""
  echo "  Fix: create a scoped IAM user or role (least-privilege, per devops/AGENTS.md's"
  echo "  non-negotiables) and reconfigure local credentials to use it -- 'aws configure'"
  echo "  with a new access key, an SSO profile, or an assumed role. Then re-run:"
  echo ""
  echo "      bash devops/init.sh"
  echo "=============================================================================="
  exit 1
fi

if [ "$missing" -eq 1 ]; then
  echo "=== Toolchain incomplete. Install the missing tools above before working a feature that"
  echo "    needs them -- Dockerfile items only need docker; Terraform/CI items need the rest. ==="
  exit 1
fi

echo "=== Toolchain ready. Read devops/session-handoff.md next. ==="
