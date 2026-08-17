import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

describe("Patient matching", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("links a returning patient (same first+last+DOB) to the same patient record", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const patient = { patientFirstName: "Wendell", patientLastName: "Okafor", patientDob: "1979-03-15" };

    const first = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send(patient);
    const second = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send(patient);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.patientId).toBe(first.body.patientId);
    expect(second.body.id).not.toBe(first.body.id); // distinct encounters, same patient

    const patientRows = await pool.query("SELECT id FROM patients WHERE first_name = $1 AND last_name = $2 AND dob = $3", [
      patient.patientFirstName,
      patient.patientLastName,
      patient.patientDob,
    ]);
    expect(patientRows.rows).toHaveLength(1);
  });

  it("creates a distinct patient record for a first-time patient", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const a = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Unique", patientLastName: "PersonA", patientDob: "1990-01-01" });
    const b = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Unique", patientLastName: "PersonB", patientDob: "1990-01-01" });

    expect(a.body.patientId).not.toBe(b.body.patientId);
  });

  it("does NOT merge two same-name patients with different DOBs", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const a = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Sam", patientLastName: "Twin", patientDob: "1985-06-01" });
    const b = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Sam", patientLastName: "Twin", patientDob: "1992-11-20" });

    expect(a.body.patientId).not.toBe(b.body.patientId);
  });

  it("matches a returning patient even when seen by a different provider (shared patient identity)", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const providerB = await createTestProvider(pool, "provider");
    const tokenA = await loginTestProvider(app, providerA);
    const tokenB = await loginTestProvider(app, providerB);
    const patient = { patientFirstName: "Cross", patientLastName: "Provider", patientDob: "1988-08-08" };

    const seenByA = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${tokenA}`)
      .send(patient);
    const seenByB = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${tokenB}`)
      .send(patient);

    expect(seenByB.body.patientId).toBe(seenByA.body.patientId);
  });
});
