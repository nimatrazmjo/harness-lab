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

**Feature(s):** `admin.shell_route` (Tier 1)
**Goal (one sentence):** A dedicated `/admin` route exists in the web app, reachable only by the
admin role (frontend route gate + backend guard), rendering a distinct admin nav/layout shell that
the existing admin capabilities (view-all, roster, templates — all already backend-complete) are
the intended attachment point for.

**Tier:** 1 · **Branch:** `feature/admin-shell-route`

### Context (why this is the only real gap)

Every other Tier 0/1/2 feature in `feature-list.json` is already `passing` — confirmed by
comparing the committed history (`git log`, `session-handoff.md`, `progress.md`) against a stale
working-tree copy of `feature-list.json`/`AGENTS.md` that had reverted statuses to `failing` and
dropped the TENANT-ISOLATION clarification. Both docs have been reconciled back to the true state
in this same session, before this sprint started. `admin.shell_route` is the one item that was
newly added on top of that stale draft and is genuinely not built yet: `apps/web/src` has no
`admin` directory, no `/admin` route in `App.tsx`, and `session-handoff.md` explicitly records "No
admin frontend UI (backend-only, by design — no acceptance test requires it)" — true until now,
false as of this sprint since `admin.shell_route`'s acceptance criteria explicitly require it.

### The concrete approach (decided up front)

- **Backend:** `AdminController` already enforces `@UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("admin")` on the whole `/admin/*` surface (`apps/api/src/admin/admin.controller.ts`) —
  this already satisfies "enforced by the API guard." No backend code change needed; only a
  dedicated test file naming this behavior explicitly, since the feature names
  `apps/api/test/admin-guard.e2e-spec.ts` as its own test path (existing coverage is folded inside
  `admin-encounters.e2e-spec.ts`/`admin-roster.e2e-spec.ts`, not a standalone file).
- **Frontend:** new `apps/web/src/features/admin/AdminShell.tsx` — a nav/layout component distinct
  from the provider workspace (own header/nav, e.g. links for Encounters / Roster / Templates /
  Audit Log as a placeholder nav — the pages behind those links are NOT in scope, see below).
  A new `AdminRoute` guard component (mirrors the existing `ProtectedRoute` pattern in `App.tsx`)
  checks `user.role === "admin"`; a non-admin (including an unauthenticated user) hitting `/admin`
  is redirected (`Navigate to="/encounters"` for a logged-in non-admin, `/login` if unauthenticated)
  — never a raw crash or blank page.
  `/admin` route added to `App.tsx`, rendering `<AdminRoute><AdminShell /></AdminRoute>`.
- **No new backend routes, no new DB schema.** `AuthUser.role` (`libs/shared-types/src/auth.ts`)
  already carries the role needed for the frontend gate.

### Explicitly OUT of scope (do not touch this sprint)

- Building the actual admin view-all/roster/templates-CRUD *pages* — those features are already
  `passing` per their own (backend-only) acceptance criteria and test paths. `AdminShell` is only
  the attachment shell; wiring real pages into it is separate, unrequested scope creep.
- Any change to `AdminController`'s existing guard logic — it already works; this sprint only adds
  a dedicated test file naming it, per the feature's listed test path.
- The tracked cross-cycle autosave race and writing-style window-stickiness question from prior
  sessions — unrelated, pre-existing, not this sprint's scope.

### Done conditions (testable — from feature-list.json acceptance)

- [x] An `/admin` route exists and renders a distinct admin shell (nav/layout), separate from the
      provider workspace — test: `apps/web/src/features/admin/__tests__/shell.test.tsx`. Header
      given a visually distinct dark treatment (`.admin-shell__header`) after evaluator review, so
      admin vs. provider is recognizable at a glance, not just by the `<h1>` text.
- [x] Only the admin role can reach it — a provider hitting `/admin` is redirected/blocked,
      enforced by both the frontend route gate (test: `shell.test.tsx`) and the API guard (test:
      `apps/api/test/admin-guard.e2e-spec.ts`). Live-verified by the evaluator: unauthenticated
      `/admin/ping` → 401, provider token → 403, admin token → 200, against a real running server
      and real seeded accounts.
- [x] The shell is the single attachment point for the rest of the admin features (structural —
      verified by the shell rendering a nav that would host those pages, not by building the pages)

### Invariants that must still hold (AGENTS.md §2)

- [x] TENANT-ISOLATION / admin-guard — no new bypass of the existing role check. Evaluator
      confirmed `admin.controller.ts` was untouched this sprint (predates this branch in git log).
- [x] No secret or token newly logged or exposed — evaluator grepped new files, found none.

### Verification plan (how each condition is proven)

- `apps/web/src/features/admin/__tests__/shell.test.tsx` — renders `AdminShell` for an admin user
  (visible nav), and asserts `AdminRoute` redirects a non-admin/unauthenticated user away from
  `/admin` (React Testing Library + `MemoryRouter`, matching this app's existing test conventions)
- `apps/api/test/admin-guard.e2e-spec.ts` — a non-admin (or unauthenticated) request to
  `/admin/ping` gets 403/401; an admin request gets 200
- `pnpm run verify` green (lint + typecheck + test + build, both apps)
- Manual check: log in as a seeded provider and as the seeded admin, confirm `/admin` behaves
  correctly for both in a real browser session

### Definition of done

- [x] Every _Done condition_ checked with evidence
- [x] `pnpm verify` green (29 e2e suites / 99 tests, up from 96); _Leave clean_ gate passed
- [x] `evaluator-rubric.md` scored by a separate subagent — **PASS**, zero required fixes. Two
      non-blocking recommendations, both closed same session: (1) visually distinguish the admin
      header (dark treatment added), (2) check off this contract's boxes with evidence (this
      edit). Third note (confirm `BUILD-CHECKLIST.md` intentional) — yes, it's the new phased
      build plan this session reconciled `feature-list.json`/`AGENTS.md` against; not accidental.
- [x] `feature-list.json` → `passing`; `progress.md` + `session-handoff.md` updated
