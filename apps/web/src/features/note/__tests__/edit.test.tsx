import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { SoapNote } from "@scribe/shared-types";
import { NoteEditor } from "../NoteEditor";

const NOTE: SoapNote = {
  subjective: "Patient reports back pain.",
  objective: "Tenderness at L4-L5.",
  assessment: "Low back pain.",
  plan: "NSAIDs, follow up in 2 weeks.",
  icd10Codes: [{ code: "M54.5", description: "Low back pain" }],
};

describe("NoteEditor", () => {
  it("renders all four SOAP sections editable in place", () => {
    render(<NoteEditor note={NOTE} onChange={vi.fn()} />);
    expect(screen.getByLabelText("Subjective")).toHaveValue(NOTE.subjective);
    expect(screen.getByLabelText("Objective")).toHaveValue(NOTE.objective);
    expect(screen.getByLabelText("Assessment")).toHaveValue(NOTE.assessment);
    expect(screen.getByLabelText("Plan")).toHaveValue(NOTE.plan);
  });

  it("preserves edits: editing one section reports the full updated note, others untouched", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NoteEditor note={NOTE} onChange={onChange} />);

    const assessmentField = screen.getByLabelText("Assessment");
    await user.type(assessmentField, "!");

    const lastCall = onChange.mock.calls.at(-1)![0] as SoapNote;
    expect(lastCall.assessment).toBe(NOTE.assessment + "!");
    expect(lastCall.subjective).toBe(NOTE.subjective);
    expect(lastCall.objective).toBe(NOTE.objective);
    expect(lastCall.plan).toBe(NOTE.plan);
  });

  it("shows ICD-10 codes attached to the note", () => {
    render(<NoteEditor note={NOTE} onChange={vi.fn()} />);
    expect(screen.getByText("M54.5")).toBeInTheDocument();
  });

  it("disables editing when disabled", () => {
    render(<NoteEditor note={NOTE} onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText("Subjective")).toBeDisabled();
  });
});
