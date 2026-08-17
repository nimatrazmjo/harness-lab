import { Controller, Get, Param, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../auth/current-user.decorator";
import type { CurrentUserPayload } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PatientsService } from "./patients.service";

/** HTTP header values must be Latin-1 — a patient name outside that range (e.g. CJK, Cyrillic,
 * Arabic) would otherwise crash `res.set()` with ERR_INVALID_CHAR. Strips to a safe ASCII subset
 * for the filename only; the PDF's own text content is untouched and renders the real name. */
function safeFilenameSegment(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9 _-]/g, "").trim();
  return cleaned || "patient";
}

@Controller("patients")
@UseGuards(JwtAuthGuard)
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  /** Bulk PDF export (pioneer.bulk_pdf) — read-only, tenant-scoped like every other
   * patient/encounter-touching route (AGENTS.md [TENANT-ISOLATION]). */
  @Get(":id/export")
  async export(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string, @Res() res: Response) {
    const { patient, buffer } = await this.patients.exportPdf(id, user);
    const filename = `${safeFilenameSegment(patient.first_name)}-${safeFilenameSegment(patient.last_name)}-encounters.pdf`;
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    });
    res.send(buffer);
  }
}
