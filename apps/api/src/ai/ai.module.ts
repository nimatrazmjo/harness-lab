import { Global, Module } from "@nestjs/common";
import { createEmbeddingClient, createModelClient } from "@scribe/ai";
import { APP_CONFIG, AppConfig } from "../config/app-config";

export const MODEL_CLIENT = Symbol("MODEL_CLIENT");
export const EMBEDDING_CLIENT = Symbol("EMBEDDING_CLIENT");

@Global()
@Module({
  providers: [
    {
      provide: MODEL_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createModelClient(config.ai),
    },
    {
      provide: EMBEDDING_CLIENT,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createEmbeddingClient(config.ai),
    },
  ],
  exports: [MODEL_CLIENT, EMBEDDING_CLIENT],
})
export class AiModule {}
