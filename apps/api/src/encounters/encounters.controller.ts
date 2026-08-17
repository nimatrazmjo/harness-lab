import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  CreateEncounterRequestSchema,
  UpdateEncounterInputRequestSchema,
  type CreateEncounterRequest,
  type Encounter,
  type UpdateEncounterInputRequest,
} from "@scribe/shared-types";
import { CurrentUser, CurrentUserPayload } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { toEncounterDto } from "./encounters.mapper";
import { EncountersService } from "./encounters.service";

@Controller("encounters")
@UseGuards(JwtAuthGuard)
export class EncountersController {
  constructor(private readonly encounters: EncountersService) {}

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CreateEncounterRequestSchema)) body: CreateEncounterRequest,
  ): Promise<Encounter> {
    const row = await this.encounters.create(user.id, body);
    return toEncounterDto(row);
  }

  @Get()
  async listMine(@CurrentUser() user: CurrentUserPayload): Promise<Encounter[]> {
    const rows = await this.encounters.listMine(user.id);
    return rows.map(toEncounterDto);
  }

  @Get(":id")
  async getOne(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string): Promise<Encounter> {
    const row = await this.encounters.getForUser(id, user);
    return toEncounterDto(row);
  }

  @Patch(":id/input")
  async updateInput(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateEncounterInputRequestSchema)) body: UpdateEncounterInputRequest,
  ): Promise<Encounter> {
    const row = await this.encounters.updateInput(id, user, body);
    return toEncounterDto(row);
  }
}
