import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TranscriptInput } from "../TranscriptInput";

const TEMPLATES = [
  { id: "t1", name: "Ortho Follow-up", encounterType: "ortho", promptInstructions: "", isActive: true, createdAt: "", updatedAt: "" },
];

describe("TranscriptInput", () => {
  it("accepts pasted/typed transcript text and reports it via onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TranscriptInput
        value=""
        onChange={onChange}
        templates={[]}
        onTemplateChange={vi.fn()}
      />,
    );

    const textarea = screen.getByLabelText(/encounter transcript/i);
    await user.type(textarea, "Hi");

    expect(onChange).toHaveBeenCalledWith("H");
    expect(onChange).toHaveBeenCalledWith("i");
  });

  it("lists available templates and reports selection", async () => {
    const user = userEvent.setup();
    const onTemplateChange = vi.fn();
    render(
      <TranscriptInput
        value=""
        onChange={vi.fn()}
        templates={TEMPLATES}
        onTemplateChange={onTemplateChange}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/template/i), "t1");
    expect(onTemplateChange).toHaveBeenCalledWith("t1");
  });

  it("disables input while a request is in flight", () => {
    render(
      <TranscriptInput value="" onChange={vi.fn()} templates={[]} onTemplateChange={vi.fn()} disabled />,
    );
    expect(screen.getByLabelText(/encounter transcript/i)).toBeDisabled();
  });
});
