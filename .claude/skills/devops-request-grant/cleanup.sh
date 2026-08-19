#!/usr/bin/env bash
# .claude/skills/devops-request-grant/cleanup.sh -- run before ending a session that used this
# skill (see clean-state-checklist.md's Leave-clean gate). Removes scratch files and warns about
# any leftover assumed-role credentials so the next session starts clean.
#
# Deliberately conservative: this script never calls any AWS mutating API. It only inspects
# local files/env and reports; anything it can't safely auto-remove, it flags for a human to
# check by hand.
set -uo pipefail

cd "$(dirname "$0")"

echo "=== devops-request-grant skill -- Cleanup ==="
echo ""

echo "[1/3] Scratch statement.json files..."
found=0
for f in ./statement.json /tmp/statement.json; do
  if [ -f "$f" ]; then
    found=1
    echo "  [found] $f"
    echo "    $(head -c 200 "$f")..."
    read -r -p "    Delete this file? [y/N] " ans
    if [[ "$ans" =~ ^[Yy]$ ]]; then
      rm -f "$f"
      echo "    [removed] $f"
    else
      echo "    [kept] $f -- remove manually once you've confirmed it's no longer needed"
    fi
  fi
done
[ "$found" -eq 0 ] && echo "  [ok] none found"
echo ""

echo "[2/3] Leftover assumed-role credentials in this shell..."
leaked=0
for var in AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN; do
  if [ -n "${!var:-}" ]; then
    echo "  [warn] $var is set in this shell -- unset it once this grant cycle is done:"
    echo "         unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN"
    leaked=1
  fi
done
[ "$leaked" -eq 0 ] && echo "  [ok] no assumed-role env vars set in this shell"
echo ""

echo "[3/3] Temp AWS CLI profile blocks (e.g. iam-grantor-temp)..."
temp_profile_found=0
if [ -f "$HOME/.aws/credentials" ] && grep -q '^\[iam-grantor-temp\]' "$HOME/.aws/credentials" 2>/dev/null; then
  temp_profile_found=1
  echo "  [found] a [iam-grantor-temp] block in ~/.aws/credentials"
  echo "  [warn] this design doesn't persist temp profiles by default -- if one exists, it's"
  echo "         leftover from a manual deviation. Remove it by hand once confirmed unneeded:"
  echo "         it holds short-lived STS credentials that expire on their own, but leaving the"
  echo "         block around invites accidentally reusing stale/expired creds."
fi
[ "$temp_profile_found" -eq 0 ] && echo "  [ok] none found"
echo ""

echo "=== Cleanup check complete. Anything flagged [warn]/[found]-not-removed above needs a"
echo "    human decision -- this script never deletes AWS-side state or unsets your shell env"
echo "    on its own. ==="
