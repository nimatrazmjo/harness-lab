import { useEffect, useState } from "react";
import type { AuditLog, ProviderSummary } from "@scribe/shared-types";
import { adminApi } from "../../api/admin";

export function AdminAuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.listProviders().then(setProviders).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    adminApi
      .listAuditLogs({
        actorId: actorId || undefined,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      .then(setLogs)
      .catch(() => setError("Could not load the audit log."))
      .finally(() => setLoading(false));
  }, [actorId, action, from, to]);

  return (
    <section>
      <h2>Audit log</h2>
      <div className="admin-filters">
        <label htmlFor="audit-actor">Actor</label>
        <select id="audit-actor" value={actorId} onChange={(e) => setActorId(e.target.value)}>
          <option value="">All actors</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label htmlFor="audit-action">Action</label>
        <input
          id="audit-action"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="e.g. note.save"
        />
        <label htmlFor="audit-from">From</label>
        <input id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label htmlFor="audit-to">To</label>
        <input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.actorName ?? "—"}</td>
                <td>{log.action}</td>
                <td>{log.targetType ? `${log.targetType}:${log.targetId}` : "—"}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="admin-table__empty">
                  No matching audit entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
