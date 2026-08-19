import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Encounter, Icd10CodeRef, NoteVersion, RedFlag, SoapNote, Template } from "@scribe/shared-types";
import { encountersApi } from "../../api/encounters";
import { streamScribeGeneration } from "../../api/scribe-stream";
import { templatesApi } from "../../api/templates";
import { Icd10SearchWidget } from "../icd10/Icd10SearchWidget";
import { NoteEditor } from "../note/NoteEditor";
import { VersionDiff } from "../note/VersionDiff";
import { VersionHistory } from "../note/VersionHistory";
import { TranscriptInput } from "./TranscriptInput";

const EMPTY_NOTE: SoapNote = { subjective: "", objective: "", assessment: "", plan: "", icd10Codes: [] };

export function EncounterWorkspacePage() {
  const { encounterId } = useParams<{ encounterId: string }>();
  const navigate = useNavigate();

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [transcript, setTranscript] = useState("");
  const [templateId, setTemplateId] = useState<string | undefined>(undefined);
  const [note, setNote] = useState<SoapNote | null>(null);
  const [generating, setGenerating] = useState(false);
  const [insufficientContent, setInsufficientContent] = useState<string | null>(null);
  const [history, setHistory] = useState<NoteVersion[]>([]);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [compareFromId, setCompareFromId] = useState("");
  const [compareToId, setCompareToId] = useState("");
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Serializes every /input PATCH (from both onTranscriptChange and onTemplateChange) so at
  // most one is ever in flight — otherwise an older request can resolve at the server after a
  // newer one and leave RDS holding a stale transcript (session-handoff.md "cross-cycle
  // transcript-autosave race").
  const inputPatchChain = useRef<Promise<unknown>>(Promise.resolve());
  const inputPatchSeq = useRef(0);

  useEffect(() => {
    if (!encounterId) return;
    encountersApi.get(encounterId).then((e) => {
      setEncounter(e);
      setTranscript(e.transcript ?? "");
      setTemplateId(e.templateId ?? undefined);
    });
    // Advisory only, computed independently of generation (pioneer.red_flags).
    encountersApi.getRedFlags(encounterId).then(setRedFlags);
    templatesApi.listActive().then(setTemplates);
    encountersApi.history(encounterId).then(setHistory);
    // Restore any in-progress (not yet saved) note — survives refresh, close/reopen, and a
    // different device, because it's read from RDS, not browser state (session.draft_persist).
    encountersApi.getDraft(encounterId).then((draft) => {
      if (draft.note) setNote(draft.note);
    });
  }, [encounterId]);

  // Debounced draft autosave — every edit (and the settled result of a generation) is
  // persisted to RDS, not just held in memory. Skipped mid-stream: token-by-token updates
  // during generation would otherwise fire a write per word.
  useEffect(() => {
    if (!encounterId || !note || generating) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      encountersApi.saveDraft(encounterId, note);
    }, 800);
    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [note, generating, encounterId]);

  // Queues one /input PATCH after another, never concurrently — guarantees the server applies
  // them in the order the client issued them, so an older edit can never overwrite a newer one.
  // `seq` lets a caller detect if a fresher update has been queued since, so it can skip a
  // now-stale follow-up (e.g. the red-flags refetch) instead of clobbering newer UI state.
  function queueInputUpdate(id: string, value: string, tmplId: string | undefined) {
    const seq = ++inputPatchSeq.current;
    const result = inputPatchChain.current.then(
      () => encountersApi.updateInput(id, value, tmplId),
      () => encountersApi.updateInput(id, value, tmplId),
    );
    inputPatchChain.current = result.catch(() => undefined);
    return { seq, result };
  }

  function onTranscriptChange(value: string) {
    setTranscript(value);
    if (!encounterId) return;
    // Debounced autosave of the raw input — persisted server-side as the provider types.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { seq, result } = queueInputUpdate(encounterId, value, templateId);
      result
        // Re-scan for red flags only after the new transcript is actually persisted.
        .then(() => encountersApi.getRedFlags(encounterId))
        .then((flags) => {
          // Apply the result only if no newer input update has been queued since this one was
          // dispatched — otherwise a slow response here could overwrite the banner with stale
          // results even though the underlying PATCH itself is safely serialized.
          if (seq === inputPatchSeq.current) {
            setRedFlags(flags);
          }
        })
        .catch(() => {});
    }, 600);
  }

  function onTemplateChange(id: string) {
    setTemplateId(id || undefined);
    if (!encounterId) return;
    queueInputUpdate(encounterId, transcript, id || undefined).result.catch(() => {});
  }

  async function onGenerate() {
    if (!encounterId) return;
    setGenerating(true);
    setInsufficientContent(null);
    setNote(EMPTY_NOTE);

    try {
      await streamScribeGeneration(encounterId, (event) => {
        if (event.type === "token") {
          setNote((prev) => (prev ? { ...prev, [event.section]: prev[event.section] + event.text } : prev));
        } else if (event.type === "icd10") {
          setNote((prev) => (prev ? { ...prev, icd10Codes: event.codes } : prev));
        } else if (event.type === "done") {
          setNote(event.note);
        } else if (event.type === "insufficient_content") {
          setNote(null);
          setInsufficientContent(event.reason);
        } else if (event.type === "error") {
          setInsufficientContent(event.message);
        }
      });
    } finally {
      setGenerating(false);
    }
  }

  function onAppendIcd10(result: Icd10CodeRef) {
    setNote((prev) => {
      if (!prev) return prev;
      if (prev.icd10Codes.some((c) => c.code === result.code)) return prev; // dedup
      return { ...prev, icd10Codes: [...prev.icd10Codes, result] };
    });
  }

  async function onSave() {
    if (!encounterId || !note) return;
    setSaving(true);
    setStatusMessage(null);
    try {
      await encountersApi.saveNote(encounterId, note);
      const [updatedHistory, updatedEncounter] = await Promise.all([
        encountersApi.history(encounterId),
        encountersApi.get(encounterId),
      ]);
      setHistory(updatedHistory);
      setEncounter(updatedEncounter);
      setStatusMessage("Saved.");
    } catch {
      setStatusMessage("Save failed — your edits are still here, try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!encounter) {
    return <p className="loading">Loading encounter...</p>;
  }

  const compareFrom = history.find((v) => v.id === compareFromId);
  const compareTo = history.find((v) => v.id === compareToId);
  const patient = encounter.patient;
  const patientDob = patient ? new Date(`${patient.dob}T00:00:00`).toLocaleDateString() : null;

  return (
    <div className="workspace-shell">
      <header className="app-header workspace-header">
        <button type="button" className="link-button" onClick={() => navigate("/encounters")}>
          ← Encounters
        </button>
        {patient && (
          <div className="workspace-header__patient">
            <span className="workspace-header__patient-name">
              {patient.firstName} {patient.lastName}
            </span>
            <span className="workspace-header__patient-dob">DOB {patientDob}</span>
          </div>
        )}
        <span className={`status-pill status-pill--${encounter.status}`}>{encounter.status}</span>
      </header>

      <div className="workspace-grid">
        <section className="panel">
          <h2>Encounter input</h2>
          <TranscriptInput
            value={transcript}
            onChange={onTranscriptChange}
            templates={templates}
            selectedTemplateId={templateId}
            onTemplateChange={onTemplateChange}
            disabled={generating}
          />
          {redFlags.length > 0 && (
            <div className="red-flags-banner" role="status">
              <p className="red-flags-banner__title">⚠ Possible red flags — review before generating</p>
              <ul>
                {redFlags.map((flag) => (
                  <li key={flag.id}>{flag.message}</li>
                ))}
              </ul>
            </div>
          )}
          <button type="button" onClick={onGenerate} disabled={generating || transcript.trim().length === 0}>
            {generating ? "Generating..." : "Generate note"}
          </button>
          {insufficientContent && (
            <p role="alert" className="form-error">
              Insufficient clinical content: {insufficientContent}
            </p>
          )}
        </section>

        <section className="panel">
          <h2>SOAP note</h2>
          {note ? (
            <>
              <NoteEditor note={note} onChange={setNote} disabled={generating} />
              <button type="button" onClick={onSave} disabled={saving || generating}>
                {saving ? "Saving..." : "Save note"}
              </button>
              {statusMessage && <p className="status-message">{statusMessage}</p>}
            </>
          ) : (
            <p className="empty-state">Generate a note to begin editing.</p>
          )}
        </section>

        <section className="panel">
          <h2>Version history</h2>
          <VersionHistory versions={history} onSelect={(v) => setNote(v.note)} />
          {history.length >= 2 && (
            <div className="version-compare">
              <label htmlFor="compare-from">Compare</label>
              <select id="compare-from" value={compareFromId} onChange={(e) => setCompareFromId(e.target.value)}>
                <option value="">Version...</option>
                {history.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber}
                  </option>
                ))}
              </select>
              <label htmlFor="compare-to">to</label>
              <select id="compare-to" value={compareToId} onChange={(e) => setCompareToId(e.target.value)}>
                <option value="">Version...</option>
                {history.map((v) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {compareFrom && compareTo && (
          <section className="panel version-diff-panel">
            <h2>Version diff</h2>
            <VersionDiff from={compareFrom} to={compareTo} />
          </section>
        )}

        {note && (
          <section className="panel">
            <h2>ICD-10 search</h2>
            <Icd10SearchWidget onAppend={onAppendIcd10} appendedCodes={note.icd10Codes} />
          </section>
        )}
      </div>
    </div>
  );
}
