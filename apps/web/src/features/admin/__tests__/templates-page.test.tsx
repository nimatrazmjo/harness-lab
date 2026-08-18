import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Template } from "@scribe/shared-types";
import { AdminTemplatesPage } from "../AdminTemplatesPage";
import { templatesApi } from "../../../api/templates";

vi.mock("../../../api/templates", () => ({
  templatesApi: {
    listActive: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const TEMPLATES: Template[] = [
  {
    id: "t1",
    name: "Ortho follow-up",
    encounterType: "ortho_followup",
    promptInstructions: "Focus on joint mobility.",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

describe("AdminTemplatesPage", () => {
  it("lists templates and creates a new one", async () => {
    const user = userEvent.setup();
    vi.mocked(templatesApi.listActive).mockResolvedValue(TEMPLATES);
    vi.mocked(templatesApi.create).mockResolvedValue(TEMPLATES[0]);

    render(<AdminTemplatesPage />);
    await waitFor(() => expect(screen.getByText("Ortho follow-up")).toBeInTheDocument());

    await user.type(screen.getByLabelText("Name"), "New patient eval");
    await user.type(screen.getByLabelText("Encounter type"), "new_patient");
    await user.type(screen.getByLabelText("Prompt instructions"), "Cover full history.");
    await user.click(screen.getByRole("button", { name: /create template/i }));

    await waitFor(() =>
      expect(templatesApi.create).toHaveBeenCalledWith({
        name: "New patient eval",
        encounterType: "new_patient",
        promptInstructions: "Cover full history.",
      }),
    );
  });

  it("edits an existing template", async () => {
    const user = userEvent.setup();
    vi.mocked(templatesApi.listActive).mockResolvedValue(TEMPLATES);
    vi.mocked(templatesApi.update).mockResolvedValue(TEMPLATES[0]);

    render(<AdminTemplatesPage />);
    await waitFor(() => expect(screen.getByText("Ortho follow-up")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(templatesApi.update).toHaveBeenCalledWith("t1", expect.any(Object)));
  });

  it("deletes a template", async () => {
    const user = userEvent.setup();
    vi.mocked(templatesApi.listActive).mockResolvedValue(TEMPLATES);
    vi.mocked(templatesApi.remove).mockResolvedValue({ ok: true });

    render(<AdminTemplatesPage />);
    await waitFor(() => expect(screen.getByText("Ortho follow-up")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(templatesApi.remove).toHaveBeenCalledWith("t1"));
  });
});
