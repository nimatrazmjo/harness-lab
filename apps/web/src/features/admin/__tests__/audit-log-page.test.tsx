import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AuditLog, ProviderSummary } from "@scribe/shared-types";
import { AdminAuditLogPage } from "../AdminAuditLogPage";
import { adminApi } from "../../../api/admin";

vi.mock("../../../api/admin", () => ({
  adminApi: {
    listAuditLogs: vi.fn(),
    listProviders: vi.fn(),
  },
}));

const PROVIDERS: ProviderSummary[] = [
  { id: "p1", email: "admin@clinic.dev", name: "Clinic Admin", role: "admin", isActive: true, createdAt: "2026-01-01T00:00:00.000Z" },
];

const LOGS: AuditLog[] = [
  {
    id: "l1",
    actorId: "p1",
    actorName: "Clinic Admin",
    action: "admin.template.create",
    targetType: "template",
    targetId: "t1",
    metadata: {},
    createdAt: "2026-01-02T00:00:00.000Z",
  },
];

describe("AdminAuditLogPage", () => {
  it("lists audit entries with actor + action", async () => {
    vi.mocked(adminApi.listProviders).mockResolvedValue(PROVIDERS);
    vi.mocked(adminApi.listAuditLogs).mockResolvedValue(LOGS);

    render(<AdminAuditLogPage />);

    await waitFor(() => expect(screen.getAllByText("Clinic Admin").length).toBeGreaterThan(0));
    expect(screen.getByRole("row", { name: /Clinic Admin/ })).toBeInTheDocument();
    expect(screen.getByText("admin.template.create")).toBeInTheDocument();
  });

  it("re-fetches with the action filter when changed", async () => {
    const user = userEvent.setup();
    vi.mocked(adminApi.listProviders).mockResolvedValue(PROVIDERS);
    vi.mocked(adminApi.listAuditLogs).mockResolvedValue([]);

    render(<AdminAuditLogPage />);
    await waitFor(() => expect(adminApi.listAuditLogs).toHaveBeenCalledWith({}));

    await user.type(screen.getByLabelText("Action"), "note.save");

    await waitFor(() =>
      expect(adminApi.listAuditLogs).toHaveBeenLastCalledWith({ action: "note.save" }),
    );
  });
});
