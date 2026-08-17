import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  CreateTemplateRequestSchema,
  UpdateTemplateRequestSchema,
  type CreateTemplateRequest,
  type Template,
  type UpdateTemplateRequest,
} from "@scribe/shared-types";
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
  constructor(private readonly templates: TemplatesRepository) {}

  @Get()
  async listActive(): Promise<Template[]> {
    const rows = await this.templates.listActive();
    return rows.map(toTemplateDto);
  }

  @Post()
  @Roles("admin")
  async create(
    @Body(new ZodValidationPipe(CreateTemplateRequestSchema)) body: CreateTemplateRequest,
  ): Promise<Template> {
    const row = await this.templates.create(body);
    return toTemplateDto(row);
  }

  @Patch(":id")
  @Roles("admin")
  async update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(UpdateTemplateRequestSchema)) body: UpdateTemplateRequest,
  ): Promise<Template> {
    const row = await this.templates.update(id, body);
    if (!row) throw new NotFoundException("Template not found");
    return toTemplateDto(row);
  }

  @Delete(":id")
  @Roles("admin")
  async remove(@Param("id") id: string): Promise<{ ok: true }> {
    await this.templates.delete(id);
    return { ok: true };
  }
}
