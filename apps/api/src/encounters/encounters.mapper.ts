import type { Encounter } from "@scribe/shared-types";
import type { EncounterRow } from "./encounters.repository";

export function toEncounterDto(row: EncounterRow): Encounter {
  return {
    id: row.id,
    providerId: row.provider_id,
    patientId: row.patient_id,
    templateId: row.template_id,
    status: row.status,
    transcript: row.transcript,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
