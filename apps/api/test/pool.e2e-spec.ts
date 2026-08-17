import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, getPool } from "./test-app";

describe("DB connection pooling", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("a burst of concurrent requests stays within the configured bounded pool size", async () => {
    const pool = getPool(app);
    const configuredMax = 10; // apps/api/test/jest-setup.ts / .env.example default (DB_POOL_MAX)

    await Promise.all(Array.from({ length: 30 }, () => request(app.getHttpServer()).get("/health")));

    expect(pool.totalCount).toBeLessThanOrEqual(configuredMax);
  });

  it("the same Pool instance is reused across requests (no per-request Pool creation)", async () => {
    const poolBefore = getPool(app);
    await request(app.getHttpServer()).get("/health");
    await request(app.getHttpServer()).get("/health");
    const poolAfter = getPool(app);
    expect(poolAfter).toBe(poolBefore);
  });
});
