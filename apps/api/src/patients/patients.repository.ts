import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

export interface PatientRow {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  created_at: Date;
}

@Injectable()
export class PatientsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Dedupe by (first_name, last_name, dob) — the identity used to match returning patients. */
  async findOrCreate(input: { firstName: string; lastName: string; dob: string }): Promise<PatientRow> {
    const existing = await this.pool.query<PatientRow>(
      "SELECT * FROM patients WHERE first_name = $1 AND last_name = $2 AND dob = $3",
      [input.firstName, input.lastName, input.dob],
    );
    if (existing.rows[0]) return existing.rows[0];

    const inserted = await this.pool.query<PatientRow>(
      "INSERT INTO patients (first_name, last_name, dob) VALUES ($1, $2, $3) RETURNING *",
      [input.firstName, input.lastName, input.dob],
    );
    return inserted.rows[0];
  }

  async findById(id: string): Promise<PatientRow | null> {
    const result = await this.pool.query<PatientRow>("SELECT * FROM patients WHERE id = $1", [id]);
    return result.rows[0] ?? null;
  }
}
