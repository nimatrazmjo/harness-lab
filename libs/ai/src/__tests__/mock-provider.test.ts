import { describe, expect, it } from "vitest";
import { MockModelClient } from "../mock-provider";
import type { GenerateSoapNoteInput, GenerationChunk } from "../types";

function makeInput(overrides: Partial<GenerateSoapNoteInput> = {}): GenerateSoapNoteInput {
  return {
    transcript:
      "Patient reports lower back pain for 3 days, worse with movement. Exam shows tenderness at L4-L5.",
    templateInstructions: "",
    patientHistoryTool: {
      name: "get_patient_history",
      description: "",
      execute: async () => [],
    },
    icd10CandidateTool: {
      name: "search_icd10",
      description: "",
      execute: async () => [{ code: "M54.5", description: "Low back pain" }],
    },
    ...overrides,
  };
}

async function collect(gen: AsyncGenerator<GenerationChunk>): Promise<GenerationChunk[]> {
  const chunks: GenerationChunk[] = [];
  for await (const c of gen) chunks.push(c);
  return chunks;
}

describe("MockModelClient", () => {
  it("streams multiple token chunks before a done chunk", async () => {
    const client = new MockModelClient();
    const chunks = await collect(client.generateSoapNote(makeInput()));
    const tokenChunks = chunks.filter((c) => c.type === "token");
    expect(tokenChunks.length).toBeGreaterThan(1);
    expect(chunks.at(-1)?.type).toBe("done");
  });

  it("includes ICD-10 codes sourced from the candidate tool, not fabricated", async () => {
    const client = new MockModelClient();
    const chunks = await collect(client.generateSoapNote(makeInput()));
    const done = chunks.find((c) => c.type === "done");
    expect(done?.type).toBe("done");
    if (done?.type === "done") {
      expect(done.note.icd10Codes).toEqual([{ code: "M54.5", description: "Low back pain" }]);
    }
  });

  it("returns insufficient_content for garbage input and yields no done chunk", async () => {
    const client = new MockModelClient();
    const chunks = await collect(client.generateSoapNote(makeInput({ transcript: "asdf" })));
    expect(chunks).toHaveLength(1);
    expect(chunks[0].type).toBe("insufficient_content");
  });

  it("calls the patient history tool during generation (context injection)", async () => {
    let called = false;
    const client = new MockModelClient();
    await collect(
      client.generateSoapNote(
        makeInput({
          patientHistoryTool: {
            name: "get_patient_history",
            description: "",
            execute: async () => {
              called = true;
              return [];
            },
          },
        }),
      ),
    );
    expect(called).toBe(true);
  });

  it("plan references prior visit when patient history is non-empty", async () => {
    const client = new MockModelClient();
    const chunks = await collect(
      client.generateSoapNote(
        makeInput({
          patientHistoryTool: {
            name: "get_patient_history",
            description: "",
            execute: async () => [
              { encounterDate: "2026-01-01", assessment: "Low back pain", plan: "NSAIDs and PT", icd10Codes: [] },
            ],
          },
        }),
      ),
    );
    const done = chunks.find((c) => c.type === "done");
    expect(done?.type).toBe("done");
    if (done?.type === "done") {
      expect(done.note.plan).toContain("2026-01-01");
      expect(done.note.plan).toContain("NSAIDs and PT");
    }
  });

  it("plan is unaffected when no template is applied", async () => {
    const client = new MockModelClient();
    const chunks = await collect(client.generateSoapNote(makeInput()));
    const done = chunks.find((c) => c.type === "done");
    if (done?.type === "done") {
      expect(done.note.plan).not.toContain("Template guidance applied");
    }
  });

  it("plan visibly incorporates the applied template's current instructions", async () => {
    const client = new MockModelClient();
    const chunks = await collect(
      client.generateSoapNote(
        makeInput({
          templateApplied: {
            name: "Ortho Follow-up",
            encounterType: "orthopedic_follow_up",
            promptInstructions: "Emphasize range-of-motion and pain trend.",
          },
        }),
      ),
    );
    const done = chunks.find((c) => c.type === "done");
    expect(done?.type).toBe("done");
    if (done?.type === "done") {
      expect(done.note.plan).toContain("Ortho Follow-up");
      expect(done.note.plan).toContain("Emphasize range-of-motion and pain trend.");
    }
  });

  it("two different templates produce two different plans for the identical transcript", async () => {
    const client = new MockModelClient();
    const orthoChunks = await collect(
      client.generateSoapNote(
        makeInput({
          templateApplied: { name: "Ortho Follow-up", encounterType: "ortho", promptInstructions: "Focus on ROM." },
        }),
      ),
    );
    const urgentChunks = await collect(
      client.generateSoapNote(
        makeInput({
          templateApplied: { name: "Urgent Care", encounterType: "urgent_care", promptInstructions: "Be concise." },
        }),
      ),
    );
    const orthoDone = orthoChunks.find((c) => c.type === "done");
    const urgentDone = urgentChunks.find((c) => c.type === "done");
    if (orthoDone?.type === "done" && urgentDone?.type === "done") {
      expect(orthoDone.note.plan).not.toBe(urgentDone.note.plan);
    }
  });
});
