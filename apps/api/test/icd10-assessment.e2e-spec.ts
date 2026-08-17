import * as http from "http";
import { INestApplication } from "@nestjs/common";
import { MockEmbeddingClient } from "@scribe/ai";
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

async function toVectorLiteral(text: string): Promise<string> {
  const embedder = new MockEmbeddingClient(1024);
  const vec = await embedder.embed(text);
  return `[${vec.join(",")}]`;
}

describe("Scribe: ICD-10 codes in the assessment", () => {
  let app: INestApplication;
  let pool: Pool;
  let port: number;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
    await app.listen(0);
    port = (app.getHttpServer().address() as { port: number }).port;

    // Seed a small ICD-10 candidate set directly (independent of tools/icd10-embed.ts)
    // so this test doesn't depend on the full embedding job having been run.
    const codes = [
      { code: "M54.5", description: "Low back pain" },
      { code: "J02.9", description: "Acute pharyngitis, unspecified" },
      { code: "M25.561", description: "Pain in right knee" },
    ];
    for (const c of codes) {
      const vector = await toVectorLiteral(`${c.code} ${c.description}`);
      await pool.query(
        `INSERT INTO icd10_codes (code, description, embedding) VALUES ($1, $2, $3::vector)
         ON CONFLICT (code) DO UPDATE SET embedding = EXCLUDED.embedding`,
        [c.code, c.description, vector],
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it("includes at least one real, semantically relevant ICD-10 code, never fabricated", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Lena", patientLastName: "Cross", patientDob: "1991-02-02" });
    await request(app.getHttpServer())
      .patch(`/encounters/${created.body.id}/input`)
      .set("Authorization", `Bearer ${token}`)
      .send({ transcript: "Patient reports low back pain radiating down the leg for one week, worse with sitting." });

    const done = await postSseCollectDone(port, `/encounters/${created.body.id}/scribe/generate`, token);
    const codes: { code: string; description: string }[] = done.note.icd10Codes;

    expect(codes.length).toBeGreaterThanOrEqual(1);
    expect(codes[0].code).toBe("M54.5");

    // No fabrication: every returned code must exist in the DB's embedded set.
    const dbCodes = await pool.query("SELECT code FROM icd10_codes");
    const validCodes = new Set(dbCodes.rows.map((r) => r.code));
    for (const c of codes) expect(validCodes.has(c.code)).toBe(true);
  });
});
