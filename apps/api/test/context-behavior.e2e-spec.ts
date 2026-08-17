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
 * Proves context.behavior_differs: a returning patient's generation is demonstrably
 * different from a first-time patient's, because prior history was injected via the
 * backend tool call in ScribeService (never from the client — see context-injection.e2e-spec.ts).
 */
describe("Scribe: returning vs first-time patient behavior differs", () => {
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

  async function createEncounterWithTranscript(token: string, patient: object, transcript: string) {
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send(patient);
    await request(app.getHttpServer())
      .patch(`/encounters/${created.body.id}/input`)
      .set("Authorization", `Bearer ${token}`)
      .send({ transcript });
    return created.body.id as string;
  }

  it("returning patient's Plan references prior visit; first-time patient's does not", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const returningPatient = { patientFirstName: "Return", patientLastName: "Ing", patientDob: "1982-02-02" };

    // First encounter for this patient: generate + save a note (establishes history).
    const firstEncounterId = await createEncounterWithTranscript(
      token,
      returningPatient,
      "Patient reports right knee pain after a fall while running. Exam shows tenderness and swelling over the right knee.",
    );
    const firstDone = await postSseCollectDone(port, `/encounters/${firstEncounterId}/scribe/generate`, token);
    const saveResponse = await request(app.getHttpServer())
      .post(`/encounters/${firstEncounterId}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ note: firstDone.note });
    const firstVisitDate = new Date(saveResponse.body.createdAt).toISOString().slice(0, 10);
    const firstVisitPlan = firstDone.note.plan;

    // Second encounter for the SAME patient: generation should now be history-informed.
    const secondEncounterId = await createEncounterWithTranscript(
      token,
      returningPatient,
      "Patient returns for follow-up of the right knee injury, reports mild improvement.",
    );
    const secondDone = await postSseCollectDone(port, `/encounters/${secondEncounterId}/scribe/generate`, token);

    expect(secondDone.note.plan).toContain("continuing management per prior visit");
    expect(secondDone.note.plan).toContain(firstVisitDate);
    expect(secondDone.note.plan).toContain(firstVisitPlan);

    // A first-time patient generating in the same test run should show NO such reference.
    const firstTimeEncounterId = await createEncounterWithTranscript(
      token,
      { patientFirstName: "NeverSeen", patientLastName: "Before", patientDob: "2001-01-01" },
      "Patient reports right knee pain after a fall while running. Exam shows tenderness and swelling over the right knee.",
    );
    const firstTimeDone = await postSseCollectDone(port, `/encounters/${firstTimeEncounterId}/scribe/generate`, token);

    expect(firstTimeDone.note.plan).not.toContain("continuing management per prior visit");
  });
});
