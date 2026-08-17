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

**Feature(s):** `pioneer.version_diff` (Tier 2 — first pioneer feature)
**Goal (one sentence):** A provider can pick any two saved versions of a note and see a
line-level highlighted diff per SOAP section (plus ICD-10 code additions/removals), entirely from
data that already exists — no new backend endpoint, no schema change.
**Tier:** 2 · **Branch:** `feat/version-diff`

### In scope (only these)

- A pure diff utility (`apps/web/src/features/note/diff.ts`) — LCS-based line diff, no external
  dependency (consistent with the rest of the frontend, which has none beyond
  react/react-dom/react-router)
- `VersionDiff.tsx` component rendering the diff for two `NoteVersion` objects: each SOAP section
  line-by-line (added/removed/unchanged), plus a simple set-diff on `icd10Codes`
- Wiring into `EncounterWorkspacePage`/`VersionHistory`: a way to pick two versions and view the
  diff — extends the existing version list rather than a new page
- `apps/web/src/features/note/__tests__/diff.test.tsx` — the exact path `feature-list.json` names

### Explicitly OUT of scope (do not touch this sprint)

- Any backend change — `note.version_history`'s existing `GET /encounters/:id/notes` already
  returns every version's full content; this sprint reads what's already there
- Any other Tier 2 pioneer feature (writing-style learning, red-flag flagging, bulk PDF export)
- A dedicated diff-only page/route — this lives inside the existing workspace

### Done conditions (testable — from feature-list.json acceptance, expanded)

- [ ] Given two versions with a changed Plan section, the diff highlights the specific added and
      removed lines, not just "the section changed" — test: `diff.test.tsx`
- [ ] Unchanged sections/lines render as unchanged, not as spurious add+remove pairs (a real LCS
      diff, not a naive full-replace) — test: `diff.test.tsx`
- [ ] ICD-10 codes added between versions are visually distinguished from codes removed and codes
      present in both — test: `diff.test.tsx`
- [ ] A provider can select any two versions from the existing version history and see the diff
      rendered — test: `diff.test.tsx` (component-level; the selection UI itself)
- [ ] Comparing a version to itself shows no changes (sanity check on the diff algorithm) — test:
      `diff.test.tsx`

### Invariants that must still hold (AGENTS.md §2)

- [ ] VERSION-IMMUTABILITY — this feature only ever reads `note_versions`, never writes to it;
      no risk here since it's frontend-only, but worth stating since it's adjacent to the
      invariant's data

### Verification plan (how each condition is proven)

- `apps/web/src/features/note/__tests__/diff.test.tsx` — both the diff utility's correctness
  (unit-level assertions on `diffLines`) and the component's rendering (RTL)
- `pnpm run verify` green; `pnpm --filter web run test` green (existing 21 + new)
- Manual browser walkthrough: save two versions of a real note with a deliberate edit, select
  both, confirm the highlighted diff matches the actual edit

### Definition of done

- [x] Every _Done condition_ checked with evidence — independent evaluator reproduced a real
      line-level diff live in a browser (exact removed/added Plan lines, unchanged sections
      tagged), plus wrote its own adversarial test cases against the LCS algorithm (disjoint
      text, empty inputs, repeated-line patterns, single-char changes, whitespace) all producing
      correct/coherent output
- [x] `pnpm verify` green (30/30 web tests); _Leave clean_ gate passed
- [x] `evaluator-rubric.md` scored — 7/7 PASS, no CONDITIONALs, no required fixes. One documented
      edge case noted (not a bug): `diffIcd10Codes` keys purely by code, so a code appearing in
      both versions with a changed description silently shows the new description as
      "unchanged" — this matches the contract's own stated caveat that codes are canonical in
      real data, so descriptions never actually change independently of the code
- [x] `feature-list.json` → `passing`; `progress.md` + `session-handoff.md` updated
