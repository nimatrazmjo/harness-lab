import type { Icd10CodeRef, SoapNote } from "@scribe/shared-types";
import type { WritingStyleProfile } from "./writing-style";

export type SoapSection = "subjective" | "objective" | "assessment" | "plan";

export type GenerationChunk =
  | { type: "token"; section: SoapSection; text: string }
  | { type: "icd10"; codes: Icd10CodeRef[] }
  | { type: "done"; note: SoapNote }
  | { type: "insufficient_content"; reason: string };

export interface PriorEncounterSummary {
  encounterDate: string;
  assessment: string;
  plan: string;
  icd10Codes: Icd10CodeRef[];
}

/**
 * Backend-only tool the model can invoke during generation to pull a returning
 * patient's prior history. Executed server-side against RDS — never populated
 * by the client. See AGENTS.md [CONTEXT-INJECTION].
 */
export interface PatientHistoryTool {
  name: "get_patient_history";
  description: string;
  execute(): Promise<PriorEncounterSummary[]>;
}

/** ICD-10 codes eligible for the assessment, sourced from the DB (pgvector search results). */
export interface Icd10CandidateTool {
  name: "search_icd10";
  description: string;
  execute(query: string): Promise<Icd10CodeRef[]>;
}

/** The structured form of the currently-selected template, read fresh server-side on every
 * generation call — never supplied by the client (AGENTS.md [CONTEXT-INJECTION]). Alongside
 * `templateInstructions` (the flattened string real LLM providers use as system-prompt context),
 * this gives a mock/deterministic provider something concrete to key off so
 * admin.template_select / admin.template_live_update are observably true, not just structurally
 * plausible. */
export interface AppliedTemplate {
  name: string;
  encounterType: string;
  promptInstructions: string;
}

export interface GenerateSoapNoteInput {
  transcript: string;
  templateInstructions: string;
  templateApplied?: AppliedTemplate;
  /** Learned server-side from the provider's own saved note history (pioneer.writing_style).
   * Undefined/default means "no adaptation" — output is identical to the unadapted baseline. */
  writingStyle?: WritingStyleProfile;
  patientHistoryTool: PatientHistoryTool;
  icd10CandidateTool: Icd10CandidateTool;
}

export interface ModelClient {
  generateSoapNote(input: GenerateSoapNoteInput): AsyncGenerator<GenerationChunk>;
}

export interface EmbeddingClient {
  embed(text: string): Promise<number[]>;
  readonly dimensions: number;
}
