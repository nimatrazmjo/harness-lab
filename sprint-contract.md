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

**Feature(s):** `session.draft_persist`, `session.cross_device`, `edge.session_expired_save`
**Goal (one sentence):** A provider's in-progress (generated but not yet saved) note survives a
refresh, a browser close/reopen, or logging in from a different device — because it's persisted
to RDS continuously, not held only in React state — and a session that expires mid-save loses no
work.
**Tier:** 1 · **Branch:** `feat/draft-persistence`

### In scope (only these)

- `drafts` table (already exists in the schema, unused until now — `encounter_id UNIQUE`,
  `provider_id`, `transcript`, `note_draft jsonb`, `updated_at`)
- Backend: `DraftsRepository` (upsert/find/delete by encounter), `PUT /encounters/:id/draft`,
  `GET /encounters/:id/draft`, tenant-scoped the same way every other encounter-scoped route is
- Clearing the draft row when a real save happens (`POST /encounters/:id/notes`) — once work is
  captured as an immutable `note_versions` row, the ephemeral draft copy is redundant and stale
- **Frontend wiring in `EncounterWorkspacePage`** (restore draft on mount, debounce-save on every
  note change) — **unlike the admin.\* sprint, this is explicitly in scope even though no
  dedicated frontend test path is listed in `feature-list.json`**. The acceptance criteria
  ("the provider resumes exactly where they left off") is fundamentally a frontend-observable
  behavior — a backend-only implementation would pass its own e2e tests while leaving the actual
  product experience unchanged, which the evaluator's own "correctness by hand" dimension would
  (rightly) catch. A live browser walkthrough proving an actual page reload restores the note is
  part of this sprint's verification plan, not optional polish.
- `edge.session_expired_save`'s "no data loss on expired-session save": since draft content is
  persisted continuously (debounced, same mechanism as above) rather than only at save time, an
  expired-session save attempt failing with 401 does not lose anything — the draft is already in
  RDS. Tested via a simulated-expired-token save attempt (real 8h JWT expiry isn't waitable in a
  test), confirming the draft survives and a re-authenticated request can complete the save with
  identical content.

### Explicitly OUT of scope (do not touch this sprint)

- Any silent token-refresh / auto-reauth UX (e.g. a refresh-token flow) — out of scope per
  AGENTS.md §7's existing JWT model; "the provider is re-authenticated" is satisfied by them
  logging in again and finding their draft intact, not by the app doing it invisibly
- `audit.trail` — separate sprint
- Changing how `encounters.transcript` autosaves (already correct/tested from Tier 0) — this
  sprint only adds note-draft persistence alongside it

### Done conditions (testable — from feature-list.json acceptance, expanded)

- [ ] Saving a draft note (`PUT /encounters/:id/draft`) persists to RDS, retrievable via
      `GET /encounters/:id/draft` — test: `draft-persist.e2e-spec.ts`
- [ ] A fresh `GET /encounters/:id/draft` on an encounter with no draft returns `{ note: null }`,
      not an error — test: `draft-persist.e2e-spec.ts`
- [ ] A real browser refresh on the workspace page restores the in-progress note exactly —
      manual verification (Chrome via MCP), not just an API-level test
- [ ] Draft is keyed to `(encounter_id, provider_id)` in RDS, not the browser — a second
      "session" (fresh login token, same provider) sees the identical draft for the same
      encounter — test: `draft-cross-device.e2e-spec.ts`
- [ ] Another provider cannot read or write a draft on an encounter they don't own (same tenant
      gate as every other encounter route) — test: `draft-persist.e2e-spec.ts` or
      `draft-cross-device.e2e-spec.ts`
- [ ] Saving the note for real (`POST /encounters/:id/notes`) clears the draft row — test:
      `draft-persist.e2e-spec.ts`
- [ ] A save attempt with an invalid/expired token fails cleanly (401) without losing the
      already-persisted draft; a fresh login retrieves the identical draft and completes the
      save — test: `edge-expired-save.e2e-spec.ts`

### Invariants that must still hold (AGENTS.md §2)

- [ ] TENANT-ISOLATION — draft read/write goes through the same `EncountersService.getForUser`
      gate as everything else encounter-scoped
- [ ] PERSISTENCE — drafts live in RDS only, never client-side-only state as the source of truth
      (React state is a cache of what's in RDS, not the record of truth)
- [ ] VERSION-IMMUTABILITY — clearing a draft on save must never touch `note_versions`; drafts and
      versions are different tables with different lifecycles

### Verification plan (how each condition is proven)

- `apps/api/test/draft-persist.e2e-spec.ts`, `draft-cross-device.e2e-spec.ts`,
  `edge-expired-save.e2e-spec.ts`
- Manual browser walkthrough (Chrome via MCP): generate a note, edit it, refresh the page, confirm
  the edited (not regenerated) note reappears
- `pnpm run verify` green; `pnpm --filter api run test:e2e` + `pnpm --filter web run test` all green

### Definition of done

- [x] Every _Done condition_ checked with evidence — independent evaluator reproduced the full
      PUT/GET round-trip, tenant isolation, cross-device identity, draft-clear-on-save, and the
      expired-session-recovery path all live against a running instance + direct DB queries
- [x] `pnpm verify` green (69/69 API e2e); _Leave clean_ gate passed
- [x] `evaluator-rubric.md` scored — 7/7 PASS, no CONDITIONALs, no required fixes
- [x] `feature-list.json` → `passing` for all three; `progress.md` + `session-handoff.md` updated
