import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

export interface TemplateRow {
  id: string;
  name: string;
  encounter_type: string;
  prompt_instructions: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class TemplatesRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Always reads fresh (no cache) so admin edits take effect on the next generation. */
  async findById(id: string): Promise<TemplateRow | null> {
    const result = await this.pool.query<TemplateRow>("SELECT * FROM templates WHERE id = $1", [id]);
    return result.rows[0] ?? null;
  }

  async listActive(): Promise<TemplateRow[]> {
    const result = await this.pool.query<TemplateRow>(
      "SELECT * FROM templates WHERE is_active = true ORDER BY name ASC",
    );
    return result.rows;
  }

  async listAll(): Promise<TemplateRow[]> {
    const result = await this.pool.query<TemplateRow>("SELECT * FROM templates ORDER BY name ASC");
    return result.rows;
  }

  async create(input: { name: string; encounterType: string; promptInstructions: string }): Promise<TemplateRow> {
    const result = await this.pool.query<TemplateRow>(
      `INSERT INTO templates (name, encounter_type, prompt_instructions) VALUES ($1, $2, $3) RETURNING *`,
      [input.name, input.encounterType, input.promptInstructions],
    );
    return result.rows[0];
  }

  async update(
    id: string,
    input: Partial<{ name: string; encounterType: string; promptInstructions: string; isActive: boolean }>,
  ): Promise<TemplateRow | null> {
    const result = await this.pool.query<TemplateRow>(
      `UPDATE templates SET
         name = COALESCE($2, name),
         encounter_type = COALESCE($3, encounter_type),
         prompt_instructions = COALESCE($4, prompt_instructions),
         is_active = COALESCE($5, is_active),
         updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, input.name ?? null, input.encounterType ?? null, input.promptInstructions ?? null, input.isActive ?? null],
    );
    return result.rows[0] ?? null;
  }

  async delete(id: string): Promise<void> {
    await this.pool.query("DELETE FROM templates WHERE id = $1", [id]);
  }
}
