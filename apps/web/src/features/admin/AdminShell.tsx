import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../state/auth-context";

const ADMIN_SECTIONS = [
  { label: "Encounters", to: "encounters" },
  { label: "Roster", to: "roster" },
  { label: "Templates", to: "templates" },
  { label: "Audit Log", to: "audit-log" },
];

/**
 * The admin nav/layout shell — distinct from the provider workspace shell. Each nav item is a
 * real route; the matched child page renders into the <Outlet /> below.
 */
export function AdminShell() {
  const { user, logout } = useAuth();

  return (
    <div className="admin-shell">
      <header className="app-header admin-shell__header">
        <h1>Admin</h1>
        <div className="app-header__user">
          <span>{user?.name}</span>
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <nav className="admin-shell__nav" aria-label="Admin sections">
        <ul>
          {ADMIN_SECTIONS.map((section) => (
            <li key={section.to}>
              <NavLink to={section.to} className={({ isActive }) => (isActive ? "is-active" : undefined)}>
                {section.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="panel admin-shell__content">
        <Outlet />
      </div>
    </div>
  );
}
