const MIN_MEANINGFUL_LENGTH = 20;
const MIN_ALPHA_WORDS = 4;

/**
 * Cheap, deterministic check run BEFORE any model call. Catches empty input,
 * keyboard-mash, and repeated-character garbage without spending a generation
 * call on it — the model is never trusted to self-report "no content found"
 * (AGENTS.md [CLINICAL-SAFETY]: never fabricate).
 */
export function hasClinicalContent(rawTranscript: string): boolean {
  const text = rawTranscript.trim();
  if (text.length < MIN_MEANINGFUL_LENGTH) return false;

  const words = text.split(/\s+/).filter((w) => /[a-zA-Z]{2,}/.test(w));
  if (words.length < MIN_ALPHA_WORDS) return false;

  const uniqueChars = new Set(text.toLowerCase().replace(/\s/g, "")).size;
  if (uniqueChars < 5) return false; // e.g. "aaaaaaaaaaaaaaaaaaaa"

  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  if (uniqueWords.size < MIN_ALPHA_WORDS) return false; // e.g. "test test test test"

  return true;
}
