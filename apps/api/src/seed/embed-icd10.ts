import "reflect-metadata";
import "../config/load-dotenv";
import { Pool } from "pg";
import { createEmbeddingClient } from "@scribe/ai";
import { buildAppConfig } from "../config/app-config";
import { ICD10_SEED_DATA } from "./icd10-data";

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

async function main() {
  const config = await buildAppConfig();
  const pool = new Pool({ connectionString: config.databaseUrl });
  const embedder = createEmbeddingClient(config.ai);

  console.log(`Embedding ${ICD10_SEED_DATA.length} ICD-10 codes with provider=${config.ai.provider}...`);

  for (const entry of ICD10_SEED_DATA) {
    const embedding = await embedder.embed(`${entry.code} ${entry.description}`);
    await pool.query(
      `INSERT INTO icd10_codes (code, description, embedding) VALUES ($1, $2, $3::vector)
       ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, embedding = EXCLUDED.embedding`,
      [entry.code, entry.description, toVectorLiteral(embedding)],
    );
  }

  console.log(`Done. ${ICD10_SEED_DATA.length} codes embedded and stored in icd10_codes.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
