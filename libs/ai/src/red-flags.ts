export interface RedFlag {
  /** Stable id so callers/tests can key off it — not shown to the user. */
  id: string;
  term: string;
  message: string;
}

interface RedFlagPattern {
  id: string;
  pattern: RegExp;
  message: string;
}

/**
 * Curated, deterministic patterns — no LLM call, so no risk of a hallucinated flag
 * (AGENTS.md [CLINICAL-SAFETY]). This is advisory only: it surfaces terms already
 * present in the transcript for the provider to notice, never infers a diagnosis or
 * takes any action. Case-insensitive, matched against word boundaries where sensible
 * to avoid matching inside unrelated words.
 *
 * Deliberately no negation handling (e.g. "denies chest pain" still flags on "chest
 * pain"). A false positive here costs the provider one glance and a dismiss; a false
 * negative could hide a real red flag. For an advisory-only safety net, over-flagging
 * is the correct failure mode, not under-flagging — this is a design choice, not a gap.
 */
const RED_FLAG_PATTERNS: RedFlagPattern[] = [
  {
    id: "chest-pain-radiating",
    // [\s\S] instead of . so the gap can span a line break in the transcript.
    pattern: /chest pain\b[\s\S]{0,40}\b(radiat|arm|jaw|shoulder)/i,
    message: "Chest pain radiating to arm/jaw/shoulder — possible cardiac event.",
  },
  {
    id: "worst-headache",
    pattern: /worst headache of (his|her|their|my) life|sudden[\s\S]{0,20}\bsevere headache|severe[\s\S]{0,20}\bsudden headache|thunderclap headache/i,
    message: "Sudden/severe ('thunderclap') headache — possible subarachnoid hemorrhage.",
  },
  {
    id: "loss-of-consciousness",
    pattern: /\b(loss of consciousness|lost consciousness|passed out|syncope)\b/i,
    message: "Loss of consciousness / syncope reported.",
  },
  {
    id: "suicidal-ideation",
    pattern: /\b(suicidal|suicide|kill (himself|herself|myself|themselves))\b/i,
    message: "Suicidal ideation mentioned — safety assessment indicated.",
  },
  {
    id: "homicidal-ideation",
    pattern: /\bhomicidal\b/i,
    message: "Homicidal ideation mentioned — safety assessment indicated.",
  },
  {
    id: "stroke-symptoms",
    pattern: /\b(facial droop|slurred speech|one-sided weakness|unilateral weakness|face[\s\S]{0,10}drooping)\b/i,
    message: "Possible stroke symptoms (facial droop / slurred speech / unilateral weakness).",
  },
  {
    id: "anaphylaxis",
    pattern: /\b(anaphylaxis|anaphylactic|throat (closing|swelling)|difficulty swallowing[\s\S]{0,30}(rash|hives))\b/i,
    message: "Possible anaphylaxis / severe allergic reaction.",
  },
  {
    id: "severe-bleeding",
    pattern: /\b(severe bleeding|hemorrhag(e|ing)|uncontrolled bleeding)\b/i,
    message: "Severe or uncontrolled bleeding reported.",
  },
  {
    id: "difficulty-breathing",
    pattern: /\b(can'?t breathe|cannot breathe|can'?t catch (his|her|their|my) breath|difficulty breathing|severe shortness of breath|gasping for air)\b/i,
    message: "Severe difficulty breathing reported.",
  },
  {
    id: "seizure",
    // -s? so plural forms ("seizures", "convulsions") match too.
    pattern: /\b(seizures?|convulsions?)\b/i,
    message: "Seizure activity reported.",
  },
  {
    id: "overdose",
    pattern: /\b(overdose|took too many pills|ingested[\s\S]{0,20}(too many|excessive))\b/i,
    message: "Possible overdose reported.",
  },
];

/**
 * Scans a raw transcript for clinical red-flag language. Advisory only — the caller
 * must never use this to block generation or auto-act; it only surfaces terms already
 * present in the provider's own transcript for them to notice.
 */
export function detectRedFlags(rawTranscript: string): RedFlag[] {
  const text = rawTranscript ?? "";
  const flags: RedFlag[] = [];
  for (const { id, pattern, message } of RED_FLAG_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      flags.push({ id, term: match[0], message });
    }
  }
  return flags;
}
