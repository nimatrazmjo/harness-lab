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

describe("Scribe: structured SOAP output", () => {
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

  it("includes all four SOAP sections, populated from the transcript content", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Sam", patientLastName: "Rivera", patientDob: "1995-06-10" });
    await request(app.getHttpServer())
      .patch(`/encounters/${created.body.id}/input`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        transcript:
          "Patient reports right knee pain after a fall while running. Denies locking. Exam: swelling and tenderness over the right knee, positive McMurray test.",
      });

    const done = await postSseCollectDone(port, `/encounters/${created.body.id}/scribe/generate`, token);
    const note = done.note;

    expect(note.subjective.length).toBeGreaterThan(0);
    expect(note.objective.length).toBeGreaterThan(0);
    expect(note.assessment.length).toBeGreaterThan(0);
    expect(note.plan.length).toBeGreaterThan(0);

    expect(note.subjective.toLowerCase()).toContain("knee");
  });
});
