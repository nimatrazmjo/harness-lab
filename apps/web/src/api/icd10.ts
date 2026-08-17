import type { Icd10SearchResult } from "@scribe/shared-types";
import { api } from "./client";

export const icd10Api = {
  search: (query: string, limit = 10) =>
    api.get<Icd10SearchResult[]>(`/icd10/search?query=${encodeURIComponent(query)}&limit=${limit}`),
};
