import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as argon2 from "argon2";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { AppModule } from "../src/app.module";
import { PG_POOL } from "../src/database/database.module";

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

export function getPool(app: INestApplication): Pool {
  return app.get<Pool>(PG_POOL);
}

export interface TestProvider {
  id: string;
  email: string;
  password: string;
  role: "provider" | "admin";
}

export async function createTestProvider(
  pool: Pool,
  role: "provider" | "admin" = "provider",
  overrides: Partial<{ isActive: boolean }> = {},
): Promise<TestProvider> {
  const email = `test-${uuid()}@example.dev`;
  const password = "test-password-123";
  const passwordHash = await argon2.hash(password);
  const result = await pool.query<{ id: string }>(
    `INSERT INTO providers (email, password_hash, name, role, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [email, passwordHash, "Test Provider", role, overrides.isActive ?? true],
  );
  return { id: result.rows[0].id, email, password, role };
}

export async function loginTestProvider(app: INestApplication, provider: TestProvider): Promise<string> {
  const request = (await import("supertest")).default;
  const response = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email: provider.email, password: provider.password });
  if (response.status !== 201 && response.status !== 200) {
    throw new Error(`Login failed for test provider: ${JSON.stringify(response.body)}`);
  }
  return response.body.accessToken;
}

export async function createTestTemplate(
  pool: Pool,
  overrides: Partial<{ name: string; encounterType: string; promptInstructions: string }> = {},
): Promise<{ id: string }> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO templates (name, encounter_type, prompt_instructions) VALUES ($1, $2, $3) RETURNING id`,
    [
      overrides.name ?? `Test Template ${uuid()}`,
      overrides.encounterType ?? "test_type",
      overrides.promptInstructions ?? "Be concise.",
    ],
  );
  return { id: result.rows[0].id };
}
