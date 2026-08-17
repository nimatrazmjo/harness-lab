import { z } from "zod";

export const CreateEncounterRequestSchema = z.object({
  patientFirstName: z.string().min(1).max(100),
  patientLastName: z.string().min(1).max(100),
  patientDob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD"),
  templateId: z.string().uuid().optional(),
});
export type CreateEncounterRequest = z.infer<typeof CreateEncounterRequestSchema>;

export const EncounterStatusSchema = z.enum(["draft", "generated", "saved"]);
export type EncounterStatus = z.infer<typeof EncounterStatusSchema>;

export const EncounterSchema = z.object({
  id: z.string().uuid(),
  providerId: z.string().uuid(),
  patientId: z.string().uuid(),
  templateId: z.string().uuid().nullable(),
  status: EncounterStatusSchema,
  transcript: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Encounter = z.infer<typeof EncounterSchema>;

export const UpdateEncounterInputRequestSchema = z.object({
  transcript: z.string().max(50_000),
  templateId: z.string().uuid().optional(),
});
export type UpdateEncounterInputRequest = z.infer<typeof UpdateEncounterInputRequestSchema>;

export const PatientSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  dob: z.string(),
  createdAt: z.string().datetime(),
});
export type Patient = z.infer<typeof PatientSchema>;
