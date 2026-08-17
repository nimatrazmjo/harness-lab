import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  CreateTemplateRequestSchema,
  UpdateTemplateRequestSchema,
  type CreateTemplateRequest,
  type Template,
  type UpdateTemplateRequest,
} from "@scribe/shared-types";
import { AuditService } from "../audit/audit.service";
import { CurrentUser, CurrentUserPayload } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { toTemplateDto } from "./templates.mapper";
import { TemplatesRepository } from "./templates.repository";

/**
 * GET is open to any authenticated provider (they pick a template before generating).
 * Write routes are admin-only (@Roles('admin')) — RolesGuard allows any authenticated user
 * through when a route has no @Roles(), so this one controller mixes both cleanly.
 */
@Controller("templates")
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplatesController {
  constructor(
    private readonly templates: TemplatesRepository,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async listActive(): Promise<Template[]> {
    const rows = await this.templates.listActive();
    return rows.map(toTemplateDto);
  }

  @Post()
  @Roles("admin")
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body(new ZodValidationPipe(CreateTemplateRequestSchema)) body: CreateTemplateRequest,
  ): Promise<Template> {
    const row = await this.templates.create(body);
    await this.audit.log({
      actorId: user.id,
      action: "admin.template.create",
      targetType: "template",
      targetId: row.id,
      metadata: { name: row.name, encounterType: row.encounter_type },
    });
    return toTemplateDto(row);
  }

  @Patch(":id")
  @Roles("admin")
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateTemplateRequestSchema)) body: UpdateTemplateRequest,
  ): Promise<Template> {
    const row = await this.templates.update(id, body);
    if (!row) throw new NotFoundException("Template not found");
    await this.audit.log({
      actorId: user.id,
      action: "admin.template.update",
      targetType: "template",
      targetId: row.id,
      metadata: { fields: Object.keys(body) },
    });
    return toTemplateDto(row);
  }

  @Delete(":id")
  @Roles("admin")
  async remove(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string): Promise<{ ok: true }> {
    await this.templates.delete(id);
    await this.audit.log({
      actorId: user.id,
      action: "admin.template.delete",
      targetType: "template",
      targetId: id,
    });
    return { ok: true };
  }
}
