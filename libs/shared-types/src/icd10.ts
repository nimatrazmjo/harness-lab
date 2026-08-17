import { z } from "zod";

export const Icd10SearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  // z.coerce so this also validates GET query-string params ("10" -> 10).
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
export type Icd10SearchRequest = z.infer<typeof Icd10SearchRequestSchema>;

export const Icd10SearchResultSchema = z.object({
  code: z.string(),
  description: z.string(),
  similarity: z.number(),
});
export type Icd10SearchResult = z.infer<typeof Icd10SearchResultSchema>;
