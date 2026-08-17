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

**Feature(s):** `patient.match`, `context.history_injection`, `context.behavior_differs`
**Goal (one sentence):** A returning patient (same first+last+DOB) is recognized and linked to
one patient record, and the AI's generation for that patient is demonstrably informed by their
prior encounter history — fetched by a backend tool call, never supplied by the client — while a
first-time patient's generation shows no such influence.
**Tier:** 1 · **Branch:** `feat/patient-context-matching`

### In scope (only these)

- Dedicated e2e test coverage proving `patient.match`, `context.history_injection`, and
  `context.behavior_differs` at the three test paths `feature-list.json` names
- Fixing anything those tests reveal is actually broken (expected: none — see rationale below)

### Explicitly OUT of scope (do not touch this sprint)

- ICD-10 search widget, admin CRUD, session/draft persistence, audit query surface — separate
  Tier 1 sprints
- Any change to the mock/Bedrock model-client behavior itself (only testing what exists)

### Rationale — why this is mostly a test-writing sprint, not a build sprint

Tier 0 already built the underlying plumbing as a side effect of doing encounter creation and
scribe generation correctly:

- `EncountersService.create()` calls `PatientsRepository.findOrCreate({firstName, lastName, dob})`
  — patient identity IS the dedup key already (`patients` table has a `UNIQUE(first_name,
  last_name, dob)` constraint). This is `patient.match`'s entire acceptance criterion.
- `ScribeService.generate()` always constructs a real `patientHistoryTool` backed by
  `EncountersRepository.listPriorForPatient()` + `NotesRepository.getLatestPerEncounter()` and
  passes it into `model.generateSoapNote()` — never populated by request body. `ScribeController
  .generate()` has **no `@Body()` parameter at all**, so there is no code path for a client to
  inject prior history even if it tried. `MockModelClient` already calls this tool and changes the
  Plan text when prior history exists vs. when it's empty (unit-tested in
  `libs/ai/src/__tests__/mock-provider.test.ts`).

What's missing is **dedicated e2e coverage proving this through the real API**, not new
implementation — exactly the kind of gap the Tier 0 evaluator pass flagged as a pattern to watch
for (features that are "accidentally correct" but unverified at the e2e level).

### Done conditions (testable — from feature-list.json acceptance, expanded)

- [ ] Starting an encounter for an existing patient (same first+last+DOB) links to the same
      `patient_id` as their prior encounter — test: `patient-match.e2e-spec.ts`
- [ ] A first-time patient (new first+last+DOB) gets a new `patient_id`, distinct from any other
      patient — test: `patient-match.e2e-spec.ts`
- [ ] Two patients with different DOBs but the same name are NOT merged (dedup key is the full
      tuple, not just name) — test: `patient-match.e2e-spec.ts`
- [ ] For a returning patient, generation output is demonstrably different because prior history
      was injected (Plan references the prior visit's date/plan) — test: `context-behavior.e2e-spec.ts`
- [ ] For a first-time patient, generation output shows no prior-visit reference — test:
      `context-behavior.e2e-spec.ts`
- [ ] The scribe generate endpoint accepts no request body capable of carrying prior-history data
      (structural proof, not just behavioral) — test: `context-injection.e2e-spec.ts`
- [ ] History injection works across providers for the same patient (clinical continuity of care —
      see invariant note below) but a provider still cannot directly read another provider's
      encounter record — test: `context-injection.e2e-spec.ts`

### Invariants that must still hold (AGENTS.md §2)

- [ ] CONTEXT-INJECTION (primary) — prior history via backend tool call only, never client-supplied
- [ ] TENANT-ISOLATION — **explicit design note, not a violation:** `patientHistoryTool` scopes by
      `patient_id`, not `provider_id`, so Provider B's generation for a shared patient CAN be
      informed by Provider A's prior assessment/plan text for that same patient. This is
      intentional (real clinical continuity of care — any provider treating a patient benefits
      from their history, same as a real EHR) and distinct from the invariant, which is about
      direct CRUD access to another provider's *encounter record* (still 403, unaffected). Called
      out explicitly here so it's defensible in a walkthrough, not discovered as a surprise.
- [ ] PERSISTENCE — patient/history reads still go through RDS only

### Verification plan (how each condition is proven)

- `apps/api/test/patient-match.e2e-spec.ts` — create two encounters with identical patient
  identity, assert same `patient_id`; create one with a different DOB, assert a different
  `patient_id`
- `apps/api/test/context-behavior.e2e-spec.ts` — for the same patient: save a note on encounter 1,
  create encounter 2 for that patient, generate, assert the Plan text contains the prior visit's
  date. For a fresh patient: generate on their first encounter, assert the Plan text does NOT
  reference a prior visit.
- `apps/api/test/context-injection.e2e-spec.ts` — assert `POST .../scribe/generate` ignores any
  JSON body sent to it (proving no client-side history injection path exists); assert Provider B
  generating for a patient Provider A previously saw gets history-informed output, while Provider
  B still gets 403 trying to `GET` Provider A's encounter directly.
- `pnpm run verify` green; `pnpm --filter api run test:e2e` all green (existing 29 + new tests)

### Definition of done

- [x] Every _Done condition_ checked with evidence — independent evaluator reproduced all 7 live
      against a running instance (not just via the new tests)
- [x] `pnpm verify` green (36/36 e2e); _Leave clean_ gate passed
- [x] `evaluator-rubric.md` scored — 5/7 PASS, 2/7 CONDITIONAL (both flagging the same issue: the
      TENANT-ISOLATION carve-out below wasn't yet human-confirmed). **Resolved**: presented the
      exact tradeoff to the user, who confirmed patient-scoped history is intended behavior. Now
      recorded as a clarified invariant in `AGENTS.md` §2 (TENANT-ISOLATION), not left as an
      agent's unilateral interpretation.
- [x] `feature-list.json` → `passing` for all three; `progress.md` + `session-handoff.md` updated
