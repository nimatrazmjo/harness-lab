import * as http from "http";
import { INestApplication } from "@nestjs/common";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";
import request from "supertest";

interface SseEvent {
  raw: string;
  receivedAt: number;
}

function postSse(port: number, path: string, token: string): Promise<SseEvent[]> {
  return new Promise((resolve, reject) => {
    const events: SseEvent[] = [];
    const req = http.request(
      { host: "127.0.0.1", port, path, method: "POST", headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        res.on("data", (chunk) => {
          events.push({ raw: chunk.toString(), receivedAt: Date.now() });
        });
        res.on("end", () => resolve(events));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("Scribe: SSE generation stream", () => {
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
      .send({ patientFirstName: "Test", patientLastName: "Patient", patientDob: "1980-01-01" });
    await request(app.getHttpServer())
      .patch(`/encounters/${created.body.id}/input`)
      .set("Authorization", `Bearer ${token}`)
      .send({ transcript });
    return { encounterId: created.body.id as string, token };
  }

  it("streams multiple SSE chunks over time, not one blob", async () => {
    const { encounterId, token } = await setUpEncounterWithTranscript(
      "Patient reports lower back pain for 3 days, worse with movement. Denies numbness. Exam shows tenderness at L4-L5.",
    );

    const events = await postSse(port, `/encounters/${encounterId}/scribe/generate`, token);
    expect(events.length).toBeGreaterThan(1);

    const timestamps = events.map((e) => e.receivedAt);
    const spread = timestamps[timestamps.length - 1] - timestamps[0];
    expect(spread).toBeGreaterThan(0);

    const frames = events.map((e) => e.raw).join("").split("\n\n").filter(Boolean);
    expect(frames.length).toBeGreaterThan(1);
    const done = frames.find((f) => f.includes('"type":"done"'));
    expect(done).toBeTruthy();
  });

  it("responds with SSE content-type headers", async () => {
    const { encounterId, token } = await setUpEncounterWithTranscript(
      "Patient reports sore throat and mild fever since yesterday.",
    );
    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path: `/encounters/${encounterId}/scribe/generate`,
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
        (res) => {
          res.resume();
          resolve(res);
        },
      );
      req.on("error", reject);
      req.end();
    });
    expect(response.headers["content-type"]).toContain("text/event-stream");
  });
});
