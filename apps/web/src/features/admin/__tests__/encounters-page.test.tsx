import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Encounter, ProviderSummary } from "@scribe/shared-types";
import { AdminEncountersPage } from "../AdminEncountersPage";
import { adminApi } from "../../../api/admin";

vi.mock("../../../api/admin", () => ({
  adminApi: {
    listEncounters: vi.fn(),
    listProviders: vi.fn(),
  },
}));

const PROVIDERS: ProviderSummary[] = [
  { id: "p1", email: "dr@clinic.dev", name: "Dr. Chen", role: "provider", isActive: true, createdAt: "2026-01-01T00:00:00.000Z" },
];

const ENCOUNTERS: Encounter[] = [
  {
    id: "e1",
    providerId: "p1",
    patientId: "pat1",
    templateId: null,
    status: "saved",
    transcript: "note",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

describe("AdminEncountersPage", () => {
  it("lists all encounters with provider names resolved", async () => {
    vi.mocked(adminApi.listProviders).mockResolvedValue(PROVIDERS);
    vi.mocked(adminApi.listEncounters).mockResolvedValue(ENCOUNTERS);

    render(<AdminEncountersPage />);

    await waitFor(() => expect(screen.getAllByText("Dr. Chen").length).toBeGreaterThan(0));
    expect(screen.getByRole("row", { name: /Dr\. Chen/ })).toBeInTheDocument();
    expect(screen.getByText("saved")).toBeInTheDocument();
  });

  it("re-fetches with the provider filter when changed", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.listProviders).mockResolvedValue(PROVIDERS);
    vi.mocked(adminApi.listEncounters).mockResolvedValue([]);

    render(<AdminEncountersPage />);
    await waitFor(() => expect(adminApi.listEncounters).toHaveBeenCalledWith({}));

    await user.selectOptions(screen.getByLabelText("Provider"), "p1");

    await waitFor(() =>
      expect(adminApi.listEncounters).toHaveBeenLastCalledWith({ providerId: "p1" }),
    );
  });
});
