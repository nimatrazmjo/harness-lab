# Sprint Contract — AI Clinical Scribe

An agreement written **before** a sprint starts and checked **after** it ends. A "sprint" = one
focused work chunk, usually a single feature (or a tight cluster) from `feature-list.json`.

Its whole job is to pin down what "done" means **up front**, so the agent can't quietly move the
goalposts or drift into adjacent work — the two most common ways an agent fakes completion.

**How to use:**

- **Sprint start:** fill in _Active sprint_ and state it back before writing any code. If you
  can't express the _Done conditions_ as testable checks, the task isn't understood yet — clarify first.
- **Sprint end:** score the work against `evaluator-rubric.md`. If it passes, fold the outcome into
  `progress.md` and overwrite this file for the next sprint.

---

## Active sprint

**Feature(s):** `audit.trail` (the last open Tier 1 item)
**Goal (one sentence):** Every note save and every admin action (provider create/deactivate,
template create/edit/delete) writes an audit row with actor, action, target, and timestamp to
RDS, queryable by an admin.
**Tier:** 1 · **Branch:** `feat/audit-trail`

### In scope (only these)

- `AuditService.log()` already exists and is already called from `NotesService.save()` (Tier 0) —
  that half of the acceptance is done, verify it's still true, don't re-build it
- Call `audit.log()` from the admin actions that don't yet: `AdminService.createProvider`,
  `AdminService.deactivateProvider`, and `TemplatesController`'s create/update/delete routes
- `AuditService.listAll()` exists but isn't exposed via any controller — add
  `GET /admin/audit-logs` (admin-only, same `@Roles('admin')` gate as the rest of
  `AdminController`), filterable the same way `admin.view_all` is (actor, action, date range)
  since "queryable" is explicit in the acceptance text
- `libs/shared-types`: `AuditLog`/`AuditLogFilter` schemas

### Explicitly OUT of scope (do not touch this sprint)

- Logging every read (GET) action — acceptance only asks for "saves and admin actions" (writes),
  not a full access log
- Any frontend admin UI for browsing the audit log (same reasoning as the admin.* sprint — no
  frontend test path is listed, and unlike draft persistence, "queryable" is satisfiable entirely
  via an API a human or a future UI can call; there's no equivalent of "the provider resumes where
  they left off" forcing frontend observability here)
- Tier 2 pioneer features

### Done conditions (testable — from feature-list.json acceptance, expanded)

- [ ] A note save writes an audit row (`actor_id`, `action='note.save'`, `target_type='encounter'`,
      `target_id`, `created_at`) — already true from Tier 0, re-verify with a fresh test in this
      sprint's file for completeness
- [ ] Creating a provider via `POST /admin/providers` writes an audit row
- [ ] Deactivating a provider via `PATCH /admin/providers/:id/deactivate` writes an audit row
- [ ] Creating, editing, and deleting a template each write an audit row
- [ ] `GET /admin/audit-logs` returns rows ordered newest-first, each with actor identity
      (id + name), action, target, and timestamp
- [ ] The audit log endpoint is filterable (at minimum by action and date range, mirroring
      `admin.view_all`'s filter shape)
- [ ] A non-admin cannot read the audit log
- [ ] Audit rows are never mutated or deleted by any code path — append-only, same spirit as
      `note_versions` (not a formal invariant, but worth holding to for a real audit trail)

### Invariants that must still hold (AGENTS.md §2)

- [ ] TENANT-ISOLATION — audit log read is admin-only via the existing `@Roles('admin')` gate
- [ ] SECRETS — audit `metadata` must never capture a password, token, or transcript/PHI content;
      only structural facts (version numbers, ids, role changes)
- [ ] PERSISTENCE — audit rows live in RDS only (already true — `audit_logs` table, no other store)

### Verification plan (how each condition is proven)

- `apps/api/test/audit.e2e-spec.ts` covering all Done conditions above
- `pnpm run verify` green; `pnpm --filter api run test:e2e` all green (existing 69 + new)

### Definition of done

- [x] Every _Done condition_ checked with evidence — independent evaluator reproduced note-save
      logging, provider create/deactivate logging, template create/update/delete logging (3 rows
      in order), the audit-log query endpoint (newest-first, actor identity), the action filter,
      and the non-admin 403 — all live against a running instance + raw psql, plus confirmed no
      password or PHI ever lands in `metadata`
- [x] `pnpm verify` green (77/77 API e2e); _Leave clean_ gate passed
- [x] `evaluator-rubric.md` scored — 6/7 PASS, 1/7 CONDITIONAL (non-blocking, closed same
      session): the sprint's own verification plan claimed date-range filtering was covered by
      `audit.e2e-spec.ts` when it wasn't — the evaluator verified it worked correctly live but
      flagged the missing regression test. Added it.
- [x] `feature-list.json` → `passing`; `progress.md` + `session-handoff.md` updated. **Tier 1 is
      now 16/16 — complete.**
