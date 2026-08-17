@AGENTS.md

## Claude Code notes

- `AGENTS.md` (imported above) is the **single source of truth** for this repo — the same file
  Cursor/Copilot use. Edit rules there, not here, so every agent stays in sync.
- Follow its **Session protocol**: before starting, read `progress.md`, `docs/PRODUCT.md`,
  `docs/ARCHITECTURE.md`, and `feature-list.json`; when done, update `progress.md`.
- You may later add area-specific rules in nested files (`apps/api/CLAUDE.md`,
  `apps/web/CLAUDE.md`). Claude Code loads those on demand when you work in those folders.
