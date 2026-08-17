import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

const NOTE = {
  subjective: "s",
  objective: "o",
  assessment: "a",
  plan: "p",
  icd10Codes: [],
};

describe("Audit trail", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("a note save writes an audit row with actor, action, target, and timestamp", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Audit", patientLastName: "NoteSave", patientDob: "1990-01-01" });

    await request(app.getHttpServer())
      .post(`/encounters/${created.body.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: NOTE });

    const row = await pool.query(
      "SELECT * FROM audit_logs WHERE actor_id = $1 AND action = 'note.save' ORDER BY created_at DESC LIMIT 1",
      [provider.id],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].target_type).toBe("encounter");
    expect(row.rows[0].target_id).toBe(created.body.id);
    expect(row.rows[0].created_at).toBeTruthy();
  });

  it("creating a provider writes an audit row, without leaking the password", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);
    const email = `audit-created-${uuid()}@clinic.dev`;

    const created = await request(app.getHttpServer())
      .post("/admin/providers")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email, password: "some-secret-password", name: "Audit Target" });

    const row = await pool.query(
      "SELECT * FROM audit_logs WHERE actor_id = $1 AND action = 'admin.provider.create' ORDER BY created_at DESC LIMIT 1",
      [admin.id],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].target_id).toBe(created.body.id);
    expect(JSON.stringify(row.rows[0].metadata)).not.toContain("some-secret-password");
  });

  it("deactivating a provider writes an audit row", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);
    const target = await createTestProvider(pool, "provider");

    await request(app.getHttpServer())
      .patch(`/admin/providers/${target.id}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);

    const row = await pool.query(
      "SELECT * FROM audit_logs WHERE actor_id = $1 AND action = 'admin.provider.deactivate' ORDER BY created_at DESC LIMIT 1",
      [admin.id],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].target_id).toBe(target.id);
  });

  it("creating, editing, and deleting a template each write an audit row", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);

    const created = await request(app.getHttpServer())
      .post("/templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Audit Template", encounterType: "test", promptInstructions: "x" });
    await request(app.getHttpServer())
      .patch(`/templates/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ promptInstructions: "y" });
    await request(app.getHttpServer())
      .delete(`/templates/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    const rows = await pool.query(
      "SELECT action FROM audit_logs WHERE actor_id = $1 AND target_id = $2 ORDER BY created_at ASC",
      [admin.id, created.body.id],
    );
    expect(rows.rows.map((r) => r.action)).toEqual([
      "admin.template.create",
      "admin.template.update",
      "admin.template.delete",
    ]);
  });

  it("GET /admin/audit-logs returns rows newest-first with actor identity", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);
    await request(app.getHttpServer())
      .post("/templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Query Test Template", encounterType: "test", promptInstructions: "x" });

    const response = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(typeof response.body[0].actorName).toBe("string");
    expect(response.body[0].actorName.length).toBeGreaterThan(0);
    expect(response.body[0].actorId).toBeTruthy();
    expect(response.body[0].createdAt).toBeTruthy();

    const timestamps = response.body.map((r: { createdAt: string }) => new Date(r.createdAt).getTime());
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);
  });

  it("filters by action", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);
    await request(app.getHttpServer())
      .post("/templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Filter Test Template", encounterType: "test", promptInstructions: "x" });

    const response = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .query({ action: "admin.template.create" })
      .set("Authorization", `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body.every((r: { action: string }) => r.action === "admin.template.create")).toBe(true);
  });

  it("filters by date range", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);
    await request(app.getHttpServer())
      .post("/templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Date Range Test Template", encounterType: "test", promptInstructions: "x" });

    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const farFuture = new Date(Date.now() + 86_400_000 * 30).toISOString().slice(0, 10);
    const noneExpected = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .query({ from: tomorrow, to: farFuture })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(noneExpected.body).toEqual([]);

    const today = new Date().toISOString().slice(0, 10);
    const someExpected = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .query({ from: today, action: "admin.template.create" })
      .set("Authorization", `Bearer ${adminToken}`);
    expect(someExpected.body.length).toBeGreaterThan(0);
  });

  it("a non-admin cannot read the audit log", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const response = await request(app.getHttpServer())
      .get("/admin/audit-logs")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
  });
});
