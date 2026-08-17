import type { NoteVersion } from "@scribe/shared-types";
import type { NoteVersionRow } from "./notes.repository";

export function toNoteVersionDto(row: NoteVersionRow): NoteVersion {
  return {
    id: row.id,
    encounterId: row.encounter_id,
    versionNumber: row.version_number,
    note: {
      subjective: row.subjective,
      objective: row.objective,
      assessment: row.assessment,
      plan: row.plan,
      icd10Codes: row.icd10_codes,
    },
    authorId: row.author_id,
    authorName: row.author_name,
    createdAt: row.created_at.toISOString(),
  };
}
