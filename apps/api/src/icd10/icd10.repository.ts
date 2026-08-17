import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

export interface Icd10SearchRow {
  code: string;
  description: string;
  similarity: number;
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

@Injectable()
export class Icd10Repository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Cosine similarity search over the embedded ICD-10 subset — no external ICD-10 API. */
  async searchBySimilarity(embedding: number[], limit: number): Promise<Icd10SearchRow[]> {
    const result = await this.pool.query<Icd10SearchRow>(
      `SELECT code, description, 1 - (embedding <=> $1::vector) AS similarity
       FROM icd10_codes
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [toVectorLiteral(embedding), limit],
    );
    return result.rows;
  }

  async upsertMany(rows: { code: string; description: string; embedding: number[] }[]): Promise<void> {
    for (const row of rows) {
      await this.pool.query(
        `INSERT INTO icd10_codes (code, description, embedding) VALUES ($1, $2, $3::vector)
         ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, embedding = EXCLUDED.embedding`,
        [row.code, row.description, toVectorLiteral(row.embedding)],
      );
    }
  }

  async count(): Promise<number> {
    const result = await this.pool.query<{ count: string }>("SELECT COUNT(*)::text FROM icd10_codes");
    return Number(result.rows[0].count);
  }
}
