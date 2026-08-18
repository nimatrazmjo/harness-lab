import { useEffect, useState, type FormEvent } from "react";
import type { ProviderSummary, Role } from "@scribe/shared-types";
import { adminApi } from "../../api/admin";

/** Client-generated, shown once on the create-success banner — the server only ever stores the
 * argon2 hash (AGENTS.md [SECRETS]), so this is the admin's only chance to see the plaintext. */
function generateTempPassword(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

export function AdminRosterPage() {
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("provider");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCredential, setCreatedCredential] = useState<{ email: string; password: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    adminApi.listProviders().then(setProviders).catch(() => setError("Could not load the roster."));
  }

  useEffect(load, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    setCreatedCredential(null);
    const password = generateTempPassword();
    try {
      await adminApi.createProvider({ email, password, name, role });
      setCreatedCredential({ email, password });
      setName("");
      setEmail("");
      setRole("provider");
      load();
    } catch {
      setError("Could not create the account. Check the email isn't already in use.");
    } finally {
      setCreating(false);
    }
  }

  async function onDeactivate(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await adminApi.deactivateProvider(id);
      load();
    } catch {
      setError("Could not deactivate this account.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h2>Provider roster</h2>
      <form className="admin-inline-form" onSubmit={onCreate}>
        <label htmlFor="roster-name">Name</label>
        <input id="roster-name" value={name} onChange={(e) => setName(e.target.value)} required />
        <label htmlFor="roster-email">Email</label>
        <input
          id="roster-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label htmlFor="roster-role">Role</label>
        <select id="roster-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="provider">Provider</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" disabled={creating}>
          {creating ? "Creating..." : "Add account"}
        </button>
      </form>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      {createdCredential && (
        <p className="admin-credential-banner" role="status">
          Account created for {createdCredential.email}. Temporary password (shown once):{" "}
          <code>{createdCredential.password}</code>
        </p>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {providers.map((p) => (
            <tr key={p.id}>
              <td>{p.name}</td>
              <td>{p.email}</td>
              <td>{p.role}</td>
              <td>{p.isActive ? "Active" : "Deactivated"}</td>
              <td>
                {p.isActive && (
                  <button type="button" onClick={() => onDeactivate(p.id)} disabled={busyId === p.id}>
                    {busyId === p.id ? "Deactivating..." : "Deactivate"}
                  </button>
                )}
              </td>
            </tr>
          ))}
          {providers.length === 0 && (
            <tr>
              <td colSpan={5} className="admin-table__empty">
                No providers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
