import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

describe("Admin: role-gated guard on /admin/*", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows an admin through", async () => {
    const admin = await createTestProvider(pool, "admin");
    const token = await loginTestProvider(app, admin);

    const response = await request(app.getHttpServer())
      .get("/admin/ping")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, role: "admin" });
  });

  it("blocks a non-admin provider with 403", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const response = await request(app.getHttpServer())
      .get("/admin/ping")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it("blocks an unauthenticated request with 401", async () => {
    const response = await request(app.getHttpServer()).get("/admin/ping");

    expect(response.status).toBe(401);
  });
});
