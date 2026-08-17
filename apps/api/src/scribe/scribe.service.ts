import { Inject, Injectable } from "@nestjs/common";
import { buildTemplateInstructions, hasClinicalContent, type ModelClient, type PriorEncounterSummary } from "@scribe/ai";
import type { Icd10CodeRef, ScribeStreamEvent } from "@scribe/shared-types";
import { MODEL_CLIENT } from "../ai/ai.module";
import type { CurrentUserPayload } from "../auth/current-user.decorator";
import { EncountersRepository } from "../encounters/encounters.repository";
import { EncountersService } from "../encounters/encounters.service";
import { Icd10Service } from "../icd10/icd10.service";
import { NotesRepository } from "../notes/notes.repository";
import { TemplatesRepository } from "../templates/templates.repository";

@Injectable()
export class ScribeService {
  constructor(
    @Inject(MODEL_CLIENT) private readonly model: ModelClient,
    private readonly encountersService: EncountersService,
    private readonly encountersRepo: EncountersRepository,
    private readonly notesRepo: NotesRepository,
    private readonly templatesRepo: TemplatesRepository,
    private readonly icd10: Icd10Service,
  ) {}

  /** Tenant check only — call and await this BEFORE writing any SSE response headers,
   * so a 403/404 surfaces as a normal HTTP status instead of an in-stream error event. */
  async assertAccess(encounterId: string, user: CurrentUserPayload) {
    return this.encountersService.getForUser(encounterId, user, false);
  }

  async *generate(encounterId: string, user: CurrentUserPayload): AsyncGenerator<ScribeStreamEvent> {
    const encounter = await this.assertAccess(encounterId, user);
    const transcript = encounter.transcript ?? "";

    if (!hasClinicalContent(transcript)) {
      yield { type: "insufficient_content", reason: "Transcript does not contain clinically meaningful content." };
      return;
    }

    // Template is loaded fresh, server-side, every call — an admin edit takes
    // effect on the very next generation with no client-side cache to bust.
    const template = encounter.template_id ? await this.templatesRepo.findById(encounter.template_id) : null;
    const templateInstructions = buildTemplateInstructions(
      template
        ? { name: template.name, encounterType: template.encounter_type, promptInstructions: template.prompt_instructions }
        : null,
    );

    const patientId = encounter.patient_id;
    const patientHistoryTool = {
      name: "get_patient_history" as const,
      description: "Fetch this patient's prior encounter summaries (assessment, plan, ICD-10 codes), most recent first.",
      execute: async (): Promise<PriorEncounterSummary[]> => {
        const priorEncounters = await this.encountersRepo.listPriorForPatient(patientId, encounterId);
        if (priorEncounters.length === 0) return [];
        const latestVersions = await this.notesRepo.getLatestPerEncounter(priorEncounters.map((e) => e.id));
        const byEncounterId = new Map(latestVersions.map((v) => [v.encounter_id, v]));
        return priorEncounters
          .map((e) => byEncounterId.get(e.id))
          .filter((v): v is NonNullable<typeof v> => !!v)
          .map((v) => ({
            encounterDate: v.created_at.toISOString().slice(0, 10),
            assessment: v.assessment,
            plan: v.plan,
            icd10Codes: v.icd10_codes,
          }));
      },
    };

    const icd10CandidateTool = {
      name: "search_icd10" as const,
      description: "Search the embedded ICD-10 code set for codes semantically relevant to a clinical description.",
      execute: async (query: string): Promise<Icd10CodeRef[]> => {
        const results = await this.icd10.search(query, 5);
        return results.map((r) => ({ code: r.code, description: r.description }));
      },
    };

    for await (const chunk of this.model.generateSoapNote({
      transcript,
      templateInstructions,
      patientHistoryTool,
      icd10CandidateTool,
    })) {
      yield chunk as ScribeStreamEvent;
      if (chunk.type === "done") {
        await this.encountersRepo.updateStatus(encounterId, "generated");
      }
    }
  }
}
