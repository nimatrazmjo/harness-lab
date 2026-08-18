import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { Encounter } from "@scribe/shared-types";
import { encountersApi } from "../../api/encounters";
import { BrandMark } from "../../components/BrandMark";
import { useAuth } from "../../state/auth-context";

export function EncounterListPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    encountersApi.list().then(setEncounters).catch(() => setError("Could not load encounters."));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const encounter = await encountersApi.create({
        patientFirstName: firstName,
        patientLastName: lastName,
        patientDob: dob,
      });
      navigate(`/encounters/${encounter.id}`);
    } catch {
      setError("Could not start encounter. Check the patient details.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="workspace-shell">
      <header className="app-header">
        <div className="brand">
          <BrandMark />
          <h1>AI Clinical Scribe</h1>
        </div>
        <div className="app-header__user">
          <span>{user?.name}</span>
          <button type="button" className="btn-secondary" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <section className="panel">
        <h2>Start a new encounter</h2>
        <form className="new-encounter-form" onSubmit={onCreate}>
          <label htmlFor="firstName">First name</label>
          <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <label htmlFor="lastName">Last name</label>
          <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          <label htmlFor="dob">Date of birth</label>
          <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button type="submit" disabled={creating}>
            {creating ? "Starting..." : "Start encounter"}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Your encounters</h2>
        <ul className="encounter-list">
          {encounters.map((e) => (
            <li key={e.id}>
              <button type="button" onClick={() => navigate(`/encounters/${e.id}`)}>
                <span className={`status-pill status-pill--${e.status}`}>{e.status}</span>
                <span>{new Date(e.createdAt).toLocaleString()}</span>
              </button>
            </li>
          ))}
          {encounters.length === 0 && <li className="encounter-list__empty">No encounters yet.</li>}
        </ul>
      </section>
    </div>
  );
}
