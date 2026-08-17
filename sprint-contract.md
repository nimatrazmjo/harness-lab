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

**Feature(s):** `pioneer.red_flags` (Tier 2 — second pioneer feature)
**Goal (one sentence):** Before generating a note, a provider sees a clearly advisory (never
blocking) list of clinical red-flag terms detected in the transcript, computed deterministically
server-side — no AI model call, no fabrication risk.
**Tier:** 2 · **Branch:** `feat/red-flags`

### In scope (only these)

- `libs/ai/src/red-flags.ts` — a pure, deterministic keyword/phrase detector (same style as the
  existing `safety.ts`'s `hasClinicalContent`): scans transcript text for a curated set of
  clinically meaningful red-flag terms (chest pain radiating to arm/jaw, sudden severe/"worst"
  headache, loss of consciousness, suicidal/homicidal ideation, signs of stroke, anaphylaxis,
  severe bleeding, difficulty breathing, seizure, overdose) and returns matched flags with a
  human-readable message — no LLM call, so no risk of a hallucinated flag
- Backend: `GET /encounters/:id/red-flags` — tenant-scoped like every other encounter route,
  reads the encounter's current transcript, runs the detector, returns matches
- **Frontend wiring in scope** even though only a backend test path is listed — "surfaced to the
  provider before generation" is inherently frontend-observable, same reasoning as the draft-
  persistence sprint. Flags render as a clearly-advisory banner above the Generate button; the
  button itself is never disabled or blocked by a flag being present
- `apps/api/test/red-flags.e2e-spec.ts`

### Explicitly OUT of scope (do not touch this sprint)

- Any change to the generation pipeline itself (`ScribeService`, `MockModelClient`) — red flags
  are informational only, computed independently of and before generation, never injected into
  the prompt or altering output
- Blocking or gating "Generate note" on flags being reviewed/dismissed — acceptance explicitly
  requires advisory-only
- Any other Tier 2 pioneer feature

### Done conditions (testable — from feature-list.json acceptance, expanded)

- [ ] A transcript containing a red-flag phrase (e.g. "worst headache of my life") returns that
      flag from `GET /encounters/:id/red-flags` — test: `red-flags.e2e-spec.ts`
- [ ] A transcript with no red-flag content returns an empty list, not a false positive — test:
      `red-flags.e2e-spec.ts`
- [ ] Multiple distinct red flags in one transcript are all returned, not just the first match —
      test: `red-flags.e2e-spec.ts`
- [ ] The endpoint is tenant-scoped — another provider gets 403 — test: `red-flags.e2e-spec.ts`
- [ ] Detected flags are never sent to or used by the generation pipeline — code-review check:
      `ScribeService`/`MockModelClient` remain untouched by this diff
- [ ] Flags render in the UI as advisory, and "Generate note" remains clickable regardless —
      manual browser verification, since no frontend test path is required

### Invariants that must still hold (AGENTS.md §2)

- [ ] CLINICAL-SAFETY — flags are advisory, human-in-the-loop; never auto-fabricate or auto-act
- [ ] TENANT-ISOLATION — same gate as every other encounter-scoped route
- [ ] CONTEXT-INJECTION — irrelevant here (this feature adds no new AI-model call), but worth
      stating explicitly: red-flag detection must stay a pure deterministic function, not become a
      second model call that could itself fabricate a flag

### Verification plan (how each condition is proven)

- `apps/api/test/red-flags.e2e-spec.ts`
- `libs/ai/src/__tests__/red-flags.test.ts` — unit coverage on the detector itself (true positive,
  true negative, multiple matches, case-insensitivity)
- Manual browser walkthrough: type a red-flag transcript, confirm the advisory banner appears and
  Generate note stays enabled
- `pnpm run verify` green; `pnpm --filter api run test:e2e` + `pnpm --filter @scribe/ai run test`
  all green

### Definition of done

- [x] Every _Done condition_ checked with evidence — independent evaluator reproduced flag
      detection, tenant isolation, and the "advisory not blocking" UI behavior live, then wrote
      its own adversarial pattern-matching test cases against `detectRedFlags`
- [x] `pnpm verify` green (82/82 API e2e, 27/27 `libs/ai` unit); _Leave clean_ gate passed
- [x] `evaluator-rubric.md` scored — **Overall: CONDITIONAL**, not a clean PASS. Two required
      fixes: `difficulty-breathing` didn't match its own literal phrase; `seizure`/`convulsion`
      patterns missed plural forms. **Both closed same session** (regex fixes + 5 new regression
      tests). Also fixed the two non-blocking recommendations (multiline gap matching; documented
      the deliberate no-negation-detection design choice).
- [x] `feature-list.json` → `passing`; `progress.md` + `session-handoff.md` updated. **A separate,
      pre-existing bug the evaluator found while testing this sprint (a cross-cycle autosave race
      in `EncounterWorkspacePage`'s transcript-save debounce, present since Tier 0, NOT introduced
      by this sprint) is tracked as its own follow-up in `progress.md` — it touches core Tier 0/1
      code and deserves its own contract, not a drive-by fix bundled into a Tier 2 pioneer sprint.**
