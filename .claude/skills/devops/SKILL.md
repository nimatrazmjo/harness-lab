---
name: devops
description: Work the next item in the devops/ workstream (containers, Terraform, CI/CD) — isolated from product-coding context. Use when the user says "/devops", asks to work on infra/DevOps/CI-CD, or asks about devops/feature-list.json.
---

This skill is the only entry point into the `devops/` workstream. It exists specifically so
infra/CI-CD work never bleeds into a normal product-coding session's context — nothing in this
workstream should be read or acted on except when this skill (or a direct devops/ request) is
invoked.

## What to do

1. Run `bash devops/init.sh` (toolchain + JSON gate) **first, before anything else in this
   skill.** If it exits non-zero, stop immediately and show the user its exact output — this is
   a hard breakpoint, most notably a check that resolved AWS credentials aren't the account root
   user. Do not work around it, don't proceed with a "dry run" or mocked version, and don't try
   to fix the underlying credentials yourself — that's the user's action to take. Only continue
   to step 2 once `devops/init.sh` exits 0.
   Then read `devops/session-handoff.md`, `devops/AGENTS.md`, `devops/feature-list.json`, and
   `devops/progress.md` — all small and scoped, safe to read directly here. Do **not** read
   `apps/api/src/**`, `apps/web/src/**`, or `libs/**` at this step — this workstream doesn't need
   product source, only its build entrypoints (Dockerfiles, package.json scripts) if a feature
   actually calls for them.
2. Pick the next `failing` item in `devops/feature-list.json`, lowest tier first (don't start
   Tier 1 before Tier 0 is fully `passing`). If the user named a specific item, use that instead.
3. If the item is `blocked` (needs AWS account access) and access still isn't available, say so
   plainly and stop — don't invent a mock/simulated version and call it done.
4. Dispatch the actual implementation to a **fresh subagent** via the `Agent` tool:
    - `subagent_type: "general-purpose"` (not `"fork"` — this must NOT inherit the calling
      session's product-coding context; it should start clean, scoped only to devops work).
    - `isolation: "worktree"` — so it works on its own branch/checkout and cannot touch or
      conflict with any in-progress product-code changes in the main working tree.
    - The prompt must be self-contained (the subagent starts with zero context): tell it to run
      `bash devops/init.sh` itself first and stop immediately (reporting the exact output back,
      no workaround) if that fails — the worktree is a separate checkout and shouldn't be
      assumed to inherit a passing check from this session. Also include the full text of the
      chosen feature's `description`, `acceptance`, and `verify` array from
      `devops/feature-list.json`, plus `devops/AGENTS.md`'s non-negotiables (no static AWS
      creds, never `latest` as a tag, `terraform apply` only from CI, no-touch zone on
      `apps/*/src` and `libs/**`), plus the instruction to: fill in `devops/sprint-contract.md`
      before coding, implement the thinnest slice, run every `verify` command for real, branch +
      PR (never commit to `main`), flip `status` to `passing` only if `verify` actually
      succeeded, update `devops/feature-list.json` + prepend `devops/progress.md` + overwrite
      `devops/session-handoff.md` and `devops/sprint-contract.md` in the same change, and report
      back a concise summary (what changed, verify output, what's next). If it hits
      `AccessDenied` needing a permission `devops-agent` doesn't have, follow
      `devops/AGENTS.md`'s "Requesting an AWS permission grant" procedure — draft the minimal
      statement, then STOP and report back exactly what's needed (which policy, which
      statement) rather than working around it or asking for root. Don't dispatch the
      grant-subagent yourself from inside this subagent — report up to the calling session,
      which handles the grant dispatch (see `/devops-request-grant`) before resuming your work.
5. Relay the subagent's summary back to the user. Don't re-paste its raw tool output — that
   defeats the point of isolating it.

## Explicitly out of scope for this skill

- Anything touching `apps/api/src`, `apps/web/src`, or `libs/**` — that's product-coding work,
  handled by the normal session using the repo-root `AGENTS.md`/`feature-list.json`, not this
  skill.
- Don't load `devops/feature-list.json` or `devops/AGENTS.md` into context except when this
  skill runs, or when the user explicitly asks about the devops workstream.
