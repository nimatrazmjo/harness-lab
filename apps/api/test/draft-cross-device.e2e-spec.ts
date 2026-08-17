import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

const NOTE = {
  subjective: "Cross-device subjective.",
  objective: "Cross-device objective.",
  assessment: "Cross-device assessment.",
  plan: "Cross-device plan.",
  icd10Codes: [],
};

/**
 * Proves session.cross_device: draft state is keyed to (encounter_id, provider_id) in RDS,
 * not to a browser/localStorage. A second login (simulating a different browser/device for
 * the same provider) sees the identical draft with no shared client-side state whatsoever.
 */
describe("Draft persistence: cross-device", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("a different login session for the same provider sees the identical draft", async () => {
    const provider = await createTestProvider(pool, "provider");
    const deviceOneToken = await loginTestProvider(app, provider);

    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${deviceOneToken}`)
      .send({ patientFirstName: "Cross", patientLastName: "Device", patientDob: "1990-01-01" });

    await request(app.getHttpServer())
      .put(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${deviceOneToken}`)
      .send({ note: NOTE });

    // Simulate opening the app on a different device: a completely independent login flow,
    // zero shared browser/localStorage state with "device one" (the token string itself may
    // coincidentally match if both logins land in the same second — JWTs are deterministic
    // for identical claims + iat — so the test proves state-sharing via RDS, not token bytes).
    const deviceTwoToken = await loginTestProvider(app, provider);

    const response = await request(app.getHttpServer())
      .get(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${deviceTwoToken}`);

    expect(response.status).toBe(200);
    expect(response.body.note).toEqual(NOTE);
  });

  it("an edit made on 'device two' is visible back on 'device one' on next fetch", async () => {
    const provider = await createTestProvider(pool, "provider");
    const deviceOneToken = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${deviceOneToken}`)
      .send({ patientFirstName: "Bidirectional", patientLastName: "Sync", patientDob: "1990-01-01" });

    await request(app.getHttpServer())
      .put(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${deviceOneToken}`)
      .send({ note: NOTE });

    const deviceTwoToken = await loginTestProvider(app, provider);
    await request(app.getHttpServer())
      .put(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${deviceTwoToken}`)
      .send({ note: { ...NOTE, plan: "Edited from device two." } });

    const backOnDeviceOne = await request(app.getHttpServer())
      .get(`/encounters/${created.body.id}/draft`)
      .set("Authorization", `Bearer ${deviceOneToken}`);

    expect(backOnDeviceOne.body.note.plan).toBe("Edited from device two.");
  });
});
