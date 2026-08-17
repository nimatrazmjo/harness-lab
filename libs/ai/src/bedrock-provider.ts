import type { Icd10CodeRef, SoapNote } from "@scribe/shared-types";
import { hasClinicalContent } from "./safety";
import type { EmbeddingClient, GenerateSoapNoteInput, GenerationChunk, ModelClient } from "./types";

/**
 * AWS Bedrock provider (BAA-eligible, in-boundary with RDS — see AGENTS.md §8).
 * Uses the Converse API with tool use so the model calls back into our backend
 * tools (patient history, ICD-10 candidates) instead of receiving them pre-stuffed
 * into the prompt. Requires bedrock:InvokeModelWithResponseStream IAM permission.
 *
 * Not exercised in local dev/CI (AI_PROVIDER=mock is the default there) — this
 * needs real AWS credentials to run, which this environment does not have.
 */
export class BedrockModelClient implements ModelClient {
  constructor(
    private readonly modelId: string,
    private readonly region: string,
  ) {}

  async *generateSoapNote(input: GenerateSoapNoteInput): AsyncGenerator<GenerationChunk> {
    if (!hasClinicalContent(input.transcript)) {
      yield { type: "insufficient_content", reason: "Transcript does not contain clinically meaningful content." };
      return;
    }

    const { BedrockRuntimeClient, ConverseStreamCommand } = await import("@aws-sdk/client-bedrock-runtime");
    const client = new BedrockRuntimeClient({ region: this.region });

    // Typed `any` — the SDK's discriminated Tool union requires a `$unknown` branch that
    // doesn't apply here; this file is best-effort and unexercised without real AWS credentials.
    const toolConfig: any = {
      tools: [
        {
          toolSpec: {
            name: input.patientHistoryTool.name,
            description: input.patientHistoryTool.description,
            inputSchema: { json: { type: "object", properties: {} } },
          },
        },
        {
          toolSpec: {
            name: input.icd10CandidateTool.name,
            description: input.icd10CandidateTool.description,
            inputSchema: {
              json: {
                type: "object",
                properties: { query: { type: "string" } },
                required: ["query"],
              },
            },
          },
        },
      ],
    };

    const systemPrompt = [
      input.templateInstructions,
      "You are a clinical scribe. Produce a SOAP note (Subjective, Objective, Assessment, Plan).",
      "Call get_patient_history first to check for a returning patient, and search_icd10 to find",
      "real ICD-10 codes for the Assessment — never invent a code that search_icd10 did not return.",
      "If the transcript has no clinically meaningful content, do not fabricate a note.",
    ].join(" ");

    const messages: any[] = [{ role: "user", content: [{ text: input.transcript }] }];

    // Tool-use loop: model may call our tools before producing final text.
    for (let turn = 0; turn < 4; turn++) {
      const response = await client.send(
        new ConverseStreamCommand({
          modelId: this.modelId,
          system: [{ text: systemPrompt }],
          messages,
          toolConfig,
        }),
      );

      let toolUse: { toolUseId: string; name: string; input: any } | null = null;
      let finalText = "";
      let stopReason = "";

      for await (const event of response.stream ?? []) {
        if (event.contentBlockStart?.start?.toolUse) {
          toolUse = { toolUseId: event.contentBlockStart.start.toolUse.toolUseId!, name: event.contentBlockStart.start.toolUse.name!, input: {} };
        }
        if (event.contentBlockDelta?.delta?.text) {
          finalText += event.contentBlockDelta.delta.text;
        }
        if (event.messageStop?.stopReason) {
          stopReason = event.messageStop.stopReason;
        }
      }

      if (stopReason === "tool_use" && toolUse) {
        let result: unknown;
        if (toolUse.name === input.patientHistoryTool.name) {
          result = await input.patientHistoryTool.execute();
        } else if (toolUse.name === input.icd10CandidateTool.name) {
          result = await input.icd10CandidateTool.execute(input.transcript);
        }
        messages.push({ role: "assistant", content: [{ toolUse: { toolUseId: toolUse.toolUseId, name: toolUse.name, input: {} } }] });
        messages.push({
          role: "user",
          content: [{ toolResult: { toolUseId: toolUse.toolUseId, content: [{ json: result as Record<string, unknown> }] } }],
        });
        continue;
      }

      // Final turn: expect the model to have produced SOAP text. Parse defensively —
      // never trust the model to self-report structure without validation.
      const note = parseSoapFromText(finalText);
      if (!note) {
        yield { type: "insufficient_content", reason: "Model did not return a parseable SOAP note." };
        return;
      }
      for (const section of ["subjective", "objective", "assessment", "plan"] as const) {
        yield { type: "token", section, text: note[section] };
      }
      yield { type: "icd10", codes: note.icd10Codes };
      yield { type: "done", note };
      return;
    }

    yield { type: "insufficient_content", reason: "Model tool-use loop did not converge." };
  }
}

function parseSoapFromText(text: string): SoapNote | null {
  const get = (label: string) => {
    const match = text.match(new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n[A-Z][a-z]+:|$)`, "i"));
    return match?.[1]?.trim();
  };
  const subjective = get("Subjective");
  const objective = get("Objective");
  const assessment = get("Assessment");
  const plan = get("Plan");
  if (!subjective || !objective || !assessment || !plan) return null;

  const icd10Codes: Icd10CodeRef[] = [...assessment.matchAll(/([A-Z]\d{2}(?:\.\d+)?)\s*[-–—]\s*([^,;\n]+)/g)].map((m) => ({
    code: m[1],
    description: m[2].trim(),
  }));

  return { subjective, objective, assessment, plan, icd10Codes };
}

export class BedrockEmbeddingClient implements EmbeddingClient {
  constructor(
    private readonly modelId: string,
    private readonly region: string,
    readonly dimensions: number,
  ) {}

  async embed(text: string): Promise<number[]> {
    const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
    const client = new BedrockRuntimeClient({ region: this.region });
    const response = await client.send(
      new InvokeModelCommand({
        modelId: this.modelId,
        body: JSON.stringify({ inputText: text, dimensions: this.dimensions }),
        contentType: "application/json",
        accept: "application/json",
      }),
    );
    const body = JSON.parse(new TextDecoder().decode(response.body));
    return body.embedding;
  }
}
