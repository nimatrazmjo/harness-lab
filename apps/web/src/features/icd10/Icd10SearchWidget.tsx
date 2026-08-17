import { useState, type FormEvent } from "react";
import type { Icd10CodeRef, Icd10SearchResult } from "@scribe/shared-types";
import { icd10Api } from "../../api/icd10";

export interface Icd10SearchWidgetProps {
  onAppend: (result: Icd10CodeRef) => void;
  appendedCodes: Icd10CodeRef[];
  /** Injectable for tests; defaults to the real pgvector-backed search endpoint. */
  search?: (query: string) => Promise<Icd10SearchResult[]>;
}

/** Standalone plain-English -> ICD-10 code search, independent of AI generation. */
export function Icd10SearchWidget({ onAppend, appendedCodes, search = icd10Api.search }: Icd10SearchWidgetProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Icd10SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const appendedCodeSet = new Set(appendedCodes.map((c) => c.code));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const found = await search(query);
      setResults(found);
      setSearched(true);
    } catch {
      setError("Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="icd10-search-widget">
      <form onSubmit={onSubmit}>
        <label htmlFor="icd10-search-query">ICD-10 search</label>
        <input
          id="icd10-search-query"
          type="text"
          placeholder="e.g. low back pain, sore throat..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {searched && results.length === 0 && !error && <p className="icd10-search-widget__empty">No matches found.</p>}
      <ul className="icd10-search-widget__results">
        {results.map((r) => {
          const alreadyAdded = appendedCodeSet.has(r.code);
          return (
            <li key={r.code} className="icd10-search-widget__result">
              <span className="icd10-search-widget__code">{r.code}</span>
              <span className="icd10-search-widget__description">{r.description}</span>
              <button
                type="button"
                disabled={alreadyAdded}
                onClick={() => onAppend({ code: r.code, description: r.description })}
              >
                {alreadyAdded ? "Added" : "Add"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
