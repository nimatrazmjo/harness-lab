import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

describe("Auth: roles", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("admin can reach an admin-only surface", async () => {
    const admin = await createTestProvider(pool, "admin");
    const token = await loginTestProvider(app, admin);
    const response = await request(app.getHttpServer()).get("/admin/ping").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, role: "admin" });
  });

  it("a provider is denied the admin-only surface", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const response = await request(app.getHttpServer()).get("/admin/ping").set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(403);
  });

  it("JWT carries the correct role claim for each account type", async () => {
    const provider = await createTestProvider(pool, "provider");
    const admin = await createTestProvider(pool, "admin");
    const providerToken = await loginTestProvider(app, provider);
    const adminToken = await loginTestProvider(app, admin);

    const decode = (t: string) => JSON.parse(Buffer.from(t.split(".")[1], "base64url").toString());
    expect(decode(providerToken).role).toBe("provider");
    expect(decode(adminToken).role).toBe("admin");
  });
});
