export * from "./types";
export * from "./safety";
export * from "./red-flags";
export * from "./writing-style";
export * from "./prompts";
export { MockModelClient, MockEmbeddingClient } from "./mock-provider";
export { BedrockModelClient, BedrockEmbeddingClient } from "./bedrock-provider";

import type { EmbeddingClient, ModelClient } from "./types";
import { MockEmbeddingClient, MockModelClient } from "./mock-provider";
import { BedrockEmbeddingClient, BedrockModelClient } from "./bedrock-provider";

export interface AiConfig {
  provider: "mock" | "bedrock";
  region?: string;
  generationModelId?: string;
  embeddingModelId?: string;
  embeddingDimensions: number;
}

export function createModelClient(config: AiConfig): ModelClient {
  if (config.provider === "bedrock") {
    if (!config.region || !config.generationModelId) {
      throw new Error("AI_PROVIDER=bedrock requires AWS_REGION and AI_GENERATION_MODEL_ID");
    }
    return new BedrockModelClient(config.generationModelId, config.region);
  }
  return new MockModelClient();
}

export function createEmbeddingClient(config: AiConfig): EmbeddingClient {
  if (config.provider === "bedrock") {
    if (!config.region || !config.embeddingModelId) {
      throw new Error("AI_PROVIDER=bedrock requires AWS_REGION and AI_EMBEDDING_MODEL_ID");
    }
    return new BedrockEmbeddingClient(config.embeddingModelId, config.region, config.embeddingDimensions);
  }
  return new MockEmbeddingClient(config.embeddingDimensions);
}
