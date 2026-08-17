import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NoteVersion } from "@scribe/shared-types";
import { diffIcd10Codes, diffLines } from "../diff";
import { VersionDiff } from "../VersionDiff";

function makeVersion(overrides: Partial<NoteVersion> = {}): NoteVersion {
  return {
    id: overrides.id ?? "v1",
    encounterId: "e1",
    versionNumber: overrides.versionNumber ?? 1,
    authorId: "p1",
    authorName: "Dr. Test",
    createdAt: "2026-01-01T10:00:00.000Z",
    note: {
      subjective: "Patient reports back pain.",
      objective: "Tenderness at L4-L5.",
      assessment: "Low back pain.",
      plan: "NSAIDs, follow up in 2 weeks.",
      icd10Codes: [{ code: "M54.5", description: "Low back pain" }],
    },
    ...overrides,
  };
}

describe("diffLines", () => {
  it("marks unchanged lines as same, not spurious add+remove pairs", () => {
    const result = diffLines("line one\nline two\nline three", "line one\nline two\nline three");
    expect(result.every((l) => l.type === "same")).toBe(true);
    expect(result).toHaveLength(3);
  });

  it("highlights specific added and removed lines for a real edit", () => {
    const result = diffLines("Plan: continue NSAIDs.", "Plan: continue NSAIDs and start PT.");
    expect(result).toContainEqual({ type: "removed", text: "Plan: continue NSAIDs." });
    expect(result).toContainEqual({ type: "added", text: "Plan: continue NSAIDs and start PT." });
  });

  it("preserves unchanged lines around a multi-line edit", () => {
    const oldText = "line A\nline B\nline C";
    const newText = "line A\nline B changed\nline C";
    const result = diffLines(oldText, newText);
    expect(result).toContainEqual({ type: "same", text: "line A" });
    expect(result).toContainEqual({ type: "removed", text: "line B" });
    expect(result).toContainEqual({ type: "added", text: "line B changed" });
    expect(result).toContainEqual({ type: "same", text: "line C" });
  });

  it("comparing identical text produces no added/removed lines", () => {
    const text = "Subjective: patient reports fatigue.";
    const result = diffLines(text, text);
    expect(result.filter((l) => l.type !== "same")).toHaveLength(0);
  });
});

describe("diffIcd10Codes", () => {
  it("separates added, removed, and unchanged codes", () => {
    const result = diffIcd10Codes(
      [
        { code: "M54.5", description: "Low back pain" },
        { code: "J02.9", description: "Acute pharyngitis" },
      ],
      [
        { code: "M54.5", description: "Low back pain" },
        { code: "R51", description: "Headache" },
      ],
    );
    expect(result.added).toEqual([{ code: "R51", description: "Headache" }]);
    expect(result.removed).toEqual([{ code: "J02.9", description: "Acute pharyngitis" }]);
    expect(result.unchanged).toEqual([{ code: "M54.5", description: "Low back pain" }]);
  });
});

describe("VersionDiff component", () => {
  it("renders a highlighted diff for a changed Plan section", () => {
    const from = makeVersion({ id: "v1", versionNumber: 1 });
    const to = makeVersion({
      id: "v2",
      versionNumber: 2,
      note: { ...from.note, plan: "NSAIDs, follow up in 2 weeks. Add physical therapy." },
    });

    render(<VersionDiff from={from} to={to} />);

    expect(screen.getByText(/comparing v1 → v2/i)).toBeInTheDocument();
    expect(screen.getByText("NSAIDs, follow up in 2 weeks.")).toBeInTheDocument();
    expect(screen.getByText("NSAIDs, follow up in 2 weeks. Add physical therapy.")).toBeInTheDocument();
  });

  it("marks unchanged sections as unchanged", () => {
    const from = makeVersion({ id: "v1", versionNumber: 1 });
    const to = makeVersion({
      id: "v2",
      versionNumber: 2,
      note: { ...from.note, plan: "A completely different plan." },
    });

    render(<VersionDiff from={from} to={to} />);

    // Subjective/Objective/Assessment are unchanged; only Plan changed.
    const unchangedTags = screen.getAllByText("(unchanged)");
    expect(unchangedTags.length).toBeGreaterThanOrEqual(3);
  });

  it("distinguishes added, removed, and unchanged ICD-10 codes", () => {
    const from = makeVersion({
      id: "v1",
      versionNumber: 1,
      note: { ...makeVersion().note, icd10Codes: [{ code: "M54.5", description: "Low back pain" }] },
    });
    const to = makeVersion({
      id: "v2",
      versionNumber: 2,
      note: {
        ...makeVersion().note,
        icd10Codes: [
          { code: "M54.5", description: "Low back pain" },
          { code: "R51", description: "Headache" },
        ],
      },
    });

    render(<VersionDiff from={from} to={to} />);

    // Code and description render as separate text nodes within one element — match on the
    // element's combined textContent, the RTL-recommended pattern for text split across nodes.
    const hasText = (target: string) => (_: string, element: Element | null) => element?.textContent === target;
    expect(screen.getByText(hasText("R51 Headache"))).toBeInTheDocument();
    expect(screen.getByText(hasText("M54.5 Low back pain"))).toBeInTheDocument();
  });

  it("shows no changes when comparing a version to itself", () => {
    const version = makeVersion({ id: "v1", versionNumber: 1 });
    render(<VersionDiff from={version} to={version} />);

    const unchangedTags = screen.getAllByText("(unchanged)");
    // All 4 SOAP sections + ICD-10 codes should all be unchanged.
    expect(unchangedTags).toHaveLength(5);
  });
});
