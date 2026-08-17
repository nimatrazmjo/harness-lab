import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { SaveNoteRequestSchema, type NoteVersion, type SaveNoteRequest } from "@scribe/shared-types";
import { CurrentUser, CurrentUserPayload } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { NotesService } from "./notes.service";

@Controller("encounters/:encounterId/notes")
@UseGuards(JwtAuthGuard)
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Post()
  async save(
    @CurrentUser() user: CurrentUserPayload,
    @Param("encounterId") encounterId: string,
    @Body(new ZodValidationPipe(SaveNoteRequestSchema)) body: SaveNoteRequest,
  ): Promise<NoteVersion> {
    return this.notes.save(encounterId, user, body.note);
  }

  @Get()
  async history(
    @CurrentUser() user: CurrentUserPayload,
    @Param("encounterId") encounterId: string,
  ): Promise<NoteVersion[]> {
    return this.notes.history(encounterId, user);
  }
}
