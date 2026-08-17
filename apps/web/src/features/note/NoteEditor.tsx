import type { SoapNote } from "@scribe/shared-types";

export interface NoteEditorProps {
  note: SoapNote;
  onChange: (note: SoapNote) => void;
  disabled?: boolean;
}

const SECTIONS: { key: keyof Pick<SoapNote, "subjective" | "objective" | "assessment" | "plan">; label: string }[] = [
  { key: "subjective", label: "Subjective" },
  { key: "objective", label: "Objective" },
  { key: "assessment", label: "Assessment" },
  { key: "plan", label: "Plan" },
];

/** Inline-editable SOAP note — the provider reviews and edits before save (human-in-the-loop). */
export function NoteEditor({ note, onChange, disabled }: NoteEditorProps) {
  return (
    <div className="note-editor">
      {SECTIONS.map(({ key, label }) => (
        <div key={key} className="note-editor__section">
          <label htmlFor={`note-${key}`}>{label}</label>
          <textarea
            id={`note-${key}`}
            rows={key === "subjective" || key === "objective" ? 5 : 4}
            value={note[key]}
            disabled={disabled}
            onChange={(e) => onChange({ ...note, [key]: e.target.value })}
          />
        </div>
      ))}
      <div className="note-editor__section">
        <span className="note-editor__label-static">ICD-10 codes</span>
        <ul className="icd10-chip-list">
          {note.icd10Codes.map((c) => (
            <li key={c.code} className="icd10-chip">
              <strong>{c.code}</strong> {c.description}
            </li>
          ))}
          {note.icd10Codes.length === 0 && <li className="icd10-chip icd10-chip--empty">No codes yet</li>}
        </ul>
      </div>
    </div>
  );
}
