import type { Icd10CodeRef } from "@scribe/shared-types";

export type DiffLineType = "same" | "added" | "removed";

export interface DiffLine {
  type: DiffLineType;
  text: string;
}

/**
 * Classic LCS-based line diff — no external dependency, consistent with the rest of this
 * frontend (react/react-dom/react-router only). O(n*m) DP table; fine for note-length text.
 */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const m = a.length;
  const n = b.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      result.push({ type: "same", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: "removed", text: a[i] });
      i++;
    } else {
      result.push({ type: "added", text: b[j] });
      j++;
    }
  }
  while (i < m) {
    result.push({ type: "removed", text: a[i] });
    i++;
  }
  while (j < n) {
    result.push({ type: "added", text: b[j] });
    j++;
  }
  return result;
}

export interface Icd10CodeDiff {
  added: Icd10CodeRef[];
  removed: Icd10CodeRef[];
  unchanged: Icd10CodeRef[];
}

export function diffIcd10Codes(oldCodes: Icd10CodeRef[], newCodes: Icd10CodeRef[]): Icd10CodeDiff {
  const oldCodeSet = new Set(oldCodes.map((c) => c.code));
  const newCodeSet = new Set(newCodes.map((c) => c.code));
  return {
    added: newCodes.filter((c) => !oldCodeSet.has(c.code)),
    removed: oldCodes.filter((c) => !newCodeSet.has(c.code)),
    unchanged: newCodes.filter((c) => oldCodeSet.has(c.code)),
  };
}
