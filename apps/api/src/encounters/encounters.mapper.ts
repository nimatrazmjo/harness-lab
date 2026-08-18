import type { Encounter } from "@scribe/shared-types";
import type { PatientRow } from "../patients/patients.repository";
import type { EncounterRow } from "./encounters.repository";

/** The `pg` driver hands `date` columns back as a JS `Date` at runtime despite PatientRow's
 * `dob: string` type — pdf-export.service.ts hit the same landmine. Normalize to YYYY-MM-DD. */
function toDobString(dob: PatientRow["dob"]): string {
  const raw: unknown = dob;
  return raw instanceof Date ? raw.toISOString().slice(0, 10) : String(raw).slice(0, 10);
}

export function toEncounterDto(row: EncounterRow, patient?: PatientRow): Encounter {
  return {
    id: row.id,
    providerId: row.provider_id,
    patientId: row.patient_id,
    templateId: row.template_id,
    status: row.status,
    transcript: row.transcript,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    ...(patient && {
      patient: { firstName: patient.first_name, lastName: patient.last_name, dob: toDobString(patient.dob) },
    }),
  };
}
