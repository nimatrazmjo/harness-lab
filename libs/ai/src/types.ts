import type { Icd10CodeRef, SoapNote } from "@scribe/shared-types";

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

export interface GenerateSoapNoteInput {
  transcript: string;
  templateInstructions: string;
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
