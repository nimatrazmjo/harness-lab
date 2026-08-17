import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

describe("Admin: provider roster", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("admin can create a new provider account, who can immediately log in", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);
    const email = `new-provider-${uuid()}@clinic.dev`;

    const created = await request(app.getHttpServer())
      .post("/admin/providers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email, password: "brand-new-password", name: "Dr. New Hire" });

    expect(created.status).toBe(201);
    expect(created.body.email).toBe(email);
    expect(created.body.role).toBe("provider");
    expect(created.body.isActive).toBe(true);
    expect(created.body).not.toHaveProperty("password");
    expect(created.body).not.toHaveProperty("passwordHash");

    const login = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email, password: "brand-new-password" });
    expect(login.status).toBe(201);
  });

  it("rejects creating a provider with a duplicate email", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);
    const existing = await createTestProvider(pool, "provider");

    const response = await request(app.getHttpServer())
      .post("/admin/providers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: existing.email, password: "some-password", name: "Duplicate" });

    expect(response.status).toBe(409);
  });

  it("a non-admin cannot create a provider account", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const response = await request(app.getHttpServer())
      .post("/admin/providers")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: `blocked-${uuid()}@clinic.dev`, password: "whatever-password", name: "Blocked" });

    expect(response.status).toBe(403);
  });

  it("deactivating a provider blocks their NEXT authenticated request, not just future logins", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);
    const provider = await createTestProvider(pool, "provider");
    const providerToken = await loginTestProvider(app, provider);

    // Session is valid before deactivation.
    const before = await request(app.getHttpServer())
      .get("/encounters")
      .set("Authorization", `Bearer ${providerToken}`);
    expect(before.status).toBe(200);

    const deactivate = await request(app.getHttpServer())
      .patch(`/admin/providers/${provider.id}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deactivate.status).toBe(200);

    // Same still-unexpired token, next request — rejected without a fresh login attempt.
    const after = await request(app.getHttpServer())
      .get("/encounters")
      .set("Authorization", `Bearer ${providerToken}`);
    expect(after.status).toBe(401);

    // And a fresh login attempt is also rejected.
    const loginAttempt = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: provider.email, password: provider.password });
    expect(loginAttempt.status).toBe(401);
  });

  it("deactivation preserves the provider's existing encounter data untouched", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);
    const provider = await createTestProvider(pool, "provider");
    const providerToken = await loginTestProvider(app, provider);

    const encounter = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ patientFirstName: "Preserved", patientLastName: "Draft", patientDob: "1990-01-01" });
    await request(app.getHttpServer())
      .patch(`/encounters/${encounter.body.id}/input`)
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ transcript: "This draft must survive deactivation untouched." });

    await request(app.getHttpServer())
      .patch(`/admin/providers/${provider.id}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);

    const row = await pool.query("SELECT transcript, provider_id FROM encounters WHERE id = $1", [encounter.body.id]);
    expect(row.rows[0].transcript).toBe("This draft must survive deactivation untouched.");
    expect(row.rows[0].provider_id).toBe(provider.id);
  });

  it("a non-admin cannot deactivate a provider", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const providerB = await createTestProvider(pool, "provider");
    const tokenA = await loginTestProvider(app, providerA);

    const response = await request(app.getHttpServer())
      .patch(`/admin/providers/${providerB.id}/deactivate`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(response.status).toBe(403);
  });

  it("admin can list the roster", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);
    const provider = await createTestProvider(pool, "provider");

    const response = await request(app.getHttpServer())
      .get("/admin/providers")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    const ids = response.body.map((p: { id: string }) => p.id);
    expect(ids).toContain(provider.id);
  });
});
