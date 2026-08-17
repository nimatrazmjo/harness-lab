import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

describe("Pioneer: clinical red-flag flagging", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createEncounterWithTranscript(token: string, transcript: string) {
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "RedFlag", patientLastName: "Test", patientDob: "1990-01-01" });
    await request(app.getHttpServer())
      .patch(`/encounters/${created.body.id}/input`)
      .set("Authorization", `Bearer ${token}`)
      .send({ transcript });
    return created.body.id as string;
  }

  it("surfaces a red flag present in the transcript, before generation", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const encounterId = await createEncounterWithTranscript(
      token,
      "Patient reports the worst headache of his life, sudden onset one hour ago.",
    );

    const response = await request(app.getHttpServer())
      .get(`/encounters/${encounterId}/red-flags`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.map((f: { id: string }) => f.id)).toContain("worst-headache");

    // No generation happened — this is purely advisory, computed independently.
    const encounterRow = await pool.query("SELECT status FROM encounters WHERE id = $1", [encounterId]);
    expect(encounterRow.rows[0].status).toBe("draft");
  });

  it("returns an empty list for a transcript with no red flags", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const encounterId = await createEncounterWithTranscript(
      token,
      "Patient reports mild sore throat for two days. Denies fever. Exam unremarkable.",
    );

    const response = await request(app.getHttpServer())
      .get(`/encounters/${encounterId}/red-flags`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("returns every distinct red flag present, not just the first", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const encounterId = await createEncounterWithTranscript(
      token,
      "Patient reports chest pain radiating to the jaw and had a seizure this morning.",
    );

    const response = await request(app.getHttpServer())
      .get(`/encounters/${encounterId}/red-flags`)
      .set("Authorization", `Bearer ${token}`);

    const ids = response.body.map((f: { id: string }) => f.id);
    expect(ids).toContain("chest-pain-radiating");
    expect(ids).toContain("seizure");
  });

  it("a provider cannot read red flags for another provider's encounter", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const providerB = await createTestProvider(pool, "provider");
    const tokenA = await loginTestProvider(app, providerA);
    const tokenB = await loginTestProvider(app, providerB);
    const encounterId = await createEncounterWithTranscript(tokenA, "Patient reports a seizure.");

    const response = await request(app.getHttpServer())
      .get(`/encounters/${encounterId}/red-flags`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(response.status).toBe(403);
  });

  it("requires authentication", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const encounterId = await createEncounterWithTranscript(token, "Patient reports a seizure.");

    const response = await request(app.getHttpServer()).get(`/encounters/${encounterId}/red-flags`);
    expect(response.status).toBe(401);
  });
});
