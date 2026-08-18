import { useAuth } from "../../state/auth-context";

const ADMIN_SECTIONS = ["Encounters", "Roster", "Templates", "Audit Log"];

/**
 * The admin nav/layout shell — distinct from the provider workspace shell. This is the single
 * attachment point the rest of the admin surface (view-all, roster, templates) renders into;
 * those pages are backend-complete already (see feature-list.json admin.*) and are not wired
 * into this nav yet.
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
            <li key={section}>{section}</li>
          ))}
        </ul>
      </nav>
      <div className="panel admin-shell__content">
        <p>Admin dashboard.</p>
      </div>
    </div>
  );
}
