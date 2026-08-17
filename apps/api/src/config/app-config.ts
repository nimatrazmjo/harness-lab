import type { AiConfig } from "@scribe/ai";
import { loadSecrets } from "./secrets";

export interface AppConfig {
  port: number;
  databaseUrl: string;
  dbPoolMax: number;
  dbPoolIdleTimeoutMs: number;
  jwtSecret: string;
  jwtExpiresIn: string;
  ai: AiConfig;
}

export const APP_CONFIG = Symbol("APP_CONFIG");

export async function buildAppConfig(): Promise<AppConfig> {
  const secrets = await loadSecrets();
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: secrets.databaseUrl,
    dbPoolMax: Number(process.env.DB_POOL_MAX ?? 10),
    dbPoolIdleTimeoutMs: Number(process.env.DB_POOL_IDLE_TIMEOUT_MS ?? 30_000),
    jwtSecret: secrets.jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
    ai: {
      provider: (process.env.AI_PROVIDER as "mock" | "bedrock") ?? "mock",
      region: process.env.AWS_REGION,
      generationModelId: process.env.AI_GENERATION_MODEL_ID,
      embeddingModelId: process.env.AI_EMBEDDING_MODEL_ID,
      embeddingDimensions: Number(process.env.AI_EMBEDDING_DIMENSIONS ?? 1024),
    },
  };
}
