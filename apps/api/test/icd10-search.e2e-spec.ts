import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

describe("ICD-10: pgvector semantic search", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns ranked, real results for a plain-English query", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const response = await request(app.getHttpServer())
      .get("/icd10/search")
      .query({ query: "low back pain" })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0]).toMatchObject({ code: expect.any(String), description: expect.any(String) });

    // No fabrication: every returned code must exist in the embedded set.
    const dbCodes = await pool.query("SELECT code FROM icd10_codes");
    const validCodes = new Set(dbCodes.rows.map((r) => r.code));
    for (const result of response.body) {
      expect(validCodes.has(result.code)).toBe(true);
    }
  });

  it("respects the limit parameter", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const response = await request(app.getHttpServer())
      .get("/icd10/search")
      .query({ query: "chest pain", limit: 3 })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeLessThanOrEqual(3);
  });

  it("rejects an empty query", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const response = await request(app.getHttpServer())
      .get("/icd10/search")
      .query({ query: "" })
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  it("requires authentication", async () => {
    const response = await request(app.getHttpServer()).get("/icd10/search").query({ query: "knee pain" });
    expect(response.status).toBe(401);
  });
});
