import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

@Injectable()
export class AuditService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async log(input: { actorId: string; action: string; targetType?: string; targetId?: string; metadata?: object }) {
    await this.pool.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, metadata) VALUES ($1, $2, $3, $4, $5)`,
      [input.actorId, input.action, input.targetType ?? null, input.targetId ?? null, input.metadata ?? {}],
    );
  }

  async listAll(): Promise<unknown[]> {
    const result = await this.pool.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500");
    return result.rows;
  }
}
