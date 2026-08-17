import { Body, Controller, Get, Param, Put, UseGuards } from "@nestjs/common";
import { SaveDraftRequestSchema, type DraftResponse, type SaveDraftRequest } from "@scribe/shared-types";
import { CurrentUser, CurrentUserPayload } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { DraftsService } from "./drafts.service";

@Controller("encounters/:encounterId/draft")
@UseGuards(JwtAuthGuard)
export class DraftsController {
  constructor(private readonly drafts: DraftsService) {}

  @Put()
  async save(
    @CurrentUser() user: CurrentUserPayload,
    @Param("encounterId") encounterId: string,
    @Body(new ZodValidationPipe(SaveDraftRequestSchema)) body: SaveDraftRequest,
  ): Promise<{ ok: true }> {
    await this.drafts.save(encounterId, user, body.note);
    return { ok: true };
  }

  @Get()
  async get(
    @CurrentUser() user: CurrentUserPayload,
    @Param("encounterId") encounterId: string,
  ): Promise<DraftResponse> {
    return this.drafts.get(encounterId, user);
  }
}
