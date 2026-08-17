# Progress Log — AI Clinical Scribe

Rolling log the agent reads at the **start** of every session and updates at the **end**. It is
the fast way to recover context without re-exploring the repo. Newest entry on top.

> **How to maintain (agent):**
> - **Session start:** read "Current state" below, then the latest 2–3 log entries.
> - **After each feature / session end:** update "Current state" and prepend a dated entry.
> - Reference features by their `feature-list.json` id. Keep entries short: what changed, what's next.
> - Division of labor: `progress.md` = *where we are*; `feature-list.json` = *what's left*;
>   `docs/` = *what & why + how*.

---

## Current state

- **Active phase:** Phase 0 — Foundations (infra-first). Nothing implemented yet.
- **Tier 0:** 0 / 17 passing   ·   **Tier 1:** 0 / 16 passing   ·   **Tier 2:** 0 / 4 passing
- **Next feature:** `infra.ec2_nginx_tls` → `infra.rds_postgres_private` (foundation before features).
- **Environment:** local bootstrap via `pnpm setup` (see `init.sh`). Not yet deployed to AWS.
- **Open decisions:** monorepo tool (pnpm workspaces baseline; Nx/Turborepo optional); migration runner.
- **Blockers:** none.

---

## Log

### 2026-08-17 — Harness bootstrap
- Established the harness layer: `AGENTS.md` (invariants + session protocol), `feature-list.json`
  (37 features, tiered), `BUILD-CHECKLIST.md` (phased order), `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`,
  `init.sh`, `.env.example`, `infra/docker-compose.yml`.
- No application code yet — feature logic is written by the coding agent against this harness.
- **Next:** begin Phase 0 — stand up EC2 + nginx + TLS and private RDS before any feature.

---

<!-- Template — prepend a new entry under ## Log:
### YYYY-MM-DD — <short title>
- <what changed — reference feature ids, e.g. auth.login now passing>
- <decisions or gotchas worth remembering>
- **Next:** <the next failing feature>
-->
