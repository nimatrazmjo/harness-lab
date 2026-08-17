/** Base scribe instructions, prepended to every generation regardless of template. */
export const BASE_SCRIBE_INSTRUCTIONS = `
You are an AI clinical scribe assisting a licensed provider. Draft a SOAP note from the
encounter transcript. The provider will review and edit before anything is saved — you are
not making the final clinical record. Never invent findings, diagnoses, or ICD-10 codes that
are not supported by the transcript or the tools available to you.
`.trim();

export interface TemplateForPrompt {
  name: string;
  encounterType: string;
  promptInstructions: string;
}

/**
 * Combines the base instructions with the (live, server-loaded) active template.
 * Called fresh per generation so admin template edits take effect immediately —
 * see AGENTS.md admin.template_live_update.
 */
export function buildTemplateInstructions(template: TemplateForPrompt | null): string {
  if (!template) return BASE_SCRIBE_INSTRUCTIONS;
  return [
    BASE_SCRIBE_INSTRUCTIONS,
    `Encounter type: ${template.encounterType} (template: ${template.name}).`,
    template.promptInstructions,
  ].join("\n\n");
}
