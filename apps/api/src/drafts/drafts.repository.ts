import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";
import type { SoapNote } from "@scribe/shared-types";

export interface DraftRow {
  id: string;
  encounter_id: string;
  provider_id: string;
  transcript: string | null;
  note_draft: SoapNote | null;
  updated_at: Date;
}

@Injectable()
export class DraftsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async upsert(input: { encounterId: string; providerId: string; note: SoapNote }): Promise<DraftRow> {
    const result = await this.pool.query<DraftRow>(
      `INSERT INTO drafts (encounter_id, provider_id, note_draft)
       VALUES ($1, $2, $3)
       ON CONFLICT (encounter_id) DO UPDATE SET note_draft = $3, updated_at = now()
       RETURNING *`,
      [input.encounterId, input.providerId, JSON.stringify(input.note)],
    );
    return result.rows[0];
  }

  async findByEncounterId(encounterId: string): Promise<DraftRow | null> {
    const result = await this.pool.query<DraftRow>("SELECT * FROM drafts WHERE encounter_id = $1", [encounterId]);
    return result.rows[0] ?? null;
  }

  /** Called after a real save — the draft is now captured as an immutable note_versions row. */
  async deleteByEncounterId(encounterId: string): Promise<void> {
    await this.pool.query("DELETE FROM drafts WHERE encounter_id = $1", [encounterId]);
  }
}
