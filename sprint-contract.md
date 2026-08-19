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

**Feature(s):** cross-cycle transcript-autosave race (bug fix, not a `feature-list.json` item —
pre-existing Tier 0/1 defect flagged by the `pioneer.red_flags` evaluator, tracked in
`session-handoff.md` "Known gaps")
**Goal (one sentence):** Eliminate the out-of-order `PATCH /encounters/:id/input` race so RDS
(and everything downstream of it — red-flags banner, next generation's Subjective section) can
never end up holding a stale transcript after two edits fire close together under elevated
network latency.

**Tier:** N/A (bug fix on Tier 0/1 core save path) · **Branch:** `fix/autosave-race-guard`

### Context (why this is a real, confirmed bug)

`EncounterWorkspacePage.onTranscriptChange` (`apps/web/src/features/encounter/
EncounterWorkspacePage.tsx`) debounces 600ms then fires `encountersApi.updateInput(...)`. The
debounce's `clearTimeout` only cancels a *pending, not-yet-fired* timer — it does nothing once a
timer has already fired and its request is in flight. So: type → pause → timer fires → PATCH A
in flight → type more → pause again → timer fires → PATCH B in flight, while A is still
outstanding. `EncountersRepository.updateInput` (`apps/api/src/encounters/
encounters.repository.ts`) is a plain `UPDATE ... SET transcript = $2 WHERE id = $1` with no
version/sequence guard — whichever request's UPDATE statement executes on the server *last*
wins, regardless of which was sent first. Under elevated latency on A, B can land first and A
land second, leaving RDS holding A's older text after the user already typed B. `onTemplateChange`
calls the same `updateInput` endpoint (undebounced) and races the same way against a pending
`onTranscriptChange` PATCH.
Confirmed real (not hypothetical) by reading the repository/service/controller chain — there is
no optimistic-concurrency column, no request sequencing, no cancellation of in-flight requests
anywhere in this path today.

### The concrete approach (decided up front)

Per `session-handoff.md`'s guidance ("likely fix shape is a monotonic request-sequence guard, not
a debounce-interval change") plus the fact that a purely client-response-side guard can't stop an
already-in-flight older request from applying later at the server — the real fix has two parts:

1. **Serialize all `/input` PATCHes for an encounter through one client-side promise chain**
   (a `useRef<Promise<unknown>>` chain in `EncounterWorkspacePage`) so there is never more than
   one `updateInput` request in flight at a time. Requests are then applied at the server in the
   exact order they were dispatched by the client — the out-of-order-arrival race is structurally
   impossible once only one request can be in flight. Both `onTranscriptChange`'s debounced call
   and `onTemplateChange`'s immediate call go through the same chain.
2. **Monotonic sequence guard on the client for post-PATCH side effects** (the `getRedFlags`
   refetch after a transcript PATCH) — tag each queued update with an incrementing sequence
   number; only apply the side effect if no newer request has been queued since, so a slow
   response can't clobber fresher UI state even though (1) already prevents server-side data loss.

No backend change: (1) makes the existing plain `UPDATE` safe without needing a version column,
which keeps the change small and confined to the one file that owns the race.

### Explicitly OUT of scope (do not touch this sprint)

- Any backend/schema change (no version column, no sequence header) — the client-side
  serialization fix is sufficient and smaller.
- `pioneer.writing_style`'s window-stickiness question — separate, unrelated, already flagged as
  a conscious undecided product question, not a bug.
- Wiring the `/admin` shell nav to real pages — separate follow-on scope, not a bug.
- Any change to the draft-autosave path (`draftSaveTimer`/`saveDraft`) — that path already
  debounces on `note` state (not raw keystrokes hitting the network per-cycle) and was not named
  by the evaluator that found this race; touching it is out of scope.

### Done conditions (testable)

- [x] Two rapid `onTranscriptChange` edits, where the mocked `updateInput` for the first call
      resolves *after* the second call would have started, still result in `updateInput` being
      invoked strictly in call order — i.e. the second `updateInput` call is never issued until
      the first one's promise has settled. Test: `apps/web/src/features/encounter/__tests__/
      autosave-race.test.tsx` ("never sends a second /input PATCH until the first one has
      settled") — passes.
- [x] The stale (older) request's `getRedFlags` follow-up never overwrites state set by the newer
      request — same file, second test ("never lets a stale red-flags response overwrite a
      fresher one") — passes. Caught a real bug in the first implementation attempt: the seq
      guard originally gated *dispatching* `getRedFlags`, not *applying* its result, so two
      concurrent fetches could still race each other; fixed by moving the `seq ===
      inputPatchSeq.current` check to after the fetch resolves, right before `setRedFlags`.
- [x] `onTemplateChange` and `onTranscriptChange` PATCHes are serialized against each other too —
      both now go through the shared `queueInputUpdate`/`inputPatchChain` in
      `EncounterWorkspacePage.tsx`.
- [x] No existing test regresses; no new console errors/unhandled rejections — full `pnpm verify`
      green (13 web test files / 46 tests, up from 12/43) plus `pnpm --filter api run test:e2e`
      (29 suites / 99 tests) all green.
- [x] (Added after independent evaluator review) mount-time `getRedFlags` fetch is seq-gated too
      (`seq 0`) — a slow initial fetch can no longer overwrite a fresher edit-triggered result.
      Third test added: "never lets a slow mount-time red-flags fetch overwrite a fresher
      edit-triggered one" — passes.

### Invariants that must still hold (AGENTS.md §2)

- [x] [PERSISTENCE] — still an RDS `UPDATE`, no new storage introduced. Repository/service/
      controller untouched.
- [x] [TENANT-ISOLATION] — untouched; `updateInput` still scoped via `getForUser` in
      `EncountersService.updateInput`, not touched by this change (frontend-only fix).
- [x] No secret/PHI newly logged — change is pure request-sequencing, no new logging.

### Verification plan (how each condition is proven)

- `apps/web/src/features/encounter/__tests__/autosave-race.test.tsx` — new Vitest/RTL test using
  fake timers + controllable mock promises to force out-of-order resolution and assert in-order
  dispatch. Both tests pass.
- `pnpm run verify` green (lint + typecheck + test + build, both apps).
- `pnpm --filter api run test:e2e` green (confirms zero backend regression, as expected since no
  backend file changed).
- Manual/live check via a fresh evaluator: throttle or artificially delay one mocked response and
  confirm the UI's red-flags banner and transcript never regress to older content.

### Definition of done

- [x] Every _Done condition_ checked with evidence
- [x] `pnpm verify` green; api e2e green; _Leave clean_ gate run before handoff
- [x] `evaluator-rubric.md` scored by a separate subagent — **PASS**, zero required fixes. Three
      non-blocking findings: (1) mount-time `getRedFlags` not seq-gated — closed same session
      (see above), (2) multi-tab/multi-device editing still races at the server — structural,
      out of scope, logged as a known gap, (3) queued PATCH silently dropped on unmount mid-chain
      — pre-existing behavior, not introduced by this fix, logged as a known gap.
- [x] `session-handoff.md`'s "Known gaps" entry for this race removed/updated; `progress.md`
      updated with a dated entry
