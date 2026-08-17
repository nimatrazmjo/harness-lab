import { Controller, Get, Inject } from "@nestjs/common";
import { Pool } from "pg";
import { PG_POOL } from "../database/database.module";

@Controller("health")
export class HealthController {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  @Get()
  async check() {
    const result = await this.pool.query("SELECT 1 AS ok");
    return { status: "ok", db: result.rows[0].ok === 1 };
  }
}
