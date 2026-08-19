#!/usr/bin/env bash
# .claude/skills/review-shared/cleanup.sh -- shared leave-clean helper for all four domain
# review skills. Usage: cleanup.sh <domain> <pr-number>
#
# Deliberately conservative, same philosophy as devops-request-grant/cleanup.sh: never merges,
# never force-pushes, never deletes AWS/GitHub state. Only inspects local files/git state and
# reports; anything it can't safely auto-remove, it flags for a human.
set -uo pipefail

domain="${1:-}"
pr="${2:-}"

echo "=== review-${domain:-<domain>} -- Cleanup ==="
echo ""

echo "[1/3] Scratch diff/review files..."
found=0
for f in /tmp/pr"${pr}".diff /tmp/review-"${domain}"-*.diff; do
  if [ -f "$f" ]; then
    found=1
    echo "  [found] $f"
    if [ -t 0 ]; then
      read -r -p "    Delete this file? [y/N] " ans
      if [[ "$ans" =~ ^[Yy]$ ]]; then
        rm -f "$f"
        echo "    [removed] $f"
      else
        echo "    [kept] $f"
      fi
    else
      echo "    [warn] non-interactive session -- not deleting automatically: rm -f '$f'"
    fi
  fi
done
[ "$found" -eq 0 ] && echo "  [ok] none found"
echo ""

echo "[2/3] Confirming the PR was NOT merged by this cycle..."
if [ -n "$pr" ] && command -v gh >/dev/null 2>&1; then
  state=$(gh pr view "$pr" --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")
  if [ "$state" = "MERGED" ]; then
    echo "  [STOP] PR #$pr shows as MERGED. If this skill's own cycle merged it, that violates"
    echo "         the never-merge-own-PR rule -- flag this loudly, don't just note it in passing."
  else
    echo "  [ok] PR #$pr state: $state (not merged)"
  fi
else
  echo "  [skip] no PR number given or gh not available -- verify manually"
fi
echo ""

echo "[3/3] Leftover review worktrees..."
if command -v git >/dev/null 2>&1; then
  stray=$(git worktree list 2>/dev/null | grep -i "review-${domain}" || true)
  if [ -n "$stray" ]; then
    echo "  [found] worktree(s) referencing review-${domain}:"
    echo "$stray" | sed 's/^/    /'
    echo "  [warn] remove once confirmed done: git worktree remove <path>"
  else
    echo "  [ok] none found"
  fi
fi
echo ""

echo "=== Cleanup check complete. Anything flagged above needs a human decision -- this script"
echo "    never merges, force-pushes, or deletes shared state on its own. ==="
