# devops-request-grant — Clean State Checklist

Run the **Start clean** gate before touching anything; run the **Leave clean** gate before
handing back to `devops-agent` / ending the session. Mirrors the repo-root and `devops/`
checklists, scoped to this skill.

## Start clean

- [ ] `bash .claude/skills/devops-request-grant/init.sh` exits 0 — toolchain present, no root
      credentials in play, `feature-list.json` parses.
- [ ] Read `session-handoff.md` — know what's open before starting anything new.
- [ ] Read `feature-list.json` — confirm no entry is stuck `dispatched` from a prior session
      that never resolved (a crashed/abandoned grant-subagent). If one exists, resolve or
      explicitly re-flip it to `requested`/`denied` before adding a new entry.
- [ ] No leftover `statement.json` scratch file in this directory or `/tmp` from a prior run —
      if one exists, confirm whether it was ever applied (check the matching `feature-list.json`
      entry) before deleting it.
- [ ] No `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` env vars already set
      in the current shell — a leftover assumed-role session from a prior, unrelated task could
      silently get used instead of a fresh one.

## Leave clean

- [ ] Every `feature-list.json` entry touched this session is in a terminal state
      (`verified` or `denied`) — never leave one at `requested`/`dispatched`/`applied` across a
      session boundary without an explicit note in `session-handoff.md` explaining why it's
      still open.
- [ ] `bash .claude/skills/devops-request-grant/cleanup.sh` run — removes scratch
      `statement.json` files and any temp AWS profile blocks, confirms no assumed-role
      credentials are still exported in this shell.
- [ ] `session-handoff.md` overwritten with the current snapshot (what's open, what's next).
- [ ] `progress.md` has a new dated entry for anything that happened this session (a grant
      applied/verified/denied, a policy scope change, anything worth a future session knowing
      without re-deriving it).
- [ ] If this session's grant unblocked a `devops/feature-list.json` feature, that file was
      updated too (separately, via the normal `/devops` flow) — this skill's `feature-list.json`
      tracks the grant itself, not the feature it unblocks; don't let the two drift.
- [ ] If any entry's `status` or `blockedFeature` changed, regenerate `graph.md`'s auto-generated
      section:
      `python3 scripts/generate-feature-graph.py .claude/skills/devops-request-grant/feature-list.json --out .claude/skills/devops-request-grant/graph.md --relation blocks --external devops/feature-list.json --title "Grant requests -> unblocked devops features"`
