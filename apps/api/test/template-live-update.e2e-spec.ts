import * as http from "http";
import { INestApplication } from "@nestjs/common";
import { Pool } from "pg";
import request from "supertest";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

function postSseCollectDone(port: number, path: string, token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const req = http.request(
      { host: "127.0.0.1", port, path, method: "POST", headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        res.on("data", (chunk) => (buffer += chunk.toString()));
        res.on("end", () => {
          const frames = buffer.split("\n\n").filter(Boolean);
          const doneFrame = frames.find((f) => f.includes('"type":"done"'));
          if (!doneFrame) return reject(new Error("no done frame received"));
          resolve(JSON.parse(doneFrame.replace(/^data: /, "")));
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * Proves admin.template_live_update: no page refresh, no cache to bust — the template is
 * read fresh from RDS on every single generation call (TemplatesRepository.findById has
 * no caching layer), so an admin's edit takes effect on the provider's very next generation,
 * same encounter, same open workspace, no new request beyond "click generate again."
 */
describe("Admin: live template update takes effect without a refresh", () => {
  let app: INestApplication;
  let pool: Pool;
  let port: number;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
    await app.listen(0);
    port = (app.getHttpServer().address() as { port: number }).port;
  });

  afterAll(async () => {
    await app.close();
  });

  it("editing a template mid-session changes the very next generation on the same encounter", async () => {
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const template = await request(app.getHttpServer())
      .post("/templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "Live Update Test", encounterType: "test_type", promptInstructions: "Original instructions v1." });
    const templateId = template.body.id as string;

    const encounter = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Live", patientLastName: "Update", patientDob: "1990-01-01", templateId });
    await request(app.getHttpServer())
      .patch(`/encounters/${encounter.body.id}/input`)
      .set("Authorization", `Bearer ${token}`)
      .send({ transcript: "Patient reports intermittent wrist pain for two weeks.", templateId });

    const firstGeneration = await postSseCollectDone(port, `/encounters/${encounter.body.id}/scribe/generate`, token);
    expect(firstGeneration.note.plan).toContain("Original instructions v1.");

    // Admin edits the SAME template — no new template, no encounter change, no page refresh.
    const updated = await request(app.getHttpServer())
      .patch(`/templates/${templateId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ promptInstructions: "REVISED instructions v2 — now with different guidance." });
    expect(updated.status).toBe(200);

    // Provider clicks Generate again on the SAME open encounter.
    const secondGeneration = await postSseCollectDone(port, `/encounters/${encounter.body.id}/scribe/generate`, token);

    expect(secondGeneration.note.plan).toContain("REVISED instructions v2");
    expect(secondGeneration.note.plan).not.toContain("Original instructions v1.");
  });

  it("deactivating (soft-deleting) a template does not retroactively change what a provider already generated", async () => {
    // Regression guard: live-update must not mean "re-render history" — only future generations change.
    const admin = await createTestProvider(pool, "admin");
    const adminToken = await loginTestProvider(app, admin);
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const template = await request(app.getHttpServer())
      .post("/templates")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ name: "History Immutable Test", encounterType: "test_type", promptInstructions: "Instructions at save time." });
    const templateId = template.body.id as string;

    const encounter = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "History", patientLastName: "Immutable", patientDob: "1990-01-01", templateId });
    await request(app.getHttpServer())
      .patch(`/encounters/${encounter.body.id}/input`)
      .set("Authorization", `Bearer ${token}`)
      .send({ transcript: "Patient reports elbow pain after lifting.", templateId });

    const generated = await postSseCollectDone(port, `/encounters/${encounter.body.id}/scribe/generate`, token);
    const saved = await request(app.getHttpServer())
      .post(`/encounters/${encounter.body.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: generated.note });

    await request(app.getHttpServer())
      .patch(`/templates/${templateId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ promptInstructions: "Completely different instructions after save." });

    const historyRow = await pool.query("SELECT plan FROM note_versions WHERE id = $1", [saved.body.id]);
    expect(historyRow.rows[0].plan).toContain("Instructions at save time.");
    expect(historyRow.rows[0].plan).not.toContain("Completely different instructions after save.");
  });
});
