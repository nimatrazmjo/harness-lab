import { useEffect, useState } from "react";
import type { Encounter, ProviderSummary } from "@scribe/shared-types";
import { adminApi } from "../../api/admin";

export function AdminEncountersPage() {
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [providerId, setProviderId] = useState("");
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
      .listEncounters({ providerId: providerId || undefined, from: from || undefined, to: to || undefined })
      .then(setEncounters)
      .catch(() => setError("Could not load encounters."))
      .finally(() => setLoading(false));
  }, [providerId, from, to]);

  function providerName(id: string): string {
    return providers.find((p) => p.id === id)?.name ?? id;
  }

  return (
    <section>
      <h2>All encounters</h2>
      <div className="admin-filters">
        <label htmlFor="filter-provider">Provider</label>
        <select id="filter-provider" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
          <option value="">All providers</option>
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label htmlFor="filter-from">From</label>
        <input id="filter-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label htmlFor="filter-to">To</label>
        <input id="filter-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
              <th>Status</th>
              <th>Provider</th>
              <th>Patient</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {encounters.map((e) => (
              <tr key={e.id}>
                <td>
                  <span className={`status-pill status-pill--${e.status}`}>{e.status}</span>
                </td>
                <td>{providerName(e.providerId)}</td>
                <td>{e.patientId}</td>
                <td>{new Date(e.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {encounters.length === 0 && (
              <tr>
                <td colSpan={4} className="admin-table__empty">
                  No encounters match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
