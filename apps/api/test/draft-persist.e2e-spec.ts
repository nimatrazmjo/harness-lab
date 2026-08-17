import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

const NOTE = {
  subjective: "Patient reports draft-in-progress subjective.",
  objective: "Draft objective findings.",
  assessment: "Draft assessment.",
  plan: "Draft plan not yet saved.",
  icd10Codes: [{ code: "M54.5", description: "Low back pain" }],
};

describe("Draft persistence (session.draft_persist)", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("a fresh encounter has no draft", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "No", patientLastName: "Draft", patientDob: "1990-01-01" });

    const response = await request(app.getHttpServer())
      .get(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ note: null, updatedAt: null });
  });

  it("saving a draft persists it to RDS, retrievable via GET", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Has", patientLastName: "Draft", patientDob: "1990-01-01" });

    const saveResponse = await request(app.getHttpServer())
      .put(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: NOTE });
    expect(saveResponse.status).toBe(200);

    const dbRow = await pool.query("SELECT note_draft FROM drafts WHERE encounter_id = $1", [created.body.id]);
    expect(dbRow.rows).toHaveLength(1);
    expect(dbRow.rows[0].note_draft).toEqual(NOTE);

    const getResponse = await request(app.getHttpServer())
      .get(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${token}`);
    expect(getResponse.body.note).toEqual(NOTE);
    expect(getResponse.body.updatedAt).toBeTruthy();
  });

  it("re-saving a draft updates the same row (upsert), not a new one", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Upsert", patientLastName: "Test", patientDob: "1990-01-01" });

    await request(app.getHttpServer())
      .put(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: NOTE });
    await request(app.getHttpServer())
      .put(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: { ...NOTE, plan: "Updated draft plan." } });

    const rows = await pool.query("SELECT note_draft FROM drafts WHERE encounter_id = $1", [created.body.id]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].note_draft.plan).toBe("Updated draft plan.");
  });

  it("a provider cannot read or write a draft on another provider's encounter", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const providerB = await createTestProvider(pool, "provider");
    const tokenA = await loginTestProvider(app, providerA);
    const tokenB = await loginTestProvider(app, providerB);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ patientFirstName: "Isolated", patientLastName: "Draft", patientDob: "1990-01-01" });

    const getAttempt = await request(app.getHttpServer())
      .get(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(getAttempt.status).toBe(403);

    const putAttempt = await request(app.getHttpServer())
      .put(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ note: NOTE });
    expect(putAttempt.status).toBe(403);
  });

  it("saving the note for real clears the draft row", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Cleared", patientLastName: "OnSave", patientDob: "1990-01-01" });

    await request(app.getHttpServer())
      .put(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: NOTE });

    await request(app.getHttpServer())
      .post(`/encounters/${created.body.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: NOTE });

    const draftRow = await pool.query("SELECT * FROM drafts WHERE encounter_id = $1", [created.body.id]);
    expect(draftRow.rows).toHaveLength(0);

    const getResponse = await request(app.getHttpServer())
      .get(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${token}`);
    expect(getResponse.body.note).toBeNull();

    // The permanent version must exist and be unaffected by draft clearing.
    const versionRow = await pool.query("SELECT * FROM note_versions WHERE encounter_id = $1", [created.body.id]);
    expect(versionRow.rows).toHaveLength(1);
  });
});
