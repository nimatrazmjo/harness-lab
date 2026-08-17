import { Injectable } from "@nestjs/common";
import type { NoteVersion, SoapNote } from "@scribe/shared-types";
import { AuditService } from "../audit/audit.service";
import type { CurrentUserPayload } from "../auth/current-user.decorator";
import { EncountersRepository } from "../encounters/encounters.repository";
import { EncountersService } from "../encounters/encounters.service";
import { toNoteVersionDto } from "./notes.mapper";
import { NotesRepository } from "./notes.repository";

@Injectable()
export class NotesService {
  constructor(
    private readonly notes: NotesRepository,
    private readonly encountersService: EncountersService,
    private readonly encountersRepo: EncountersRepository,
    private readonly audit: AuditService,
  ) {}

  async save(encounterId: string, user: CurrentUserPayload, note: SoapNote): Promise<NoteVersion> {
    // Tenant check first — a provider can never write another provider's encounter.
    await this.encountersService.getForUser(encounterId, user, false);

    const row = await this.notes.insertNextVersion({
      encounterId,
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      icd10Codes: note.icd10Codes,
      authorId: user.id,
    });

    await this.encountersRepo.updateStatus(encounterId, "saved");
    await this.audit.log({
      actorId: user.id,
      action: "note.save",
      targetType: "encounter",
      targetId: encounterId,
      metadata: { versionNumber: row.version_number },
    });

    return toNoteVersionDto(row);
  }

  async history(encounterId: string, user: CurrentUserPayload): Promise<NoteVersion[]> {
    await this.encountersService.getForUser(encounterId, user);
    const rows = await this.notes.listVersions(encounterId);
    return rows.map(toNoteVersionDto);
  }
}
