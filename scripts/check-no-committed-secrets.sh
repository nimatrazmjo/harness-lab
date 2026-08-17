#!/usr/bin/env bash
# infra.env_secrets acceptance check: no credential/key/token committed to the repo.
# Uses gitleaks if installed; falls back to a basic pattern scan otherwise.
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --no-git -v --redact
  exit $?
fi

echo "gitleaks not installed — running a basic fallback scan (install gitleaks for full coverage)" >&2

PATTERN='AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|(?i)aws_secret_access_key\s*=\s*[^ \n]+'
MATCHES=$(grep -RInE "$PATTERN" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build \
  --exclude='.env' . || true)

if [ -n "$MATCHES" ]; then
  echo "Potential committed secret found:" >&2
  echo "$MATCHES" >&2
  exit 1
fi

if git ls-files | grep -qx '\.env$'; then
  echo ".env is tracked by git — it must be git-ignored" >&2
  exit 1
fi

echo "No committed secrets found."
