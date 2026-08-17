import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./test-app";

describe("GET /health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reads through the shared pg pool (proves RDS/Postgres is the live store)", async () => {
    const response = await request(app.getHttpServer()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", db: true });
  });
});
