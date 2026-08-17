import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import type { CurrentUserPayload } from "../auth/current-user.decorator";
import { EncountersRepository } from "../encounters/encounters.repository";
import { PdfExportService } from "./pdf-export.service";
import { PatientRow, PatientsRepository } from "./patients.repository";
import { selectEncountersForExport } from "./select-encounters-for-export";

@Injectable()
export class PatientsService {
  constructor(
    private readonly patientsRepo: PatientsRepository,
    private readonly encountersRepo: EncountersRepository,
    private readonly pdfExport: PdfExportService,
    private readonly audit: AuditService,
  ) {}

  async exportPdf(patientId: string, user: CurrentUserPayload): Promise<{ patient: PatientRow; buffer: Buffer }> {
    const patient = await this.patientsRepo.findById(patientId);
    if (!patient) throw new NotFoundException("Patient not found");

    const allEncounters = await this.encountersRepo.listForPatient(patientId);
    const encounters = selectEncountersForExport(allEncounters, user);

    // A provider with none of their own encounters for this patient gets 403 — never a silently
    // empty/partial PDF that could otherwise imply "this patient has no history" when other
    // providers' encounters actually exist (AGENTS.md [TENANT-ISOLATION]).
    if (encounters.length === 0 && user.role !== "admin") {
      throw new ForbiddenException("You do not have access to this patient's encounters");
    }

    const buffer = await this.pdfExport.render(patient, encounters);

    // Audited once generation succeeds — that's the meaningful, verifiable moment. True
    // client-confirmed-receipt isn't something HTTP response completion can prove without
    // added application-level acknowledgment (and isn't how any other audit call in this
    // codebase works either — note.save logs after the DB write succeeds, not after the
    // client's fetch() promise resolves). What this *does* guarantee, now that the response
    // headers can no longer throw on construction (see `safeFilenameSegment` in the
    // controller — that was the concrete failure mode that could previously produce a
    // "successful" audit row for a request that then 500'd), is that logging only happens
    // once real, valid PDF bytes exist for this patient.
    await this.audit.log({
      actorId: user.id,
      action: "patient.bulk_pdf_export",
      targetType: "patient",
      targetId: patientId,
      metadata: { encounterCount: encounters.length },
    });

    return { patient, buffer };
  }
}
