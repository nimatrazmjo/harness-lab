# Product Spec — AI Clinical Scribe

The **what and why**. Read this before making judgment calls — it explains the intent that the
feature list only implies. (Technical shape lives in `ARCHITECTURE.md`.)

## Vision
A provider-facing tool that turns a raw encounter transcript (or freeform notes) into a
structured, professional **SOAP note** with suggested **ICD-10** codes — polished enough that a
real physician trusts it in their clinical workflow. The AI drafts; the clinician decides.

## Users & roles
- **Provider (physician / clinical staff)** — the primary user. Creates encounters, generates and
  edits notes, saves them. Sees **only their own** encounters and patients.
- **Admin** — oversight and configuration. Sees all encounters, manages the provider roster, and
  owns the note-template library. Not a clinical author.

## Core workflow (must be airtight)
1. Provider starts an encounter (patient first name, last name, DOB).
2. Provider pastes a transcript or types observations; optionally picks a template.
3. **Generate** → the SOAP note **streams back progressively** (S / O / A / P + ICD-10).
4. Provider edits inline, then saves. Every save is a new **immutable** version.

## Product principles (non-negotiable)
- **High-trust, not consumer-cute.** Clinical aesthetics: clean, dense, information-first.
- **Human-in-the-loop.** The AI never finalizes on its own; the provider reviews and edits first.
- **Never fabricate.** No hallucinated notes, no invented ICD-10 codes. If the input has no
  clinical content, refuse gracefully.
- **Context-aware.** For a returning patient, prior history informs the note (fetched server-side).
- **Nothing is lost.** Drafts survive refresh and device changes; note versions are never overwritten.

## Feature areas (product view — ids map to `feature-list.json`)
- **Encounter workspace** — create, input, generate (streaming), edit, save.
- **Patient history & context** — match returning patients, inject prior encounters.
- **ICD-10 search** — plain-English → relevant codes, click to append to the Assessment.
- **Versioning & audit** — immutable history with who/when; audit trail of actions.
- **Admin** — view all encounters, manage roster, manage templates (with live effect).
- **Session persistence** — resume an in-progress draft anywhere.

## Edge-case behavior (product decisions)
- **No clinical content:** show a clear "insufficient content" state; do not generate a note.
- **Session expired mid-save:** preserve the draft, re-authenticate, complete the save — zero data loss.
- **Provider deactivated with a draft open:** define and honor a safe behavior (e.g. draft
  preserved, session ends at the next action).

## What "feels finished" means
A build where the **core scribe loop, streaming, persistence, and infrastructure are airtight** —
even if some Tier 1/2 features are missing — beats a feature-complete build with a broken core or
sloppy infra. Optimize for the feeling of a finished, trustworthy tool.

## Out of scope (pioneer — only after Tier 0 + 1 are solid)
Version diff view, provider writing-style learning, clinical red-flag flagging, bulk patient PDF
export. One or two, done well, differentiate the build.
