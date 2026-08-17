import type { Template } from "@scribe/shared-types";

export interface TranscriptInputProps {
  value: string;
  onChange: (value: string) => void;
  templates: Template[];
  selectedTemplateId?: string;
  onTemplateChange: (templateId: string) => void;
  disabled?: boolean;
}

/** The provider's raw transcript / freeform-notes input for an open encounter. */
export function TranscriptInput({
  value,
  onChange,
  templates,
  selectedTemplateId,
  onTemplateChange,
  disabled,
}: TranscriptInputProps) {
  return (
    <div className="transcript-input">
      <div className="transcript-input__header">
        <label htmlFor="template-select">Template</label>
        <select
          id="template-select"
          value={selectedTemplateId ?? ""}
          onChange={(e) => onTemplateChange(e.target.value)}
          disabled={disabled}
        >
          <option value="">No template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <label htmlFor="transcript">Encounter transcript / observations</label>
      <textarea
        id="transcript"
        rows={12}
        placeholder="Paste the encounter transcript, or type freeform clinical observations..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
