import { describe, expect, it } from "vitest";
import { inferWritingStyle } from "../writing-style";

describe("inferWritingStyle", () => {
  it("defaults to 'patient' for an empty sample list", () => {
    expect(inferWritingStyle([])).toEqual({ patientTerm: "patient" });
  });

  it("stays at 'patient' when 'pt' appears but doesn't clear the threshold", () => {
    const samples = [
      { subjective: "Pt reports mild pain.", plan: "Patient will follow up in 2 weeks." },
    ];
    expect(inferWritingStyle(samples)).toEqual({ patientTerm: "patient" });
  });

  it("stays at 'patient' when usage is roughly balanced", () => {
    const samples = [
      { subjective: "Pt reports pain. Pt denies fever.", plan: "Patient advised to rest. Patient to return prn." },
    ];
    // 2 "pt" vs 2 "patient" — no clear preference, margin requirement not met.
    expect(inferWritingStyle(samples)).toEqual({ patientTerm: "patient" });
  });

  it("flips to 'pt' once usage clearly and repeatedly favors the abbreviation", () => {
    const samples = [
      { subjective: "Pt reports pain.", plan: "Pt advised to rest." },
      { subjective: "Pt denies fever.", plan: "Pt to follow up prn." },
      { subjective: "Pt ambulatory.", plan: "Pt tolerating current regimen." },
    ];
    expect(inferWritingStyle(samples)).toEqual({ patientTerm: "pt" });
  });

  it("is case-insensitive when counting occurrences", () => {
    const samples = [
      { subjective: "PT reports pain.", plan: "pt advised to rest." },
      { subjective: "Pt denies fever.", plan: "Pt to follow up prn." },
      { subjective: "pt ambulatory.", plan: "PT tolerating regimen." },
    ];
    expect(inferWritingStyle(samples)).toEqual({ patientTerm: "pt" });
  });

  it("does not match 'pt' as a substring of unrelated words", () => {
    const samples = [
      { subjective: "Prompt attention given to symptoms.", plan: "Patient advised to rest." },
    ];
    expect(inferWritingStyle(samples)).toEqual({ patientTerm: "patient" });
  });
});
