import { Global, Inject, Module, OnApplicationShutdown } from "@nestjs/common";
import { Pool } from "pg";
import { APP_CONFIG, AppConfig } from "../config/app-config";

export const PG_POOL = Symbol("PG_POOL");

/**
 * One Pool per process, created once at startup and reused across every request —
 * see AGENTS.md [POOLING]. Never call `new Pool()` / `new Client()` per request
 * anywhere else in the app; inject PG_POOL instead.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new Pool({
          connectionString: config.databaseUrl,
          max: config.dbPoolMax,
          idleTimeoutMillis: config.dbPoolIdleTimeoutMs,
        }),
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
