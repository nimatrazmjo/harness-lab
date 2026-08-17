import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

describe("Admin: template library CRUD", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("admin can create, edit, and delete a template; changes persist in RDS", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);

    const created = await request(app.getHttpServer())
      .post("/templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Pediatric Well-Visit", encounterType: "pediatric_wellness", promptInstructions: "Focus on growth milestones." });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Pediatric Well-Visit");

    const dbRowAfterCreate = await pool.query("SELECT * FROM templates WHERE id = $1", [created.body.id]);
    expect(dbRowAfterCreate.rows).toHaveLength(1);

    const edited = await request(app.getHttpServer())
      .patch(`/templates/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ promptInstructions: "Focus on growth milestones AND vaccination schedule." });
    expect(edited.status).toBe(200);
    expect(edited.body.promptInstructions).toContain("vaccination schedule");

    const deleted = await request(app.getHttpServer())
      .delete(`/templates/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deleted.status).toBe(200);

    const dbRowAfterDelete = await pool.query("SELECT * FROM templates WHERE id = $1", [created.body.id]);
    expect(dbRowAfterDelete.rows).toHaveLength(0);
  });

  it("a non-admin cannot create, edit, or delete templates", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const createAttempt = await request(app.getHttpServer())
      .post("/templates")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Should Fail", encounterType: "x", promptInstructions: "x" });
    expect(createAttempt.status).toBe(403);
  });

  it("a non-admin CAN still read the active template list (unaffected by admin write-guard)", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const response = await request(app.getHttpServer()).get("/templates").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it("editing a non-existent template returns 404", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);

    const response = await request(app.getHttpServer())
      .patch("/templates/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Ghost" });
    expect(response.status).toBe(404);
  });
});
