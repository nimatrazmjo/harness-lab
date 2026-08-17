import { z } from "zod";

export const Icd10CodeRefSchema = z.object({
  code: z.string(),
  description: z.string(),
});
export type Icd10CodeRef = z.infer<typeof Icd10CodeRefSchema>;

export const SoapNoteSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
  icd10Codes: z.array(Icd10CodeRefSchema),
});
export type SoapNote = z.infer<typeof SoapNoteSchema>;

/** Emitted by the SSE generation stream. */
export const ScribeStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("token"), section: z.enum(["subjective", "objective", "assessment", "plan"]), text: z.string() }),
  z.object({ type: z.literal("icd10"), codes: z.array(Icd10CodeRefSchema) }),
  z.object({ type: z.literal("done"), note: SoapNoteSchema }),
  z.object({ type: z.literal("insufficient_content"), reason: z.string() }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type ScribeStreamEvent = z.infer<typeof ScribeStreamEventSchema>;

export const SaveNoteRequestSchema = z.object({
  note: SoapNoteSchema,
});
export type SaveNoteRequest = z.infer<typeof SaveNoteRequestSchema>;

export const NoteVersionSchema = z.object({
  id: z.string().uuid(),
  encounterId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  note: SoapNoteSchema,
  authorId: z.string().uuid(),
  authorName: z.string(),
  createdAt: z.string().datetime(),
});
export type NoteVersion = z.infer<typeof NoteVersionSchema>;
