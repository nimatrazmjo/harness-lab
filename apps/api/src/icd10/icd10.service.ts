import { Inject, Injectable } from "@nestjs/common";
import type { EmbeddingClient } from "@scribe/ai";
import type { Icd10SearchResult } from "@scribe/shared-types";
import { EMBEDDING_CLIENT } from "../ai/ai.module";
import { Icd10Repository } from "./icd10.repository";

@Injectable()
export class Icd10Service {
  constructor(
    private readonly repo: Icd10Repository,
    @Inject(EMBEDDING_CLIENT) private readonly embedder: EmbeddingClient,
  ) {}

  async search(query: string, limit: number): Promise<Icd10SearchResult[]> {
    const embedding = await this.embedder.embed(query);
    const rows = await this.repo.searchBySimilarity(embedding, limit);
    return rows.map((r) => ({ code: r.code, description: r.description, similarity: r.similarity }));
  }
}
