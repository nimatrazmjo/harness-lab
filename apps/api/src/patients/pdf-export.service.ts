import { Injectable } from "@nestjs/common";
import PDFDocument from "pdfkit";
import type { EncounterRow } from "../encounters/encounters.repository";
import { NotesRepository } from "../notes/notes.repository";
import { ProvidersRepository } from "../auth/providers.repository";
import type { PatientRow } from "./patients.repository";

@Injectable()
export class PdfExportService {
  constructor(
    private readonly notesRepo: NotesRepository,
    private readonly providersRepo: ProvidersRepository,
  ) {}

  /**
   * Renders already-selected, already-tenant-scoped encounters — this service does not decide
   * who may see what (see `selectEncountersForExport`), only how it's formatted. Compression is
   * off deliberately so tests can assert on identifying text in the raw output buffer without a
   * second new (PDF-parsing) dependency.
   */
  async render(patient: PatientRow, encounters: EncounterRow[]): Promise<Buffer> {
    const doc = new PDFDocument({ compress: false });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      // pdfkit's PDFDocument is a Readable stream — an unhandled "error" event is a Node
      // default-throw, which could crash the process instead of just failing this request.
      doc.on("error", reject);
    });

    // pg returns a `date` column as a JS Date at runtime regardless of the `string` type on
    // PatientRow — format explicitly so the export shows "1975-03-03", not a full Date.toString().
    const rawDob: unknown = patient.dob;
    const dob = rawDob instanceof Date ? rawDob.toISOString().slice(0, 10) : String(rawDob).slice(0, 10);

    doc.fontSize(18).text(`${patient.first_name} ${patient.last_name}`);
    doc.fontSize(11).text(`DOB: ${dob}`);
    doc.moveDown();

    if (encounters.length === 0) {
      doc.fontSize(12).text("No encounters on record for this patient.");
    }

    const [latestVersions, providers] = await Promise.all([
      this.notesRepo.getLatestPerEncounter(encounters.map((e) => e.id)),
      this.providersRepo.findByIds([...new Set(encounters.map((e) => e.provider_id))]),
    ]);
    const versionByEncounterId = new Map(latestVersions.map((v) => [v.encounter_id, v]));
    const providerById = new Map(providers.map((p) => [p.id, p]));

    for (const encounter of encounters) {
      const provider = providerById.get(encounter.provider_id);
      doc
        .fontSize(14)
        .text(`Encounter ${encounter.created_at.toISOString().slice(0, 10)} — ${provider?.name ?? "Unknown provider"}`);
      doc.fontSize(10).text(`Status: ${encounter.status}`);

      const note = versionByEncounterId.get(encounter.id);
      if (!note) {
        // No fabricated content — an encounter without a saved note stays visibly empty
        // (AGENTS.md [CLINICAL-SAFETY]).
        doc.fontSize(11).text("No saved note for this encounter.");
      } else {
        doc.fontSize(11).text(`Subjective: ${note.subjective}`);
        doc.text(`Objective: ${note.objective}`);
        doc.text(`Assessment: ${note.assessment}`);
        doc.text(`Plan: ${note.plan}`);
        const codes = note.icd10_codes.map((c) => `${c.code} ${c.description}`).join(", ");
        doc.text(`ICD-10: ${codes || "none"}`);
      }
      doc.moveDown();
    }

    doc.end();
    return finished;
  }
}
