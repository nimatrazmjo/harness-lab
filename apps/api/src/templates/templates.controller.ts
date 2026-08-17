import { Controller, Get, UseGuards } from "@nestjs/common";
import type { Template } from "@scribe/shared-types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { toTemplateDto } from "./templates.mapper";
import { TemplatesRepository } from "./templates.repository";

/** Read-only for providers — they pick a template before generating. CRUD is admin-only (Tier 1). */
@Controller("templates")
@UseGuards(JwtAuthGuard)
export class TemplatesController {
  constructor(private readonly templates: TemplatesRepository) {}

  @Get()
  async listActive(): Promise<Template[]> {
    const rows = await this.templates.listActive();
    return rows.map(toTemplateDto);
  }
}
