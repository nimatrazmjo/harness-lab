import * as http from "http";
import { INestApplication } from "@nestjs/common";
import { Pool } from "pg";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";
import request from "supertest";

interface SseEvent {
  raw: string;
}

function postSse(port: number, path: string, token: string): Promise<SseEvent[]> {
  return new Promise((resolve, reject) => {
    const events: SseEvent[] = [];
    const req = http.request(
      { host: "127.0.0.1", port, path, method: "POST", headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        res.on("data", (chunk) => events.push({ raw: chunk.toString() }));
        res.on("end", () => resolve(events));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function generatedNote(port: number, encounterId: string, token: string) {
  const events = await postSse(port, `/encounters/${encounterId}/scribe/generate`, token);
  const frames = events
    .map((e) => e.raw)
    .join("")
    .split("\n\n")
    .filter(Boolean);
  const doneFrame = frames.find((f) => f.includes('"type":"done"'));
  const parsed = JSON.parse(doneFrame!.replace(/^data: /, ""));
  return parsed.note as { subjective: string; objective: string; assessment: string; plan: string };
}

const TRANSCRIPT = "Patient reports mild knee pain for one week. Denies swelling or instability.";

describe("Pioneer: provider writing-style learning", () => {
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

  async function newEncounter(token: string, transcript: string) {
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send({ patientFirstName: "Style", patientLastName: "Test", patientDob: "1990-01-01" });
    await request(app.getHttpServer())
      .patch(`/encounters/${created.body.id}/input`)
      .set("Authorization", `Bearer ${token}`)
      .send({ transcript });
    return created.body.id as string;
  }

  async function saveNote(token: string, encounterId: string, subjective: string, plan: string) {
    await request(app.getHttpServer())
      .post(`/encounters/${encounterId}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        note: {
          subjective,
          objective: "unremarkable",
          assessment: "assessment pending",
          plan,
          icd10Codes: [],
        },
      });
  }

  it("generates with the unadapted default for a provider with no saved history", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const encounterId = await newEncounter(token, TRANSCRIPT);

    const note = await generatedNote(port, encounterId, token);
    expect(note.subjective).toContain("Patient reports");
    expect(note.subjective).not.toContain("Pt reports");
  });

  it("adapts to 'Pt' once a provider's own saved history clearly and repeatedly favors it, then reverts to default for a fresh provider", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const tokenA = await loginTestProvider(app, providerA);
    const historyEncounterId = await newEncounter(tokenA, TRANSCRIPT);

    // Three real saves (real version-increment path, not a direct DB insert) with a clear,
    // repeated "pt" preference.
    await saveNote(tokenA, historyEncounterId, "Pt reports symptoms.", "Pt advised to follow up.");
    await saveNote(tokenA, historyEncounterId, "Pt denies fever.", "Pt tolerating current plan.");
    await saveNote(tokenA, historyEncounterId, "Pt ambulatory without issue.", "Pt to return prn.");

    const newEncounterId = await newEncounter(tokenA, TRANSCRIPT);
    const note = await generatedNote(port, newEncounterId, tokenA);
    expect(note.subjective).toContain("Pt reports");
    expect(note.subjective).not.toContain("Patient reports");

    // A different, fresh provider is unaffected by provider A's learned style — style is scoped
    // to the provider's own saved history only (AGENTS.md [TENANT-ISOLATION]).
    const providerB = await createTestProvider(pool, "provider");
    const tokenB = await loginTestProvider(app, providerB);
    const encounterForB = await newEncounter(tokenB, TRANSCRIPT);
    const noteB = await generatedNote(port, encounterForB, tokenB);
    expect(noteB.subjective).toContain("Patient reports");
    expect(noteB.subjective).not.toContain("Pt reports");
  });

  it("computes the profile fresh per call — two generations for the same provider differ before vs. after their history changes", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);

    const beforeEncounterId = await newEncounter(token, TRANSCRIPT);
    const before = await generatedNote(port, beforeEncounterId, token);
    expect(before.subjective).toContain("Patient reports");

    const historyEncounterId = await newEncounter(token, TRANSCRIPT);
    await saveNote(token, historyEncounterId, "Pt reports symptoms.", "Pt advised to follow up.");
    await saveNote(token, historyEncounterId, "Pt denies fever.", "Pt tolerating current plan.");
    await saveNote(token, historyEncounterId, "Pt ambulatory without issue.", "Pt to return prn.");

    const afterEncounterId = await newEncounter(token, TRANSCRIPT);
    const after = await generatedNote(port, afterEncounterId, token);
    expect(after.subjective).toContain("Pt reports");
    expect(after.subjective).not.toContain("Patient reports");
  });

  it("does not adapt from a single edit — requires a real, repeated pattern", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const historyEncounterId = await newEncounter(token, TRANSCRIPT);
    await saveNote(token, historyEncounterId, "Pt reports symptoms.", "Patient advised to follow up.");

    const newEncounterId = await newEncounter(token, TRANSCRIPT);
    const note = await generatedNote(port, newEncounterId, token);
    expect(note.subjective).toContain("Patient reports");
  });
});
