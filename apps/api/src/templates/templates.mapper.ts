import type { Template } from "@scribe/shared-types";
import type { TemplateRow } from "./templates.repository";

export function toTemplateDto(row: TemplateRow): Template {
  return {
    id: row.id,
    name: row.name,
    encounterType: row.encounter_type,
    promptInstructions: row.prompt_instructions,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
