import type { NoteVersion, SoapNote } from "@scribe/shared-types";
import { diffIcd10Codes, diffLines } from "./diff";

export interface VersionDiffProps {
  from: NoteVersion;
  to: NoteVersion;
}

const SECTIONS: { key: keyof Pick<SoapNote, "subjective" | "objective" | "assessment" | "plan">; label: string }[] = [
  { key: "subjective", label: "Subjective" },
  { key: "objective", label: "Objective" },
  { key: "assessment", label: "Assessment" },
  { key: "plan", label: "Plan" },
];

/** Line-level highlighted diff between two saved (immutable) note versions — read-only,
 * never writes to note_versions. */
export function VersionDiff({ from, to }: VersionDiffProps) {
  const icd10Diff = diffIcd10Codes(from.note.icd10Codes, to.note.icd10Codes);
  const hasIcd10Change = icd10Diff.added.length > 0 || icd10Diff.removed.length > 0;

  return (
    <div className="version-diff">
      <h3 className="version-diff__title">
        Comparing v{from.versionNumber} → v{to.versionNumber}
      </h3>

      {SECTIONS.map(({ key, label }) => {
        const lines = diffLines(from.note[key], to.note[key]);
        const changed = lines.some((l) => l.type !== "same");
        return (
          <div key={key} className="version-diff__section">
            <h4>
              {label} {!changed && <span className="version-diff__unchanged-tag">(unchanged)</span>}
            </h4>
            <ul className="version-diff__lines">
              {lines.map((line, idx) => (
                <li key={idx} className={`version-diff__line version-diff__line--${line.type}`}>
                  <span className="version-diff__marker">
                    {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
                  </span>
                  <span>{line.text || " "}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <div className="version-diff__section">
        <h4>ICD-10 codes {!hasIcd10Change && <span className="version-diff__unchanged-tag">(unchanged)</span>}</h4>
        <ul className="version-diff__lines">
          {icd10Diff.removed.map((c) => (
            <li key={`removed-${c.code}`} className="version-diff__line version-diff__line--removed">
              <span className="version-diff__marker">{"−"}</span>
              <span>
                {c.code} {c.description}
              </span>
            </li>
          ))}
          {icd10Diff.added.map((c) => (
            <li key={`added-${c.code}`} className="version-diff__line version-diff__line--added">
              <span className="version-diff__marker">+</span>
              <span>
                {c.code} {c.description}
              </span>
            </li>
          ))}
          {icd10Diff.unchanged.map((c) => (
            <li key={`same-${c.code}`} className="version-diff__line version-diff__line--same">
              <span className="version-diff__marker">{" "}</span>
              <span>
                {c.code} {c.description}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
