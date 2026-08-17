import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { Pool } from "pg";
import { v4 as uuid } from "uuid";
import { createTestApp, createTestProvider, getPool, loginTestProvider } from "./test-app";

/**
 * Test-only helper: reassembles readable text from an uncompressed pdfkit output buffer by
 * concatenating its hex-encoded `TJ` text-run segments in document order. pdfkit splits a run at
 * built-in kerning pairs, so a plain substring search on the raw buffer misses text that spans a
 * kerning split — this reassembly sidesteps that without pulling in a PDF-parsing dependency.
 */
function extractText(pdfBuffer: Buffer): string {
  const raw = pdfBuffer.toString("latin1");
  const hexRuns = [...raw.matchAll(/<([0-9A-Fa-f]+)>/g)].map((m) => m[1]);
  return hexRuns.map((h) => Buffer.from(h, "hex").toString("latin1")).join("");
}

// A plain incrementing counter isn't globally unique across separate test-process runs — the
// dev DB isn't truncated between runs (see session-handoff.md), and `patients` dedupes by
// (first_name, last_name, dob), so a rerun could silently reuse a prior run's patient/encounters
// and break count-based assertions. A uuid suffix is unique across runs, not just within one.
function uniquePatient() {
  return { patientFirstName: "Export", patientLastName: `Test-${uuid()}`, patientDob: "1985-05-05" };
}

describe("Pioneer: bulk patient PDF export", () => {
  let app: INestApplication;
  let pool: Pool;

  beforeAll(async () => {
    app = await createTestApp();
    pool = getPool(app);
  });

  afterAll(async () => {
    await app.close();
  });

  function getPdf(patientId: string, token: string) {
    return request(app.getHttpServer())
      .get(`/patients/${patientId}/export`)
      .set("Authorization", `Bearer ${token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
  }

  async function createAndSaveEncounter(token: string, patient: ReturnType<typeof uniquePatient>, subjectiveMarker: string) {
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send(patient);
    const encounterId = created.body.id as string;
    const patientId = created.body.patientId as string;
    await request(app.getHttpServer())
      .post(`/encounters/${encounterId}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        note: {
          subjective: subjectiveMarker,
          objective: "unremarkable",
          assessment: "assessment pending",
          plan: "follow up as needed",
          icd10Codes: [],
        },
      });
    return { encounterId, patientId };
  }

  it("a provider's export contains their own saved encounter content and starts with the PDF magic bytes", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const { patientId } = await createAndSaveEncounter(token, uniquePatient(), "MARKER_PROVIDER_A_SUBJECTIVE");

    const response = await getPdf(patientId, token);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    const buffer = response.body as Buffer;
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(extractText(buffer)).toContain("MARKER_PROVIDER_A_SUBJECTIVE");
  });

  it("a provider's export never includes another provider's encounter for the same patient", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const providerB = await createTestProvider(pool, "provider");
    const tokenA = await loginTestProvider(app, providerA);
    const tokenB = await loginTestProvider(app, providerB);
    const patient = uniquePatient();

    const { patientId } = await createAndSaveEncounter(tokenA, patient, "MARKER_ISOLATION_A");
    await createAndSaveEncounter(tokenB, patient, "MARKER_ISOLATION_B");

    const responseA = await getPdf(patientId, tokenA);

    const textA = extractText(responseA.body as Buffer);
    expect(textA).toContain("MARKER_ISOLATION_A");
    expect(textA).not.toContain("MARKER_ISOLATION_B");
  });

  it("an admin's export includes every provider's encounters for the patient", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const providerB = await createTestProvider(pool, "provider");
    const admin = await createTestProvider(pool, "admin");
    const tokenA = await loginTestProvider(app, providerA);
    const tokenB = await loginTestProvider(app, providerB);
    const adminToken = await loginTestProvider(app, admin);
    const patient = uniquePatient();

    const { patientId } = await createAndSaveEncounter(tokenA, patient, "MARKER_ADMIN_SEES_A");
    await createAndSaveEncounter(tokenB, patient, "MARKER_ADMIN_SEES_B");

    const response = await getPdf(patientId, adminToken);

    const text = extractText(response.body as Buffer);
    expect(text).toContain("MARKER_ADMIN_SEES_A");
    expect(text).toContain("MARKER_ADMIN_SEES_B");
  });

  it("a provider with none of their own encounters for an existing patient gets 403", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const providerC = await createTestProvider(pool, "provider");
    const tokenA = await loginTestProvider(app, providerA);
    const tokenC = await loginTestProvider(app, providerC);
    const patient = uniquePatient();

    const { patientId } = await createAndSaveEncounter(tokenA, patient, "MARKER_403_CASE");

    const response = await request(app.getHttpServer())
      .get(`/patients/${patientId}/export`)
      .set("Authorization", `Bearer ${tokenC}`);
    expect(response.status).toBe(403);
  });

  it("an encounter with no saved note yet is listed without fabricating content", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const patient = uniquePatient();
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send(patient);
    const patientId = created.body.patientId as string;
    await request(app.getHttpServer())
      .patch(`/encounters/${created.body.id}/input`)
      .set("Authorization", `Bearer ${token}`)
      .send({ transcript: "Patient reports mild symptoms." });

    const response = await getPdf(patientId, token);

    expect(response.status).toBe(200);
    expect(extractText(response.body as Buffer)).toContain("No saved note for this encounter");
  });

  it("logs exactly one audit_logs row per export, with no transcript/PHI content in metadata", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const { patientId } = await createAndSaveEncounter(token, uniquePatient(), "MARKER_AUDIT_CASE");

    await getPdf(patientId, token);

    const rows = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'patient.bulk_pdf_export' AND actor_id = $1 AND target_id = $2",
      [provider.id, patientId],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].metadata).toEqual({ encounterCount: 1 });
    expect(JSON.stringify(rows.rows[0].metadata)).not.toContain("MARKER_AUDIT_CASE");
  });

  it("requires authentication", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const { patientId } = await createAndSaveEncounter(token, uniquePatient(), "MARKER_AUTH_CASE");

    const response = await request(app.getHttpServer()).get(`/patients/${patientId}/export`);
    expect(response.status).toBe(401);
  });

  it("exports successfully for a patient whose name is outside the Latin-1 range", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const patient = { patientFirstName: "田中", patientLastName: `太郎-${uuid()}`, patientDob: "1985-05-05" };
    const created = await request(app.getHttpServer())
      .post("/encounters")
      .set("Authorization", `Bearer ${token}`)
      .send(patient);
    const patientId = created.body.patientId as string;
    await request(app.getHttpServer())
      .post(`/encounters/${created.body.id}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        note: {
          subjective: "MARKER_UNICODE_CASE",
          objective: "unremarkable",
          assessment: "assessment pending",
          plan: "follow up as needed",
          icd10Codes: [],
        },
      });

    const response = await getPdf(patientId, token);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("application/pdf");
    expect(extractText(response.body as Buffer)).toContain("MARKER_UNICODE_CASE");

    const rows = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'patient.bulk_pdf_export' AND target_id = $1",
      [patientId],
    );
    expect(rows.rows).toHaveLength(1);
  });

  it("writes no audit row for a rejected (403) export attempt", async () => {
    const providerA = await createTestProvider(pool, "provider");
    const providerC = await createTestProvider(pool, "provider");
    const tokenA = await loginTestProvider(app, providerA);
    const tokenC = await loginTestProvider(app, providerC);
    const patient = uniquePatient();
    const { patientId } = await createAndSaveEncounter(tokenA, patient, "MARKER_NO_AUDIT_ON_403");

    const response = await request(app.getHttpServer())
      .get(`/patients/${patientId}/export`)
      .set("Authorization", `Bearer ${tokenC}`);
    expect(response.status).toBe(403);

    const rows = await pool.query(
      "SELECT * FROM audit_logs WHERE action = 'patient.bulk_pdf_export' AND actor_id = $1",
      [providerC.id],
    );
    expect(rows.rows).toHaveLength(0);
  });

  it("404s for a patient that does not exist", async () => {
    const provider = await createTestProvider(pool, "provider");
    const token = await loginTestProvider(app, provider);
    const response = await request(app.getHttpServer())
      .get("/patients/00000000-0000-0000-0000-000000000000/export")
      .set("Authorization", `Bearer ${token}`);
    expect(response.status).toBe(404);
  });
});
