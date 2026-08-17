import { Injectable } from "@nestjs/common";
import type { DraftResponse, SoapNote } from "@scribe/shared-types";
import type { CurrentUserPayload } from "../auth/current-user.decorator";
import { EncountersService } from "../encounters/encounters.service";
import { DraftsRepository } from "./drafts.repository";

@Injectable()
export class DraftsService {
  constructor(
    private readonly drafts: DraftsRepository,
    private readonly encountersService: EncountersService,
  ) {}

  async save(encounterId: string, user: CurrentUserPayload, note: SoapNote): Promise<void> {
    // Provider-only write — draft state belongs to whoever owns the encounter, same gate as
    // updating the transcript (AGENTS.md [TENANT-ISOLATION]).
    await this.encountersService.getForUser(encounterId, user, false);
    await this.drafts.upsert({ encounterId, providerId: user.id, note });
  }

  async get(encounterId: string, user: CurrentUserPayload): Promise<DraftResponse> {
    // Admin can view too, same read policy as everything else encounter-scoped.
    await this.encountersService.getForUser(encounterId, user);
    const draft = await this.drafts.findByEncounterId(encounterId);
    return {
      note: draft?.note_draft ?? null,
      updatedAt: draft ? draft.updated_at.toISOString() : null,
    };
  }
}
