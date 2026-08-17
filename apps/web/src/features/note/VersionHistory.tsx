import type { NoteVersion } from "@scribe/shared-types";

export interface VersionHistoryProps {
  versions: NoteVersion[];
  selectedVersionId?: string;
  onSelect?: (version: NoteVersion) => void;
}

/** Full, immutable version history for a note — read from RDS, author + timestamp per version. */
export function VersionHistory({ versions, selectedVersionId, onSelect }: VersionHistoryProps) {
  if (versions.length === 0) {
    return <p className="version-history__empty">No saved versions yet.</p>;
  }

  return (
    <ul className="version-history">
      {versions.map((v) => (
        <li key={v.id}>
          <button
            type="button"
            className={v.id === selectedVersionId ? "version-history__item version-history__item--selected" : "version-history__item"}
            onClick={() => onSelect?.(v)}
          >
            <span className="version-history__number">v{v.versionNumber}</span>
            <span className="version-history__author">{v.authorName}</span>
            <time className="version-history__time" dateTime={v.createdAt}>
              {new Date(v.createdAt).toLocaleString()}
            </time>
          </button>
        </li>
      ))}
    </ul>
  );
}
