import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Navigate, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@scribe/shared-types";
import { AdminRoute } from "../AdminRoute";
import { AdminShell } from "../AdminShell";

const mockUseAuth = vi.fn();
vi.mock("../../../state/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../../../api/admin", () => ({
  adminApi: {
    listEncounters: vi.fn().mockResolvedValue([]),
    listProviders: vi.fn().mockResolvedValue([]),
    listAuditLogs: vi.fn().mockResolvedValue([]),
    createProvider: vi.fn(),
    deactivateProvider: vi.fn(),
  },
}));

vi.mock("../../../api/templates", () => ({
  templatesApi: {
    listActive: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const ADMIN_USER: AuthUser = { id: "u1", email: "admin@clinic.dev", name: "Dr. Admin", role: "admin" };
const PROVIDER_USER: AuthUser = { id: "u2", email: "dr@clinic.dev", name: "Dr. Chen", role: "provider" };

function renderAdminRoute(startPath = "/admin") {
  return render(
    <MemoryRouter initialEntries={[startPath]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminShell />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to="encounters" replace />} />
          <Route path="encounters" element={<div>Encounters page</div>} />
          <Route path="roster" element={<div>Roster page</div>} />
          <Route path="templates" element={<div>Templates page</div>} />
          <Route path="audit-log" element={<div>Audit log page</div>} />
        </Route>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/encounters" element={<div>Encounter list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminShell / AdminRoute", () => {
  it("renders a distinct admin shell for an admin user and defaults to Encounters", () => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, logout: vi.fn() });
    renderAdminRoute();

    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /admin sections/i })).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
    expect(screen.getByText("Encounters page")).toBeInTheDocument();
  });

  it("navigates between sections when nav links are clicked", async () => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, logout: vi.fn() });
    renderAdminRoute();

    await userEvent.click(screen.getByRole("link", { name: "Roster" }));
    expect(screen.getByText("Roster page")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Templates" }));
    expect(screen.getByText("Templates page")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "Audit Log" }));
    expect(screen.getByText("Audit log page")).toBeInTheDocument();
  });

  it("redirects a non-admin provider away from /admin", () => {
    mockUseAuth.mockReturnValue({ user: PROVIDER_USER, logout: vi.fn() });
    renderAdminRoute();

    expect(screen.getByText("Encounter list")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("redirects an unauthenticated user to login", () => {
    mockUseAuth.mockReturnValue({ user: null, logout: vi.fn() });
    renderAdminRoute();

    expect(screen.getByText("Login page")).toBeInTheDocument();
  });
});
