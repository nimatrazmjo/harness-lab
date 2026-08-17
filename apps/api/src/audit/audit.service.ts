import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import type { AuditLogFilter } from "@scribe/shared-types";
import { PG_POOL } from "../database/database.module";

export interface AuditLogRow {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

@Injectable()
export class AuditService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Append-only — no UPDATE/DELETE path exists anywhere in this codebase for audit_logs.
   * Metadata must only ever carry structural facts (ids, counts, role changes) — never a
   * password, token, or transcript/PHI content (AGENTS.md [SECRETS]). */
  async log(input: { actorId: string; action: string; targetType?: string; targetId?: string; metadata?: object }) {
    await this.pool.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata) VALUES ($1, $2, $3, $4, $5)`,
      [input.actorId, input.action, input.targetType ?? null, input.targetId ?? null, input.metadata ?? {}],
    );
  }

  async listAll(filter: AuditLogFilter = {}): Promise<AuditLogRow[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (filter.actorId) {
      params.push(filter.actorId);
      clauses.push(`al.actor_id = $${params.length}`);
    }
    if (filter.action) {
      params.push(filter.action);
      clauses.push(`al.action = $${params.length}`);
    }
    if (filter.from) {
      params.push(filter.from);
      clauses.push(`al.created_at >= $${params.length}`);
    }
    if (filter.to) {
      params.push(filter.to);
      clauses.push(`al.created_at <= $${params.length}`);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const result = await this.pool.query<AuditLogRow>(
      `SELECT al.*, p.name AS actor_name
       FROM audit_logs al
       LEFT JOIN providers p ON p.id = al.actor_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT 500`,
      params,
    );
    return result.rows;
  }
}
