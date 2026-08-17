import type { Icd10CodeRef, SoapNote } from "@scribe/shared-types";
import { hasClinicalContent } from "./safety";
import type { EmbeddingClient, GenerateSoapNoteInput, GenerationChunk, ModelClient, SoapSection } from "./types";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function* streamSection(section: SoapSection, text: string): AsyncGenerator<GenerationChunk> {
  const words = text.split(" ");
  for (const word of words) {
    yield { type: "token", section, text: word + " " };
    await sleep(1);
  }
}

function extractSubjective(transcript: string): string {
  const patientLines = transcript
    .split(/\n|(?<=[.!?])\s+/)
    .filter((l) => /\b(patient|pt|reports|states|complains|denies)\b/i.test(l))
    .map((l) => l.trim())
    .filter(Boolean);
  return patientLines.length > 0
    ? patientLines.join(" ")
    : `Patient-reported findings derived from encounter transcript: ${transcript.slice(0, 300)}`;
}

function extractObjective(transcript: string): string {
  const examLines = transcript
    .split(/\n|(?<=[.!?])\s+/)
    .filter((l) => /\b(exam|vitals|bp|hr|temp|auscultation|inspection|palpation|range of motion|rom)\b/i.test(l))
    .map((l) => l.trim())
    .filter(Boolean);
  return examLines.length > 0
    ? examLines.join(" ")
    : "No explicit exam findings dictated; objective findings limited to what is stated in the transcript.";
}

export class MockModelClient implements ModelClient {
  async *generateSoapNote(input: GenerateSoapNoteInput): AsyncGenerator<GenerationChunk> {
    if (!hasClinicalContent(input.transcript)) {
      yield {
        type: "insufficient_content",
        reason: "Transcript does not contain clinically meaningful content.",
      };
      return;
    }

    const priorHistory = await input.patientHistoryTool.execute();

    const subjective = extractSubjective(input.transcript);
    const objective = extractObjective(input.transcript);

    const icd10Codes: Icd10CodeRef[] = await input.icd10CandidateTool.execute(input.transcript);

    const assessmentBase =
      icd10Codes.length > 0
        ? `Clinical impression consistent with: ${icd10Codes.map((c) => `${c.description} (${c.code})`).join(", ")}.`
        : "Clinical impression pending further workup; no ICD-10 match found in the embedded code set for this content.";

    let plan = "Plan: continue symptomatic management, follow up as clinically indicated.";
    if (priorHistory.length > 0) {
      const mostRecent = priorHistory[0];
      plan = `Plan: continuing management per prior visit on ${mostRecent.encounterDate} (${mostRecent.plan}). Reassess response to treatment and adjust as needed.`;
    }
    // Template is read fresh server-side per call (ScribeService), never client-supplied — so
    // this literally cannot go stale, and an admin edit to promptInstructions shows up verbatim
    // on the very next generation with no cache to bust (admin.template_select/live_update).
    if (input.templateApplied) {
      plan = `[${input.templateApplied.name}] ${plan} Template guidance applied: ${input.templateApplied.promptInstructions.trim()}`;
    }

    for await (const chunk of streamSection("subjective", subjective)) yield chunk;
    for await (const chunk of streamSection("objective", objective)) yield chunk;
    for await (const chunk of streamSection("assessment", assessmentBase)) yield chunk;
    for await (const chunk of streamSection("plan", plan)) yield chunk;

    yield { type: "icd10", codes: icd10Codes };

    const note: SoapNote = {
      subjective,
      objective,
      assessment: assessmentBase,
      plan,
      icd10Codes,
    };
    yield { type: "done", note };
  }
}

/** Deterministic fake embedding — dev/test only, never used against a real embedding column claim. */
export class MockEmbeddingClient implements EmbeddingClient {
  readonly dimensions: number;

  constructor(dimensions = 1024) {
    this.dimensions = dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const vec = new Array(this.dimensions).fill(0);
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");
    const tokens = normalized.split(/\s+/).filter(Boolean);
    for (const token of tokens) {
      let hash = 0;
      for (let i = 0; i < token.length; i++) {
        hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
      }
      const idx = hash % this.dimensions;
      vec[idx] += 1;
    }
    const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vec.map((v) => v / norm);
  }
}
