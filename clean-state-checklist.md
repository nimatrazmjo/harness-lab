# Clean-State Checklist — AI Clinical Scribe

Two gates that keep the repo in a known-good state so **no session ever builds on a broken or
surprising baseline**. Run _Start clean_ before touching anything; run _Leave clean_ before ending.

Why it exists: agents (and humans) burn hours debugging problems they _inherited_. A ~60-second
baseline check at both ends turns "inherited breakage" into "caught immediately," and keeps every
`pnpm verify` failure attributable to the work you just did.

---

## A. Start clean — entry gate (before any new work)

**Environment & repo**

- [ ] On the intended branch and up to date: `git fetch`, `git status` shows a clean tree
- [ ] No stray uncommitted changes — or they're explained in `session-handoff.md`
- [ ] Dependencies current: `pnpm install`
- [ ] Local services healthy: `docker compose -f infra/docker-compose.yml ps` (Postgres+pgvector up)
- [ ] Migrations applied, none pending: `pnpm db:migrate`
- [ ] `.env` exists and matches `.env.example` shape (no missing keys; no real secrets)

**Known-good baseline**

- [ ] `pnpm verify` exits 0 (lint + typecheck + test + build) — the baseline is **green before you start**
- [ ] App boots and `/health` returns OK, reading through the shared pool
- [ ] Read `session-handoff.md` + `progress.md` + `feature-list.json` — you know the next action

**If the baseline is RED**

- [ ] Do **not** build on it — new work on a broken base is unattributable and compounds the damage
- [ ] Fix the baseline first, then log what broke + the fix in `progress.md`
- [ ] If it should have been caught automatically, tighten the harness (a check/hook) — the ratchet

---

## B. Leave clean — exit gate (before ending, or when context runs low)

**Code & state**

- [ ] `pnpm verify` exits 0 — never hand off a red baseline
- [ ] Work committed on a feature branch with a conventional message — or listed as in-flight in `session-handoff.md`
- [ ] No stray/debug files, no `console.log` spam, no commented-out dead code left behind
- [ ] Schema changes live in a new migration; no edits to an already-applied migration

**Invariant spot-check (AGENTS.md §2)**

- [ ] No secret/credential staged or committed — `git diff --cached` is clean of secrets; `.env` not staged
- [ ] No `note_versions` UPDATE/DELETE introduced — versioning is still append-only
- [ ] New provider-facing queries are provider-scoped — tenant isolation intact
- [ ] Nothing durable moved off RDS — no SQLite / in-memory / flat-file persistence added

**Harness bookkeeping**

- [ ] `feature-list.json` statuses reflect reality (finished feature → `passing`)
- [ ] `progress.md` has a new dated entry (what changed + the next feature)
- [ ] `session-handoff.md` overwritten with the current snapshot and the single next action
- [ ] If any feature's `status` or `dependsOn` changed, regenerate `graph.md`:
      `python3 scripts/generate-feature-graph.py feature-list.json --out graph.md --title "AI Clinical Scribe — feature dependency graph"`

---

## Fast path

```bash
git fetch && git status                          # right branch, clean tree
pnpm install                                     # deps current
docker compose -f infra/docker-compose.yml ps    # services healthy
pnpm db:migrate                                  # migrations applied
pnpm verify                                       # baseline GREEN  ← gate
# ... work ...
pnpm verify && git commit ...                     # leave GREEN, then update handoff + progress
```
