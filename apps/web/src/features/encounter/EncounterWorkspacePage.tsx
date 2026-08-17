import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Encounter, Icd10CodeRef, NoteVersion, SoapNote, Template } from "@scribe/shared-types";
import { encountersApi } from "../../api/encounters";
import { streamScribeGeneration } from "../../api/scribe-stream";
import { templatesApi } from "../../api/templates";
import { Icd10SearchWidget } from "../icd10/Icd10SearchWidget";
import { NoteEditor } from "../note/NoteEditor";
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!encounterId) return;
    encountersApi.get(encounterId).then((e) => {
      setEncounter(e);
      setTranscript(e.transcript ?? "");
      setTemplateId(e.templateId ?? undefined);
    });
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

  function onTranscriptChange(value: string) {
    setTranscript(value);
    if (!encounterId) return;
    // Debounced autosave of the raw input — persisted server-side as the provider types.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      encountersApi.updateInput(encounterId, value, templateId);
    }, 600);
  }

  function onTemplateChange(id: string) {
    setTemplateId(id || undefined);
    if (!encounterId) return;
    encountersApi.updateInput(encounterId, transcript, id || undefined);
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

  return (
    <div className="workspace-shell">
      <header className="app-header">
        <button type="button" className="link-button" onClick={() => navigate("/encounters")}>
          ← Encounters
        </button>
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
        </section>

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
