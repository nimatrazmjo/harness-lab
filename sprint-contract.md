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

**Feature(s):** `icd10.vector_search`, `icd10.search_widget`, `icd10.append_assessment`
**Goal (one sentence):** A provider can type a symptom/condition in plain English into a
standalone widget in the encounter workspace, see ranked real ICD-10 matches from the pgvector
search, and click one to append it to the open note's codes — persisting on save.
**Tier:** 1 · **Branch:** `feat/icd10-search-widget`

### In scope (only these)

- `apps/api/test/icd10-search.e2e-spec.ts` — dedicated e2e coverage for the existing
  `GET /icd10/search` endpoint (the endpoint and its service/repository already exist from Tier 0;
  only dedicated e2e proof is missing, same pattern as the last sprint)
- `apps/web/src/api/icd10.ts` — frontend API client for the search endpoint
- `apps/web/src/features/icd10/Icd10SearchWidget.tsx` — plain-English input, ranked results
  (code + description), an "Add" action per result
- Wiring the widget into `EncounterWorkspacePage` so a click appends to the open note's
  `icd10Codes` array (dedup — clicking the same code twice doesn't duplicate it)
- Component tests at the two paths `feature-list.json` names:
  `apps/web/src/features/icd10/__tests__/widget.test.tsx` and `.../append.test.tsx`

### Explicitly OUT of scope (do not touch this sprint)

- Admin dashboard, session/draft persistence, audit query surface — separate sprints
- Any change to the embedding model, the ICD-10 dataset, or the pgvector index
- Removing/changing the icd10Codes the AI itself already attaches during generation — this widget
  only ever adds to that array, never removes from it

### Done conditions (testable — from feature-list.json acceptance, expanded)

- [ ] `GET /icd10/search?query=...` returns ranked results (code + description + similarity) for a
      plain-English query, semantically relevant, sourced only from `icd10_codes` — test:
      `icd10-search.e2e-spec.ts`
- [ ] The widget accepts plain-English input and renders results with code + description — test:
      `widget.test.tsx`
- [ ] Clicking a result appends `{code, description}` to the open note's `icd10Codes` — test:
      `append.test.tsx`
- [ ] Appending the same code twice does not create a duplicate entry — test: `append.test.tsx`
- [ ] The appended code is included in the payload `POST /encounters/:id/notes` sends, so it
      persists on save (covered by existing `note.save`/`note.versioning_immutable` machinery —
      no new backend path needed, verify by reading `NotesService.save`'s signature, not by
      re-testing persistence itself)

### Invariants that must still hold (AGENTS.md §2)

- [ ] CLINICAL-SAFETY — appended codes come only from the real pgvector search (server-side,
      DB-backed), never client-fabricated; the widget can't inject an arbitrary code string, only
      a `{code, description}` pair that came back from a real search response
- [ ] PERSISTENCE — search still hits RDS/pgvector only, no external ICD-10 API

### Verification plan (how each condition is proven)

- `apps/api/test/icd10-search.e2e-spec.ts` — real query against the seeded 234-code set, assert
  top result relevance and that no result exists outside `icd10_codes`
- `apps/web/src/features/icd10/__tests__/widget.test.tsx` — render with a mocked fetch, type a
  query, assert results render
- `apps/web/src/features/icd10/__tests__/append.test.tsx` — click a result, assert the `onAppend`
  callback / resulting note state includes the new code, and that a second click on the same
  result doesn't duplicate it
- `pnpm run verify` green; `pnpm --filter api run test:e2e` + `pnpm --filter web run test` all green

### Definition of done

- [x] Every _Done condition_ checked with evidence — independent evaluator reproduced search,
      limit-edge-cases, SQL-injection-safety, and the append/dedup flow live
- [x] `pnpm verify` green (40/40 e2e, 21/21 web); _Leave clean_ gate passed
- [x] `evaluator-rubric.md` scored — 6/7 PASS, 1/7 CONDITIONAL. The evaluator found the component
      tests only exercised `Icd10SearchWidget` via a mocked `search` prop, never the real
      `icd10Api.search` client — **closed same session**: added
      `apps/web/src/api/__tests__/icd10.test.ts` (4 tests) exercising the real fetch wiring, URL
      encoding, default limit, and error propagation. This also surfaced and fixed an unrelated
      **pre-existing test-environment bug**: Node 25's experimental native `localStorage` global
      shadows jsdom's, so ANY test touching `api/client.ts` or `state/auth-context.tsx` would have
      silently failed — nothing had exercised that path before. Fixed in
      `apps/web/src/test/setup.ts` with an in-memory `Storage` polyfill.
- [x] `feature-list.json` → `passing` for all three; `progress.md` + `session-handoff.md` updated
