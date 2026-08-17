import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool } from "./test-app";

describe("Auth: login", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("issues a JWT with an expiry for correct credentials", async () => {
    const provider = await createTestProvider(pool, "provider");
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: provider.email, password: provider.password });

    expect(response.status).toBe(201);
    expect(typeof response.body.accessToken).toBe("string");
    expect(response.body.user.role).toBe("provider");
    expect(new Date(response.body.expiresAt).getTime()).toBeGreaterThan(Date.now());

    const payload = JSON.parse(Buffer.from(response.body.accessToken.split(".")[1], "base64url").toString());
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("rejects an incorrect password", async () => {
    const provider = await createTestProvider(pool, "provider");
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: provider.email, password: "wrong-password" });
    expect(response.status).toBe(401);
  });

  it("rejects a deactivated provider", async () => {
    const provider = await createTestProvider(pool, "provider", { isActive: false });
    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: provider.email, password: provider.password });
    expect(response.status).toBe(401);
  });

  it("never stores the password in plaintext", async () => {
    const provider = await createTestProvider(pool, "provider");
    const row = await pool.query("SELECT password_hash FROM providers WHERE id = $1", [provider.id]);
    expect(row.rows[0].password_hash).not.toBe(provider.password);
    expect(row.rows[0].password_hash).toMatch(/^\$argon2/);
  });

  it("rejects requests without a token on a protected route", async () => {
    const response = await request(app.getHttpServer()).get("/encounters");
    expect(response.status).toBe(401);
  });
});
