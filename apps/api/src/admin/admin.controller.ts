import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  AdminEncounterFilterSchema,
  AuditLogFilterSchema,
  CreateProviderRequestSchema,
  type AdminEncounterFilter,
  type AuditLog,
  type AuditLogFilter,
  type CreateProviderRequest,
  type Encounter,
  type ProviderSummary,
} from "@scribe/shared-types";
import { toAuditLogDto } from "../audit/audit.mapper";
import { AuditService } from "../audit/audit.service";
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
  constructor(
    private readonly admin: AdminService,
    private readonly audit: AuditService,
  ) {}

  @Get("ping")
  ping(@CurrentUser() user: CurrentUserPayload) {
    return { ok: true, role: user.role };
  }

  @Get("encounters")
  async listEncounters(
    @Query(new ZodValidationPipe(AdminEncounterFilterSchema)) filter: AdminEncounterFilter,
  ): Promise<Encounter[]> {
    const rows = await this.admin.listAllEncounters(filter);
    return rows.map((row) => toEncounterDto(row));
  }

  @Get("providers")
  async listProviders(): Promise<ProviderSummary[]> {
    const rows = await this.admin.listProviders();
    return rows.map(toProviderSummaryDto);
  }

  @Post("providers")
  async createProvider(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CreateProviderRequestSchema)) body: CreateProviderRequest,
  ): Promise<ProviderSummary> {
    const row = await this.admin.createProvider(user.id, body);
    return toProviderSummaryDto(row);
  }

  @Patch("providers/:id/deactivate")
  async deactivateProvider(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id") id: string,
  ): Promise<{ ok: true }> {
    await this.admin.deactivateProvider(user.id, id);
    return { ok: true };
  }

  @Get("audit-logs")
  async listAuditLogs(
    @Query(new ZodValidationPipe(AuditLogFilterSchema)) filter: AuditLogFilter,
  ): Promise<AuditLog[]> {
    const rows = await this.audit.listAll(filter);
    return rows.map(toAuditLogDto);
  }
}
