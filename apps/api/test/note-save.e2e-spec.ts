import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

const SAMPLE_NOTE = {
  subjective: "Patient reports low back pain for 3 days.",
  objective: "Tenderness at L4-L5, normal reflexes.",
  assessment: "Low back pain (M54.5).",
  plan: "NSAIDs, follow up in 2 weeks if not improved.",
  icd10Codes: [{ code: "M54.5", description: "Low back pain" }],
};

describe("Note save", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("saves the finalized note to RDS, tied to the encounter and provider", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Nia", patientLastName: "Okafor", patientDob: "1993-08-08" });

    const saved = await request(app.getHttpServer())
      .post(`/encounters/${created.body.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: SAMPLE_NOTE });

    expect(saved.status).toBe(201);
    expect(saved.body.encounterId).toBe(created.body.id);
    expect(saved.body.authorId).toBe(provider.id);
    expect(saved.body.versionNumber).toBe(1);

    const row = await pool.query("SELECT * FROM note_versions WHERE id = $1", [saved.body.id]);
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].subjective).toBe(SAMPLE_NOTE.subjective);

    const encounterRow = await pool.query("SELECT status FROM encounters WHERE id = $1", [created.body.id]);
    expect(encounterRow.rows[0].status).toBe("saved");
  });

  it("another provider cannot save a note to someone else's encounter", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const providerB = await createTestProvider(pool, "provider");
    const tokenA = await loginTestProvider(app, providerA);
    const tokenB = await loginTestProvider(app, providerB);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ patientFirstName: "Iris", patientLastName: "Wong", patientDob: "1982-04-04" });

    const response = await request(app.getHttpServer())
      .post(`/encounters/${created.body.id}/notes`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ note: SAMPLE_NOTE });
    expect(response.status).toBe(403);
  });
});
