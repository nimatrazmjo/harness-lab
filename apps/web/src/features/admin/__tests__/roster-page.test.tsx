import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProviderSummary } from "@scribe/shared-types";
import { AdminRosterPage } from "../AdminRosterPage";
import { adminApi } from "../../../api/admin";

vi.mock("../../../api/admin", () => ({
  adminApi: {
    listProviders: vi.fn(),
    createProvider: vi.fn(),
    deactivateProvider: vi.fn(),
  },
}));

const PROVIDERS: ProviderSummary[] = [
  { id: "p1", email: "dr@clinic.dev", name: "Dr. Chen", role: "provider", isActive: true, createdAt: "2026-01-01T00:00:00.000Z" },
];

describe("AdminRosterPage", () => {
  it("lists providers and can deactivate one", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.listProviders).mockResolvedValue(PROVIDERS);
    vi.mocked(adminApi.deactivateProvider).mockResolvedValue({ ok: true });

    render(<AdminRosterPage />);

    await waitFor(() => expect(screen.getByText("Dr. Chen")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /deactivate/i }));

    await waitFor(() => expect(adminApi.deactivateProvider).toHaveBeenCalledWith("p1"));
  });

  it("creates a provider with an auto-generated password and shows it once", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.listProviders).mockResolvedValue([]);
    vi.mocked(adminApi.createProvider).mockResolvedValue({
      id: "p2",
      email: "new@clinic.dev",
      name: "New Doc",
      role: "provider",
      isActive: true,
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    render(<AdminRosterPage />);
    await waitFor(() => expect(adminApi.listProviders).toHaveBeenCalled());

    await user.type(screen.getByLabelText("Name"), "New Doc");
    await user.type(screen.getByLabelText("Email"), "new@clinic.dev");
    await user.click(screen.getByRole("button", { name: /add account/i }));

    await waitFor(() => expect(adminApi.createProvider).toHaveBeenCalled());
    const call = vi.mocked(adminApi.createProvider).mock.calls[0][0];
    expect(call.email).toBe("new@clinic.dev");
    expect(call.password.length).toBeGreaterThanOrEqual(8);

    expect(screen.getByText(/temporary password/i)).toBeInTheDocument();
    expect(screen.getByText(call.password)).toBeInTheDocument();
  });
});
