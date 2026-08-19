#!/usr/bin/env bash
# .claude/skills/devops-request-grant/init.sh -- toolchain gate for the grant-request skill.
# Run first, every invocation -- mirrors devops/init.sh's role for this narrower workstream.
#
# Scope: checks the CLIs this skill depends on exist, that its own feature-list.json is valid
# JSON, and that credentials in play are never the account root user. Does NOT assume any role
# or touch AWS state -- that only happens inside the dispatched grant-subagent (see SKILL.md).
#
# HARD BREAKPOINT: refuses to pass (exit 1) if the ambient default AWS identity, or the
# nimat-admin profile if configured, resolves to the account root user. Same rule as
# devops/init.sh, same reason: root has no permission boundary and must never touch this
# workflow. Do not remove/bypass this check -- fix the credentials instead.
set -euo pipefail

cd "$(dirname "$0")"

echo "=== devops-request-grant skill -- Toolchain Verification ==="
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

echo "[1/4] Checking required CLIs..."
check aws "assuming iam-grantor-devops-agent and applying policy versions"
check jq "parsing policy version output for verification"
check python3 "validating this skill's feature-list.json"
echo ""

echo "[2/4] Checking feature-list.json is valid JSON..."
python3 -c "import json,sys; json.load(open('feature-list.json'))" \
  && echo "  [ok] feature-list.json parses" \
  || { echo "  [FAIL] feature-list.json is not valid JSON"; missing=1; }
echo ""

echo "[3/4] Checking nimat-admin profile is configured..."
nimat_admin_configured=0
if command -v aws >/dev/null 2>&1; then
  if aws configure list --profile nimat-admin >/dev/null 2>&1; then
    echo "  [ok] nimat-admin profile exists locally"
    nimat_admin_configured=1
  else
    echo "  [info] nimat-admin profile not configured locally -- required before a grant"
    echo "         subagent can assume iam-grantor-devops-agent. Not fatal here (drafting a"
    echo "         request doesn't need it yet), but nothing can actually be applied until"
    echo "         it's set up."
  fi
fi
echo ""

echo "[4/4] Checking no in-play credentials are the AWS account root user..."
root_creds=0
check_not_root() {
  local profile="$1"
  local arn
  if arn=$(aws sts get-caller-identity --profile "$profile" --query Arn --output text 2>/dev/null); then
    echo "  [ok] profile '$profile' resolves: $arn"
    if [[ "$arn" =~ ^arn:aws:iam::[0-9]+:root$ ]]; then
      echo "  [STOP] profile '$profile' is the account ROOT user."
      root_creds=1
    fi
  else
    # Doesn't resolve (no local credentials, expired session, bad config, etc.) -- report it
    # explicitly rather than silently passing. This means the root check for THIS profile
    # literally didn't run, not that it passed -- don't let a bare "Toolchain ready" imply
    # otherwise.
    echo "  [info] profile '$profile' does not resolve locally (no credentials / expired /"
    echo "         misconfigured) -- the root check for this profile did not run"
  fi
}
if command -v aws >/dev/null 2>&1; then
  check_not_root "${AWS_PROFILE:-default}"
  if [ "$nimat_admin_configured" -eq 1 ]; then
    check_not_root "nimat-admin"
  fi
else
  echo "  [skip] aws CLI not installed"
fi
echo ""

if [ "$root_creds" -eq 1 ]; then
  echo "=============================================================================="
  echo "  STOP: a credential in play for this skill resolves to the account ROOT user."
  echo ""
  echo "  Root must never touch this workflow -- it has no permission boundary and can't"
  echo "  be scoped. This is a hard breakpoint, same rule as devops/init.sh. Fix the"
  echo "  underlying profile/credentials, then re-run:"
  echo ""
  echo "      bash .claude/skills/devops-request-grant/init.sh"
  echo "=============================================================================="
  exit 1
fi

if [ "$missing" -eq 1 ]; then
  echo "=== Toolchain incomplete. Install the missing tools above before drafting or applying"
  echo "    a grant request. ==="
  exit 1
fi

echo "=== Toolchain ready. Read session-handoff.md next. ==="
