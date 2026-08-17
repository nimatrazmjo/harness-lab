import * as http from "http";
import { INestApplication } from "@nestjs/common";
import { Pool } from "pg";
import request from "supertest";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

function postSseCollectAll(port: number, path: string, token: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const req = http.request(
      { host: "127.0.0.1", port, path, method: "POST", headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        res.on("data", (chunk) => (buffer += chunk.toString()));
        res.on("end", () => resolve(buffer));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

/**
 * Live HTTP-level coverage for the SSE generation endpoint's clinical-safety gate —
 * complements libs/ai's unit test on hasClinicalContent() by proving the same behavior
 * end to end through the real controller/service/DB path (AGENTS.md [CLINICAL-SAFETY]).
 */
describe("Scribe: no fabricated note on empty/garbage clinical input", () => {
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

  async function setUpEncounterWithTranscript(transcript: string) {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Edge", patientLastName: "Case", patientDob: "2000-01-01" });
    await request(app.getHttpServer())
      .patch(`/encounters/${created.body.id}/input`)
      .set("Authorization", `Bearer ${token}`)
      .send({ transcript });
    return { encounterId: created.body.id as string, token };
  }

  it("empty transcript yields only an insufficient_content event, no fabricated note", async () => {
    const { encounterId, token } = await setUpEncounterWithTranscript(" ");
    const body = await postSseCollectAll(port, `/encounters/${encounterId}/scribe/generate`, token);
    const frames = body.split("\n\n").filter(Boolean);

    expect(frames).toHaveLength(1);
    expect(frames[0]).toContain('"type":"insufficient_content"');
    expect(body).not.toContain('"type":"done"');
    expect(body).not.toContain('"type":"token"');

    const encounterRow = await pool.query("SELECT status FROM encounters WHERE id = $1", [encounterId]);
    expect(encounterRow.rows[0].status).toBe("draft");
  });

  it("keyboard-mash garbage transcript yields only insufficient_content, no fabricated note", async () => {
    const { encounterId, token } = await setUpEncounterWithTranscript("asdfasdfasdf asdfasdfasdf");
    const body = await postSseCollectAll(port, `/encounters/${encounterId}/scribe/generate`, token);

    expect(body).toContain('"type":"insufficient_content"');
    expect(body).not.toContain('"type":"done"');

    const noteRows = await pool.query("SELECT * FROM note_versions WHERE encounter_id = $1", [encounterId]);
    expect(noteRows.rows).toHaveLength(0);
  });
});
