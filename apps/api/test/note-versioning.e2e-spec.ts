import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

function note(overrides: Partial<{ subjective: string }> = {}) {
  return {
    subjective: overrides.subjective ?? "v1 subjective",
    objective: "objective text",
    assessment: "assessment text",
    plan: "plan text",
    icd10Codes: [],
  };
}

describe("Note versioning (immutable) + history", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("re-saving INSERTs a new version; version 1 stays byte-for-byte unchanged", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Omar", patientLastName: "Haddad", patientDob: "1978-09-09" });
    const encounterId = created.body.id;

    const v1 = await request(app.getHttpServer())
      .post(`/encounters/${encounterId}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: note({ subjective: "version one text" }) });
    expect(v1.body.versionNumber).toBe(1);

    const v2 = await request(app.getHttpServer())
      .post(`/encounters/${encounterId}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: note({ subjective: "version two text, edited" }) });
    expect(v2.body.versionNumber).toBe(2);

    const rows = await pool.query(
      "SELECT version_number, subjective FROM note_versions WHERE encounter_id = $1 ORDER BY version_number",
      [encounterId],
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0]).toMatchObject({ version_number: 1, subjective: "version one text" });
    expect(rows.rows[1]).toMatchObject({ version_number: 2, subjective: "version two text, edited" });
  });

  it("version history lists every version with author + timestamp, read from RDS", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Priya", patientLastName: "Rao", patientDob: "1996-12-01" });
    const encounterId = created.body.id;

    await request(app.getHttpServer())
      .post(`/encounters/${encounterId}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: note({ subjective: "first save" }) });
    await request(app.getHttpServer())
      .post(`/encounters/${encounterId}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: note({ subjective: "second save" }) });

    const history = await request(app.getHttpServer())
      .get(`/encounters/${encounterId}/notes`)
      .set("Authorization", `Bearer ${token}`);

    expect(history.status).toBe(200);
    expect(history.body).toHaveLength(2);
    for (const version of history.body) {
      expect(version.authorId).toBe(provider.id);
      expect(version.authorName).toBeTruthy();
      expect(new Date(version.createdAt).getTime()).not.toBeNaN();
    }
    expect(history.body[0].note.subjective).toBe("first save");
    expect(history.body[1].note.subjective).toBe("second save");
  });

  it("concurrent saves on the same encounter never collide on version_number", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Concurrent", patientLastName: "Saver", patientDob: "2000-01-01" });
    const encounterId = created.body.id;

    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        request(app.getHttpServer())
          .post(`/encounters/${encounterId}/notes`)
          .set("Authorization", `Bearer ${token}`)
          .send({ note: note({ subjective: `concurrent save ${i}` }) }),
      ),
    );

    const rows = await pool.query("SELECT version_number FROM note_versions WHERE encounter_id = $1", [encounterId]);
    const versionNumbers = rows.rows.map((r) => r.version_number).sort((a, b) => a - b);
    expect(versionNumbers).toEqual([1, 2, 3, 4, 5]);
  });
});
