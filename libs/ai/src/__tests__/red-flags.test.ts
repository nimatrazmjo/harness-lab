import { describe, expect, it } from "vitest";
import { detectRedFlags } from "../red-flags";

describe("detectRedFlags", () => {
  it("returns no flags for routine clinical content", () => {
    const flags = detectRedFlags(
      "Patient reports mild sore throat for two days. Denies fever. Exam shows mild erythema, no exudate.",
    );
    expect(flags).toHaveLength(0);
  });

  it("returns no flags for an empty transcript", () => {
    expect(detectRedFlags("")).toHaveLength(0);
  });

  it("flags chest pain radiating to the arm", () => {
    const flags = detectRedFlags("Patient reports chest pain radiating to the left arm for 20 minutes.");
    expect(flags.map((f) => f.id)).toContain("chest-pain-radiating");
  });

  it("flags a thunderclap/worst headache", () => {
    const flags = detectRedFlags("Patient describes the worst headache of my life, sudden onset.");
    expect(flags.map((f) => f.id)).toContain("worst-headache");
  });

  it("flags suicidal ideation", () => {
    const flags = detectRedFlags("Patient states they have been having suicidal thoughts this week.");
    expect(flags.map((f) => f.id)).toContain("suicidal-ideation");
  });

  it("is case-insensitive", () => {
    const flags = detectRedFlags("PATIENT REPORTS A SEIZURE THIS MORNING.");
    expect(flags.map((f) => f.id)).toContain("seizure");
  });

  it("returns every distinct red flag present, not just the first", () => {
    const flags = detectRedFlags(
      "Patient reports chest pain radiating to the jaw and also had a seizure and lost consciousness.",
    );
    const ids = flags.map((f) => f.id);
    expect(ids).toContain("chest-pain-radiating");
    expect(ids).toContain("seizure");
    expect(ids).toContain("loss-of-consciousness");
    expect(flags.length).toBeGreaterThanOrEqual(3);
  });

  it("does not false-positive on unrelated mentions of similar words", () => {
    // "chest" and "pain" appear but not the radiating pattern; "breathe" without difficulty.
    const flags = detectRedFlags("Patient has mild chest wall tenderness on palpation. Breathes comfortably.");
    expect(flags.map((f) => f.id)).not.toContain("chest-pain-radiating");
    expect(flags.map((f) => f.id)).not.toContain("difficulty-breathing");
  });

  it("each flag includes a human-readable advisory message", () => {
    const flags = detectRedFlags("Patient reports an overdose of acetaminophen.");
    expect(flags[0]?.message).toMatch(/overdose/i);
  });

  // Regression coverage for gaps an independent evaluator found in the initial pattern list.
  it("flags the literal phrase 'difficulty breathing'", () => {
    const flags = detectRedFlags("Patient reports difficulty breathing since this morning.");
    expect(flags.map((f) => f.id)).toContain("difficulty-breathing");
  });

  it("flags plural 'seizures' and 'convulsions', not just the singular", () => {
    expect(detectRedFlags("Patient has had multiple seizures today.").map((f) => f.id)).toContain("seizure");
    expect(detectRedFlags("Family reports convulsions lasting two minutes.").map((f) => f.id)).toContain("seizure");
  });

  it("flags 'sudden onset severe headache' phrasing, not just 'sudden severe headache'", () => {
    const flags = detectRedFlags("Patient reports sudden onset severe headache starting an hour ago.");
    expect(flags.map((f) => f.id)).toContain("worst-headache");
  });

  it("matches a pattern whose gap spans a line break in the transcript", () => {
    const flags = detectRedFlags("Patient reports chest pain\nradiating to the left arm.");
    expect(flags.map((f) => f.id)).toContain("chest-pain-radiating");
  });

  it("deliberately does not attempt negation detection — flags on 'denies chest pain' too", () => {
    // Documented design choice, not a bug: an advisory tool should over-flag, not under-flag.
    const flags = detectRedFlags("Patient denies chest pain radiating to the arm.");
    expect(flags.map((f) => f.id)).toContain("chest-pain-radiating");
  });
});
