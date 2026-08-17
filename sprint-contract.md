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

**Feature(s):** `pioneer.writing_style` (Tier 2 — third pioneer feature)
**Goal (one sentence):** A provider's own past edits to their saved notes teach the system a
small, concrete terminology preference, which is then demonstrably applied server-side to their
next generated note — without a real LLM, so this has to be a deterministic, evidence-based
mechanism, not a hand-wave.

**Tier:** 2 · **Branch:** `feat/writing-style`

### The concrete mechanism (decided up front, so this can't drift into hand-waving mid-sprint)

`MockModelClient` always synthesizes the same boilerplate for a given input — it has no free-form
authorial voice to imitate. What a provider actually controls is what they keep vs. edit before
saving (human-in-the-loop, `note_versions` is the record of that). So "writing-style learning"
here means: **learn whether this provider tends to abbreviate "patient" to "pt" in what they
save, and if so, apply that abbreviation to their next generated note.**

- `libs/ai/src/writing-style.ts` — pure function `inferWritingStyle(samples: { subjective:
  string; plan: string }[]): WritingStyleProfile` (`WritingStyleProfile = { patientTerm: "pt" |
  "patient" }`). Counts whole-word, case-insensitive occurrences of "pt" vs "patient" across the
  samples' subjective+plan text. Returns `"pt"` only if `ptCount >= patientCount + 2 AND ptCount
  >= 3` (a real, repeated pattern — not one edit); otherwise `"patient"` (the neutral default,
  identical to today's unadapted output). Same style as `red-flags.ts`/`safety.ts`: no LLM call,
  fully deterministic, unit-testable in isolation.
- `apps/api/src/notes/notes.repository.ts` — add `getRecentByAuthor(authorId, limit=10):
  Promise<Pick<NoteVersionRow, "subjective" | "plan">[]>`, most-recent-first, across all of that
  provider's encounters (their own saved history only — no cross-provider reads).
- `apps/api/src/scribe/scribe.service.ts` — before calling the model, fetch the current user's
  recent saved versions via the new repo method, run `inferWritingStyle`, pass the result as
  `writingStyle` on `GenerateSoapNoteInput` (same pattern as `templateApplied`).
- `libs/ai/src/mock-provider.ts` — after assembling `subjective`/`objective`/`assessment`/`plan`,
  if `writingStyle.patientTerm === "pt"`, apply `\bPatient\b` → `Pt`, `\bpatient\b` → `pt` across
  all four sections. No-op (byte-identical output) when the profile is `"patient"` — the default,
  so a provider with no/thin history sees exactly today's output, unchanged.
- `libs/ai/src/types.ts` — add `WritingStyleProfile` export, `writingStyle?: WritingStyleProfile`
  on `GenerateSoapNoteInput`.
- `apps/api/test/writing-style.e2e-spec.ts` (already named in `feature-list.json`).

### Explicitly OUT of scope (do not touch this sprint)

- Any change to `templateApplied` behavior, red-flag detection, or any other existing generation
  input — this adds one new optional input, nothing else changes shape.
- Any attempt to "learn" sentence structure, tone, or content ordering — out of reach for a
  deterministic mock model; the abbreviation-preference mechanism above is the sprint's full
  scope, not a first step toward something broader.
- Any new frontend UI to show/explain the learned style — acceptance only requires the adaptation
  be "demonstrable," which the e2e test covers; no UI surface is named in acceptance.
- Cross-provider learning of any kind — a provider's style profile is derived only from their own
  saved history (their own `author_id` rows), never another provider's.
- The tracked cross-cycle autosave race from the `pioneer.red_flags` sprint — separate, pre-
  existing, needs its own contract.

### Done conditions (testable — from feature-list.json acceptance, expanded)

- [x] A provider whose last ≥3 saved notes prefer "pt" over "patient" (by the threshold above)
      gets a newly generated note using "Pt" instead of "Patient" — test: `writing-style.e2e-spec.ts`
- [x] A provider with no saved history, or whose history doesn't clear the threshold, gets
      unchanged output (byte-identical to pre-sprint generation) — test: `writing-style.e2e-spec.ts`
- [x] The style profile is computed fresh server-side per generation call from that provider's own
      `note_versions` rows — never client-supplied, never cached stale across a session — test:
      `writing-style.e2e-spec.ts` (two generations for the same provider after their history
      changes produce different output). Added after the evaluator flagged this exact test was
      missing even though the property itself was true (proven live via curl + browser).
- [x] `inferWritingStyle` unit-tested directly: below-threshold sample counts stay `"patient"`,
      at-threshold flips to `"pt"`, empty sample list stays `"patient"` — test:
      `libs/ai/src/__tests__/writing-style.test.ts`
- [x] A provider's style is never influenced by another provider's saved notes — test:
      `writing-style.e2e-spec.ts` (tenant-isolation-shaped assertion on the profile source)

### Invariants that must still hold (AGENTS.md §2)

- [ ] CLINICAL-SAFETY — this changes terminology only, never clinical facts/content; provider
      still reviews and can edit before save (human-in-the-loop unchanged)
- [ ] TENANT-ISOLATION — a provider's learned style derives only from their own `author_id` rows
- [ ] CONTEXT-INJECTION — the style profile is fetched and computed server-side inside
      `ScribeService`, same as `patientHistoryTool`/`templateInstructions` — never client-supplied
- [ ] PERSISTENCE — no new table; reuses existing `note_versions` (already RDS-durable)

### Verification plan (how each condition is proven)

- `libs/ai/src/__tests__/writing-style.test.ts` — unit coverage on `inferWritingStyle` in isolation
- `apps/api/test/writing-style.e2e-spec.ts` — seeds real saved `note_versions` rows (via the
  existing save-note flow, not direct DB inserts, so it exercises the real path) for two
  providers with different histories, generates a new note for each, asserts the terminology
  difference in the real SSE output
- `pnpm run verify` green; `pnpm --filter api run test:e2e` + `pnpm --filter @scribe/ai run test`
  all green
- Manual browser walkthrough: save a few notes with "Pt" phrasing for a real seeded provider,
  generate a new note, confirm "Pt" appears without having to inspect the DB

### Definition of done

- [x] Every _Done condition_ checked with evidence — independent evaluator reproduced the
      mechanism live (curl + a genuinely fresh provider, confirmed again independently in a real
      browser this session), adversarially tested the regex substitution and threshold boundaries
      itself, and confirmed TENANT-ISOLATION/CONTEXT-INJECTION/CLINICAL-SAFETY all hold
- [x] `pnpm verify` green (86/86 API e2e, 33/33 `libs/ai` unit); _Leave clean_ gate passed
- [x] `evaluator-rubric.md` scored — **Overall: CONDITIONAL**, no required fixes (mechanism was
      correct even before this pass). Two non-blocking recommendations, **both closed same
      session**: added the same-provider before/after e2e test the contract's own verification
      plan promised but the suite didn't yet have, and a doc comment on `inferWritingStyle`
      disclosing that bare "pt" counting can't distinguish "patient" from other clinical uses of
      "PT" (physical therapy, prothrombin time).
- [x] `feature-list.json` → `passing`; `progress.md` + `session-handoff.md` updated. The
      window-stickiness observation (long-lived accounts can dilute a real preference shift) is
      left as a conscious, undecided product question for a future sprint, not treated as a bug.
