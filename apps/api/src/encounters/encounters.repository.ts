import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";
import type { EncounterStatus } from "@scribe/shared-types";

export interface EncounterRow {
  id: string;
  provider_id: string;
  patient_id: string;
  template_id: string | null;
  status: EncounterStatus;
  transcript: string | null;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class EncountersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(input: {
    providerId: string;
    patientId: string;
    templateId: string | null;
  }): Promise<EncounterRow> {
    const result = await this.pool.query<EncounterRow>(
      `INSERT INTO encounters (provider_id, patient_id, template_id, status)
       VALUES ($1, $2, $3, 'draft') RETURNING *`,
      [input.providerId, input.patientId, input.templateId],
    );
    return result.rows[0];
  }

  async findById(id: string): Promise<EncounterRow | null> {
    const result = await this.pool.query<EncounterRow>("SELECT * FROM encounters WHERE id = $1", [id]);
    return result.rows[0] ?? null;
  }

  async updateInput(id: string, transcript: string, templateId: string | null): Promise<EncounterRow | null> {
    const result = await this.pool.query<EncounterRow>(
      `UPDATE encounters SET transcript = $2, template_id = COALESCE($3, template_id), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, transcript, templateId],
    );
    return result.rows[0] ?? null;
  }

  async updateStatus(id: string, status: EncounterStatus): Promise<void> {
    await this.pool.query("UPDATE encounters SET status = $2, updated_at = now() WHERE id = $1", [id, status]);
  }

  async listForProvider(providerId: string): Promise<EncounterRow[]> {
    const result = await this.pool.query<EncounterRow>(
      "SELECT * FROM encounters WHERE provider_id = $1 ORDER BY created_at DESC",
      [providerId],
    );
    return result.rows;
  }

  async listAll(filter: { providerId?: string; from?: string; to?: string }): Promise<EncounterRow[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.providerId) {
      params.push(filter.providerId);
      clauses.push(`provider_id = $${params.length}`);
    }
    if (filter.from) {
      params.push(filter.from);
      clauses.push(`created_at >= $${params.length}`);
    }
    if (filter.to) {
      params.push(filter.to);
      clauses.push(`created_at <= $${params.length}`);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const result = await this.pool.query<EncounterRow>(
      `SELECT * FROM encounters ${where} ORDER BY created_at DESC`,
      params,
    );
    return result.rows;
  }

  /** Returns prior encounters for the same patient, most recent first, excluding the current one. */
  async listPriorForPatient(patientId: string, excludeEncounterId: string): Promise<EncounterRow[]> {
    const result = await this.pool.query<EncounterRow>(
      `SELECT * FROM encounters WHERE patient_id = $1 AND id != $2 ORDER BY created_at DESC`,
      [patientId, excludeEncounterId],
    );
    return result.rows;
  }
}
