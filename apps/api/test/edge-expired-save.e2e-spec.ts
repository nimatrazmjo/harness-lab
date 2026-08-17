import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

const NOTE = {
  subjective: "Subjective before session expired.",
  objective: "Objective before session expired.",
  assessment: "Assessment before session expired.",
  plan: "Plan not yet saved when the token expired.",
  icd10Codes: [],
};

/**
 * Proves edge.session_expired_save: real 8h JWT expiry isn't waitable in a test, so this
 * simulates it with a garbage/invalid token for the failed save attempt — the meaningful
 * claim under test is "no data loss," which only depends on the draft having been persisted
 * BEFORE the failed request, not on the exact expiry mechanism.
 */
describe("Edge case: save attempt with an expired/invalid session loses no work", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("a save with an invalid token fails cleanly, but the already-persisted draft survives and a re-authenticated request completes the save", async () => {
    const provider = await createTestProvider(pool, "provider");
    const validToken = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ patientFirstName: "Expired", patientLastName: "Session", patientDob: "1990-01-01" });

    // The provider's work is persisted continuously as they go — well before any save attempt.
    await request(app.getHttpServer())
      .put(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${validToken}`)
      .send({ note: NOTE });

    // Session "expires" — simulated with a garbage token, same effect as an expired JWT
    // signature check failing in JwtStrategy.
    const expiredOrInvalidToken = "this.is.not-a-valid-jwt";
    const failedSave = await request(app.getHttpServer())
      .post(`/encounters/${created.body.id}/notes`)
      .set("Authorization", `Bearer ${expiredOrInvalidToken}`)
      .send({ note: NOTE });
    expect(failedSave.status).toBe(401);

    // No note_versions row was written by the failed attempt.
    const versionsAfterFailure = await pool.query("SELECT * FROM note_versions WHERE encounter_id = $1", [
      created.body.id,
    ]);
    expect(versionsAfterFailure.rows).toHaveLength(0);

    // The draft is untouched — still exactly what was persisted before the failed save.
    const draftAfterFailure = await request(app.getHttpServer())
      .get(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${validToken}`);
    expect(draftAfterFailure.body.note).toEqual(NOTE);

    // Provider re-authenticates (fresh login) and completes the save using the preserved draft.
    const freshToken = await loginTestProvider(app, provider);
    const draftForSave = await request(app.getHttpServer())
      .get(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${freshToken}`);
    const completedSave = await request(app.getHttpServer())
      .post(`/encounters/${created.body.id}/notes`)
      .set("Authorization", `Bearer ${freshToken}`)
      .send({ note: draftForSave.body.note });

    expect(completedSave.status).toBe(201);
    expect(completedSave.body.note.plan).toBe(NOTE.plan);

    const versionsAfterSuccess = await pool.query("SELECT * FROM note_versions WHERE encounter_id = $1", [
      created.body.id,
    ]);
    expect(versionsAfterSuccess.rows).toHaveLength(1);
    expect(versionsAfterSuccess.rows[0].plan).toBe(NOTE.plan);
  });

  it("an expired/invalid token on a draft save is also rejected cleanly, without corrupting the existing draft", async () => {
    const provider = await createTestProvider(pool, "provider");
    const validToken = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${validToken}`)
      .send({ patientFirstName: "Draft", patientLastName: "SaveExpiry", patientDob: "1990-01-01" });

    await request(app.getHttpServer())
      .put(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${validToken}`)
      .send({ note: NOTE });

    const attemptWithBadToken = await request(app.getHttpServer())
      .put(`/encounters/${created.body.id}/draft`)
      .set("Authorization", "Bearer garbage-token")
      .send({ note: { ...NOTE, plan: "This edit must never land." } });
    expect(attemptWithBadToken.status).toBe(401);

    const draftRow = await pool.query("SELECT note_draft FROM drafts WHERE encounter_id = $1", [created.body.id]);
    expect(draftRow.rows[0].note_draft.plan).toBe(NOTE.plan);
  });
});
