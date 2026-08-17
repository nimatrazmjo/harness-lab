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

**Feature(s):** `pioneer.bulk_pdf` (Tier 2 — fourth and final pioneer feature)
**Goal (one sentence):** A provider (or admin) can export a patient's full encounter history —
every saved note across every visit that provider is entitled to see — as one structured,
readable PDF, respecting tenant isolation and logged to the audit trail like every other data
export in this system.

**Tier:** 2 · **Branch:** `feat/bulk-pdf`

### The concrete approach (decided up front)

- **Library:** `pdfkit` (MIT, pure JS, no native bindings, no headless-browser dependency —
  checked `npm view pdfkit version license` before adding: 0.19.x, MIT). Chosen over
  `@react-pdf/renderer` (React-coupled, this is a plain Nest backend) and over a
  Puppeteer/headless-Chrome HTML-to-PDF approach (heavy binary dependency, slow, overkill for
  structured text). A from-scratch PDF writer is not attempted — PDF is a real binary format with
  cross-reference tables; hand-rolling it would be irresponsible, unlike the diff/red-flags
  sprints where a small deterministic algorithm was reasonable to write by hand.
- **Tenant-isolation scope decision** (mirrors the existing `EncountersService.getForUser`
  `allowAdmin` pattern, not a new policy): a non-admin provider's export includes **only
  encounters where `provider_id` = their own id** for that patient — never another provider's
  encounter records, even for the same patient. This is direct list/read access to encounter
  records, the exact case AGENTS.md §2 TENANT-ISOLATION forbids ("no direct GET/PATCH/list access
  to it, ever"). It is NOT the same as the CONTEXT-INJECTION clarification (which only permits an
  indirect, backend-tool-mediated read of a patient's assessment/plan *during generation* — not a
  direct export of another provider's full note content). An admin's export includes every
  encounter for that patient, via the same explicit admin-guard pattern used everywhere else
  (`admin.encounters`, `admin.audit_logs`). If a patient exists but the requesting provider has
  zero encounters of their own with them, respond 403 (consistent with `getForUser`'s existing
  403-for-exists-but-forbidden convention, not a 404 — this codebase already accepts that
  existence-leak trade-off elsewhere, so staying consistent beats introducing a new posture here).
- **Route:** `GET /patients/:patientId/export` on a new `PatientsController` (no controller exists
  yet — `PatientsRepository` is currently internal-only, used via `findOrCreate` during encounter
  creation). Returns `Content-Type: application/pdf`, `Content-Disposition: attachment`.
- **Selection logic is a pure, unit-testable function** — `selectEncountersForExport(encounters,
  requestingUser): EncounterRow[]` in `apps/api/src/patients/` — separate from PDF rendering, so
  tenant-isolation correctness can be asserted directly with plain `expect()` calls, not by
  parsing PDF bytes.
- **Rendering:** `apps/api/src/patients/pdf-export.service.ts` builds the document with
  `new PDFDocument({ compress: false })` — compression disabled deliberately so the e2e test can
  assert identifying text appears in the raw output buffer without adding a second new dependency
  (a PDF-parsing library) just for tests. Per patient: name/DOB header, then per encounter
  (chronological): date, authoring provider name, status, and the **latest saved note version**
  (Subjective/Objective/Assessment/Plan/ICD-10 codes) via the existing
  `NotesRepository.getLatestPerEncounter`. An encounter with no saved note version yet (status
  `draft`/`generated`) is listed with an explicit "no saved note" line — never fabricated content
  (AGENTS.md [CLINICAL-SAFETY]).
- **Audit logging:** one `AuditService.log()` call per export — `action:
  "patient.bulk_pdf_export"`, `targetType: "patient"`, `targetId: patientId`, `metadata: {
  encounterCount }` — no PHI/transcript content in metadata, matching the existing rule enforced
  on every other audit call in this codebase.

### Explicitly OUT of scope (do not touch this sprint)

- Any change to note generation, versioning, or the scribe pipeline — this is a read-only export
  of already-saved data.
- A frontend "Export PDF" button/UI — acceptance names a backend test path only
  (`bulk-pdf.e2e-spec.ts`); no frontend-observable behavior is required the way the red-flags
  banner or draft-restore-on-reload were.
- Exporting draft/unsaved note content (drafts are provider-private in-progress state, not part
  of the saved record — only saved `note_versions` belong in a durable export).
- The tracked cross-cycle autosave race and the writing-style window-stickiness question from
  prior sprints — separate, pre-existing, not this sprint's scope.

### Done conditions (testable — from feature-list.json acceptance, expanded)

- [ ] A provider can export a PDF for a patient they've seen, containing every one of their own
      saved encounters for that patient — test: `bulk-pdf.e2e-spec.ts`
- [ ] The export is limited to the requesting provider's own encounters for that patient — another
      provider's encounter for the same patient never appears — test: `bulk-pdf.e2e-spec.ts` +
      `selectEncountersForExport` unit test
- [ ] An admin's export for the same patient includes encounters from every provider — test:
      `bulk-pdf.e2e-spec.ts`
- [ ] A provider with no encounters of their own for an existing patient gets 403, not a partial
      or empty PDF that silently hides other providers' data — test: `bulk-pdf.e2e-spec.ts`
- [ ] The response is a real, non-trivial PDF (`Content-Type: application/pdf`, starts with the
      `%PDF-` magic bytes, non-trivial byte length) — test: `bulk-pdf.e2e-spec.ts`
- [ ] Every export writes exactly one `audit_logs` row with no transcript/PHI content in
      `metadata` — test: `bulk-pdf.e2e-spec.ts`
- [ ] An encounter with no saved note version is listed without fabricating content — test:
      `bulk-pdf.e2e-spec.ts`

### Invariants that must still hold (AGENTS.md §2)

- [ ] TENANT-ISOLATION — direct list/read access to encounter records stays scoped to the
      requesting provider's own `provider_id`, admin bypass only via explicit role check
- [ ] CLINICAL-SAFETY — never fabricates note content for an encounter that has none
- [ ] SECRETS — audit metadata carries only structural facts (patient id, encounter count), never
      transcript/note content
- [ ] PERSISTENCE — no new durable state beyond one audit_logs row; the PDF itself is generated
      on-demand, not stored

### Verification plan (how each condition is proven)

- `apps/api/src/patients/__tests__/select-encounters-for-export.test.ts` — pure unit tests on the
  selection function: own-provider-only filtering, admin-sees-all, empty-result shape
- `apps/api/test/bulk-pdf.e2e-spec.ts` — real HTTP round trip against real Postgres: two providers
  with overlapping/non-overlapping encounters for the same patient, an admin export, the 403 case,
  a magic-bytes + content-length check, an audit-log-row assertion, a no-saved-note-yet encounter
- `pnpm run verify` green; `pnpm --filter api run test:e2e` all green
- Manual browser or curl walkthrough: request the export endpoint for a real seeded patient,
  confirm a valid, openable PDF comes back

### Definition of done

- [ ] Every _Done condition_ checked with evidence
- [ ] `pnpm verify` green; _Leave clean_ gate passed
- [ ] `evaluator-rubric.md` scored by a separate subagent
- [ ] `feature-list.json` → `passing`; `progress.md` + `session-handoff.md` updated
