import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

describe("Tenant isolation", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("Provider B requesting Provider A's encounter gets 403", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const providerB = await createTestProvider(pool, "provider");
    const tokenA = await loginTestProvider(app, providerA);
    const tokenB = await loginTestProvider(app, providerB);

    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ patientFirstName: "Jane", patientLastName: "Doe", patientDob: "1990-01-01" });
    expect(created.status).toBe(201);

    const asOwner = await request(app.getHttpServer())
      .get(`/encounters/${created.body.id}`)
      .set("Authorization", `Bearer ${tokenA}`);
    expect(asOwner.status).toBe(200);

    const asOther = await request(app.getHttpServer())
      .get(`/encounters/${created.body.id}`)
      .set("Authorization", `Bearer ${tokenB}`);
    expect(asOther.status).toBe(403);

    const patchAsOther = await request(app.getHttpServer())
      .patch(`/encounters/${created.body.id}/input`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ transcript: "malicious edit attempt" });
    expect(patchAsOther.status).toBe(403);
  });

  it("Admin can access any provider's encounter through the admin bypass", async () => {
    const provider = await createTestProvider(pool, "provider");
    const admin = await createTestProvider(pool, "admin");
    const providerToken = await loginTestProvider(app, provider);
    const adminToken = await loginTestProvider(app, admin);

    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${providerToken}`)
      .send({ patientFirstName: "John", patientLastName: "Smith", patientDob: "1985-05-05" });

    const asAdmin = await request(app.getHttpServer())
      .get(`/encounters/${created.body.id}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(asAdmin.status).toBe(200);
  });

  it("a provider's encounter list never includes another provider's encounters", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const providerB = await createTestProvider(pool, "provider");
    const tokenA = await loginTestProvider(app, providerA);
    const tokenB = await loginTestProvider(app, providerB);

    await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ patientFirstName: "A", patientLastName: "Patient", patientDob: "1970-01-01" });

    const listB = await request(app.getHttpServer()).get("/encounters").set("Authorization", `Bearer ${tokenB}`);
    expect(listB.status).toBe(200);
    expect(listB.body.every((e: { providerId: string }) => e.providerId === providerB.id)).toBe(true);
  });
});
