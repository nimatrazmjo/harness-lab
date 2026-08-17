import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  AdminEncounterFilterSchema,
  CreateProviderRequestSchema,
  type AdminEncounterFilter,
  type CreateProviderRequest,
  type Encounter,
  type ProviderSummary,
} from "@scribe/shared-types";
import { CurrentUser, CurrentUserPayload } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { toEncounterDto } from "../encounters/encounters.mapper";
import { AdminService } from "./admin.service";
import { toProviderSummaryDto } from "./admin.mapper";

/** Admin-only surface — every route here requires the admin role via the class-level guard. */
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("ping")
  ping(@CurrentUser() user: CurrentUserPayload) {
    return { ok: true, role: user.role };
  }

  @Get("encounters")
  async listEncounters(
    @Query(new ZodValidationPipe(AdminEncounterFilterSchema)) filter: AdminEncounterFilter,
  ): Promise<Encounter[]> {
    const rows = await this.admin.listAllEncounters(filter);
    return rows.map(toEncounterDto);
  }

  @Get("providers")
  async listProviders(): Promise<ProviderSummary[]> {
    const rows = await this.admin.listProviders();
    return rows.map(toProviderSummaryDto);
  }

  @Post("providers")
  async createProvider(
    @Body(new ZodValidationPipe(CreateProviderRequestSchema)) body: CreateProviderRequest,
  ): Promise<ProviderSummary> {
    const row = await this.admin.createProvider(body);
    return toProviderSummaryDto(row);
  }

  @Patch("providers/:id/deactivate")
  async deactivateProvider(@Param("id") id: string): Promise<{ ok: true }> {
    await this.admin.deactivateProvider(id);
    return { ok: true };
  }
}
