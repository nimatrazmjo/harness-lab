export interface WritingStyleProfile {
  patientTerm: "pt" | "patient";
}

export interface WritingStyleSample {
  subjective: string;
  plan: string;
}

const DEFAULT_PROFILE: WritingStyleProfile = { patientTerm: "patient" };

/**
 * Pure, deterministic — no LLM call. Learns one narrow, evidence-based preference from a
 * provider's own saved note history: whether they tend to abbreviate "patient" to "pt" when
 * they edit before saving. Requires a real, repeated pattern (not one edit) before adapting,
 * so a thin or mixed history stays at the neutral default (today's unadapted output).
 *
 * Known limitation: counts the bare token "pt" without disambiguating it from other clinical
 * uses of the same abbreviation (e.g. "PT" for physical therapy or prothrombin time). A
 * provider who writes "pt" in that sense, not as "patient", could be misread as preferring
 * the abbreviation. Acceptable for a Tier 2 pioneer feature; a future iteration could narrow
 * this with surrounding-context checks if it proves noisy in practice.
 */
export function inferWritingStyle(samples: WritingStyleSample[]): WritingStyleProfile {
  let ptCount = 0;
  let patientCount = 0;

  for (const { subjective, plan } of samples) {
    const text = `${subjective} ${plan}`;
    ptCount += (text.match(/\bpt\b/gi) ?? []).length;
    patientCount += (text.match(/\bpatient\b/gi) ?? []).length;
  }

  if (ptCount >= patientCount + 2 && ptCount >= 3) {
    return { patientTerm: "pt" };
  }
  return DEFAULT_PROFILE;
}
