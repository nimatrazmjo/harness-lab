import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

describe("Encounter creation", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates an encounter linked to the authenticated provider and a patient record, persisted in RDS", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const response = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Alice", patientLastName: "Nguyen", patientDob: "1992-03-14" });

    expect(response.status).toBe(201);
    expect(response.body.providerId).toBe(provider.id);
    expect(response.body.status).toBe("draft");

    const row = await pool.query("SELECT * FROM encounters WHERE id = $1", [response.body.id]);
    expect(row.rows).toHaveLength(1);

    const patient = await pool.query("SELECT * FROM patients WHERE id = $1", [row.rows[0].patient_id]);
    expect(patient.rows[0]).toMatchObject({ first_name: "Alice", last_name: "Nguyen" });
  });

  it("dedupes the patient record for the same first+last+DOB", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const patient = { patientFirstName: "Bob", patientLastName: "Lee", patientDob: "1988-07-01" };

    const first = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send(patient);
    const second = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send(patient);

    expect(first.body.patientId).toBe(second.body.patientId);
  });

  it("accepts pasted transcript / freeform input on the open encounter", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Cara", patientLastName: "Diaz", patientDob: "1975-11-20" });

    const updated = await request(app.getHttpServer())
      .patch(`/encounters/${created.body.id}/input`)
      .set("Authorization", `Bearer ${token}`)
      .send({ transcript: "Patient reports headache for two days, denies fever." });

    expect(updated.status).toBe(200);
    expect(updated.body.transcript).toContain("headache");
  });

  it("rejects malformed input (missing required fields)", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const response = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "OnlyFirst" });
    expect(response.status).toBe(400);
  });
});
