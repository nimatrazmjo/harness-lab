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

**Feature(s):** `admin.view_all`, `admin.roster`, `admin.templates_crud`, `admin.template_select`,
`admin.template_live_update`
**Goal (one sentence):** An admin can see all encounters across providers (filtered), manage the
provider roster (create/deactivate), and CRUD the template library — and a provider's template
choice demonstrably changes generation output, live, with no page refresh needed after an admin edit.
**Tier:** 1 · **Branch:** `feat/admin-dashboard`

### In scope (only these)

- `GET /admin/encounters?providerId=&from=&to=` — admin-only, filterable, backed by the existing
  (already built, untested) `EncountersRepository.listAll()`
- `POST /admin/providers` (create), `GET /admin/providers` (roster list),
  `PATCH /admin/providers/:id/deactivate` — admin-only, backed by the existing
  `ProvidersRepository.create()`/`listAll()`/`setActive()`
- `POST /templates`, `PATCH /templates/:id`, `DELETE /templates/:id` — admin-only (mixed with the
  existing public `GET /templates`), backed by the existing `TemplatesRepository`
  `create()`/`update()`/`delete()`
- **Making `admin.template_select`/`admin.template_live_update` actually true**: currently
  `MockModelClient` receives `templateInstructions` but never uses it — output is identical
  regardless of template. Adding a `templateApplied` field to `GenerateSoapNoteInput` so the mock
  can visibly incorporate the *current* template content into the Plan is in scope; it's what
  makes "output visibly differs by template" and "live update, no refresh" testable at all, not a
  detour.
- Backend + e2e tests only — **all five features' acceptance tests in `feature-list.json` are
  backend-only** (`apps/api/test/*.e2e-spec.ts`); no admin frontend page is required by any
  referenced test path.
- The `admin.roster` acceptance references an undefined `edge.provider_deactivated` (not a real
  feature id in `feature-list.json` — dangling reference from `docs/PRODUCT.md`'s edge-case list).
  Defining that behavior IS in scope since `admin.roster`'s own acceptance requires it: deactivation
  never touches a provider's data (encounters/notes/drafts untouched), and their session ends on
  their very next authenticated request (already true via `JwtStrategy.validate()` re-checking
  `is_active` per-request — needs a test, not new code).

### Explicitly OUT of scope (do not touch this sprint)

- Any admin frontend UI/dashboard page (no test path requires it)
- `session.draft_persist`/`session.cross_device`, `audit.trail`, `edge.session_expired_save` —
  separate sprints
- Improving `MockEmbeddingClient`'s search quality — unrelated, already-accepted limitation

### Done conditions (testable — from feature-list.json acceptance, expanded)

- [ ] Admin-only encounter list spans all providers; non-admin gets 403; filters by `providerId`
      and date range both work — test: `admin-encounters.e2e-spec.ts`
- [ ] Admin can create a new provider account (hashed password, can immediately log in) — test:
      `admin-roster.e2e-spec.ts`
- [ ] Admin can deactivate a provider; that provider's *next* authenticated request (not just a
      fresh login attempt) gets 401; their existing encounters/data are unchanged in RDS — test:
      `admin-roster.e2e-spec.ts`
- [ ] A non-admin cannot create/deactivate providers — test: `admin-roster.e2e-spec.ts`
- [ ] Admin can create, edit, and delete a template; a non-admin cannot; templates persist in
      RDS — test: `templates-crud.e2e-spec.ts`
- [ ] Provider picks a template on an encounter; generation output is visibly different for two
      different templates on the identical transcript — test: `template-apply.e2e-spec.ts`
- [ ] The template is applied server-side only — no template content reaches generation via a
      client-supplied field (same structural guarantee as `context.history_injection`: no
      `@Body()` capable of carrying it) — test: `template-apply.e2e-spec.ts`
- [ ] Admin edits a template's `promptInstructions`; the *same* encounter's next generation (no
      new encounter, no page refresh — same server-side "always read fresh" mechanism as before)
      reflects the edit — test: `template-live-update.e2e-spec.ts`

### Invariants that must still hold (AGENTS.md §2)

- [ ] TENANT-ISOLATION — admin bypass stays explicit-guard-only (`@Roles('admin')`); no new route
      lets a provider read/write another provider's encounter directly
- [ ] SECRETS — provider creation hashes the password with argon2 (reuse `AuthService.hashPassword`),
      never logs or returns it
- [ ] CONTEXT-INJECTION — template content still reaches generation only via the same backend
      path scribe generation already used (`ScribeService` loading the template server-side),
      not a new client-facing field

### Verification plan (how each condition is proven)

- `apps/api/test/admin-encounters.e2e-spec.ts`, `admin-roster.e2e-spec.ts`,
  `templates-crud.e2e-spec.ts`, `template-apply.e2e-spec.ts`, `template-live-update.e2e-spec.ts`
- `pnpm run verify` green; `pnpm --filter api run test:e2e` all green (existing 40 + new)

### Definition of done

- [x] Every _Done condition_ checked with evidence — independent evaluator reproduced view-all
      filtering, roster create/deactivate (incl. the same-unexpired-JWT-401 edge case), template
      CRUD (409 on dup email, 404 on missing template), template-select divergence, and
      live-update (4 sequential edits, no stale caching) all live against a running instance
- [x] `pnpm verify` green (60/60 API e2e, 13/13 `libs/ai`); _Leave clean_ gate passed
- [x] `evaluator-rubric.md` scored — 6/7 PASS, 1/7 CONDITIONAL (non-blocking): the mock's
      `templateApplied` string-concatenation is a reasonable way to make an inert mock
      observably template-aware, already documented via JSDoc as mock-only (`BedrockModelClient`
      never touches it) — evaluator flagged only a residual risk that a future reader skimming
      just `mock-provider.ts` could over-infer real generation works this way. No action required
      beyond the existing comments.
- [x] `feature-list.json` → `passing` for all five; `progress.md` + `session-handoff.md` updated
