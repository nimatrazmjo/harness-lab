import { z } from "zod";

export const TemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  encounterType: z.string(),
  promptInstructions: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Template = z.infer<typeof TemplateSchema>;

export const CreateTemplateRequestSchema = z.object({
  name: z.string().min(1),
  encounterType: z.string().min(1),
  promptInstructions: z.string().min(1),
});
export type CreateTemplateRequest = z.infer<typeof CreateTemplateRequestSchema>;

export const UpdateTemplateRequestSchema = CreateTemplateRequestSchema.partial();
export type UpdateTemplateRequest = z.infer<typeof UpdateTemplateRequestSchema>;
