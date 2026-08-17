import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { NoteVersion } from "@scribe/shared-types";
import { VersionHistory } from "../VersionHistory";

const NOTE = { subjective: "s", objective: "o", assessment: "a", plan: "p", icd10Codes: [] };

const VERSIONS: NoteVersion[] = [
  {
    id: "v1",
    encounterId: "e1",
    versionNumber: 1,
    note: NOTE,
    authorId: "p1",
    authorName: "Dr. Amy Chen",
    createdAt: "2026-01-01T10:00:00.000Z",
  },
  {
    id: "v2",
    encounterId: "e1",
    versionNumber: 2,
    note: NOTE,
    authorId: "p1",
    authorName: "Dr. Amy Chen",
    createdAt: "2026-01-02T10:00:00.000Z",
  },
];

describe("VersionHistory", () => {
  it("lists every version with author and timestamp", () => {
    render(<VersionHistory versions={VERSIONS} />);
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getAllByText("Dr. Amy Chen")).toHaveLength(2);
  });

  it("calls onSelect with the chosen version", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<VersionHistory versions={VERSIONS} onSelect={onSelect} />);
    await user.click(screen.getByText("v1"));
    expect(onSelect).toHaveBeenCalledWith(VERSIONS[0]);
  });

  it("shows an empty state when there are no versions", () => {
    render(<VersionHistory versions={[]} />);
    expect(screen.getByText(/no saved versions/i)).toBeInTheDocument();
  });
});
