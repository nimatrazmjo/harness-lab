import { Inject, Injectable } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";
import type { Role } from "@scribe/shared-types";

export interface ProviderRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  is_active: boolean;
  created_at: Date;
}

@Injectable()
export class ProvidersRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async findByEmail(email: string): Promise<ProviderRow | null> {
    const result = await this.pool.query<ProviderRow>("SELECT * FROM providers WHERE email = $1", [email]);
    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<ProviderRow | null> {
    const result = await this.pool.query<ProviderRow>("SELECT * FROM providers WHERE id = $1", [id]);
    return result.rows[0] ?? null;
  }

  async findByIds(ids: string[]): Promise<ProviderRow[]> {
    if (ids.length === 0) return [];
    const result = await this.pool.query<ProviderRow>("SELECT * FROM providers WHERE id = ANY($1::uuid[])", [ids]);
    return result.rows;
  }

  async create(input: { email: string; passwordHash: string; name: string; role: Role }): Promise<ProviderRow> {
    const result = await this.pool.query<ProviderRow>(
      `INSERT INTO providers (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING *`,
      [input.email, input.passwordHash, input.name, input.role],
    );
    return result.rows[0];
  }

  async listAll(): Promise<ProviderRow[]> {
    const result = await this.pool.query<ProviderRow>("SELECT * FROM providers ORDER BY created_at ASC");
    return result.rows;
  }

  async setActive(id: string, isActive: boolean): Promise<void> {
    await this.pool.query("UPDATE providers SET is_active = $2 WHERE id = $1", [id, isActive]);
  }
}
