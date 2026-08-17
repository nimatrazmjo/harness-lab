import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

describe("Admin: view all encounters (filterable)", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists encounters across every provider, not just the admin's own", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const providerB = await createTestProvider(pool, "provider");
    const admin = await createTestProvider(pool, "admin");
    const tokenA = await loginTestProvider(app, providerA);
    const tokenB = await loginTestProvider(app, providerB);
    const adminToken = await loginTestProvider(app, admin);

    const encA = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ patientFirstName: "Alpha", patientLastName: "One", patientDob: "1980-01-01" });
    const encB = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ patientFirstName: "Beta", patientLastName: "Two", patientDob: "1981-01-01" });

    const response = await request(app.getHttpServer())
      .get("/admin/encounters")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    const ids = response.body.map((e: { id: string }) => e.id);
    expect(ids).toContain(encA.body.id);
    expect(ids).toContain(encB.body.id);
  });

  it("filters by providerId", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const providerB = await createTestProvider(pool, "provider");
    const admin = await createTestProvider(pool, "admin");
    const tokenA = await loginTestProvider(app, providerA);
    const tokenB = await loginTestProvider(app, providerB);
    const adminToken = await loginTestProvider(app, admin);

    await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ patientFirstName: "FilterA", patientLastName: "Test", patientDob: "1980-01-01" });
    await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ patientFirstName: "FilterB", patientLastName: "Test", patientDob: "1981-01-01" });

    const response = await request(app.getHttpServer())
      .get("/admin/encounters")
      .query({ providerId: providerA.id })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.every((e: { providerId: string }) => e.providerId === providerA.id)).toBe(true);
  });

  it("filters by date range", async () => {
    const provider = await createTestProvider(pool, "provider");
    const admin = await createTestProvider(pool, "admin");
    const token = await loginTestProvider(app, provider);
    const adminToken = await loginTestProvider(app, admin);

    await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "DateRange", patientLastName: "Test", patientDob: "1980-01-01" });

    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const farFuture = new Date(Date.now() + 86_400_000 * 30).toISOString().slice(0, 10);

    const noneExpected = await request(app.getHttpServer())
      .get("/admin/encounters")
      .query({ from: tomorrow, to: farFuture })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(noneExpected.body).toEqual([]);

    const today = new Date().toISOString().slice(0, 10);
    const someExpected = await request(app.getHttpServer())
      .get("/admin/encounters")
      .query({ from: today })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(someExpected.body.length).toBeGreaterThan(0);
  });

  it("is unreachable for a non-admin", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const response = await request(app.getHttpServer())
      .get("/admin/encounters")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
  });
});
