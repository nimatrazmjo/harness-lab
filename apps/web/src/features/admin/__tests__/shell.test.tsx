import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@scribe/shared-types";
import { AdminRoute } from "../AdminRoute";
import { AdminShell } from "../AdminShell";

const mockUseAuth = vi.fn();
vi.mock("../../../state/auth-context", () => ({
  useAuth: () => mockUseAuth(),
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
        />
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/encounters" element={<div>Encounter list</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminShell / AdminRoute", () => {
  it("renders a distinct admin shell for an admin user", () => {
    mockUseAuth.mockReturnValue({ user: ADMIN_USER, logout: vi.fn() });
    renderAdminRoute();

    expect(screen.getByRole("heading", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /admin sections/i })).toBeInTheDocument();
    expect(screen.getByText("Roster")).toBeInTheDocument();
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
