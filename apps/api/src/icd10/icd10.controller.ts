import { Controller, Query, Get, UseGuards, UsePipes } from "@nestjs/common";
import { Icd10SearchRequestSchema, type Icd10SearchResult } from "@scribe/shared-types";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { Icd10Service } from "./icd10.service";

@Controller("icd10")
@UseGuards(JwtAuthGuard)
export class Icd10Controller {
  constructor(private readonly icd10: Icd10Service) {}

  @Get("search")
  @UsePipes(new ZodValidationPipe(Icd10SearchRequestSchema))
  async search(@Query() query: { query: string; limit: number }): Promise<Icd10SearchResult[]> {
    return this.icd10.search(query.query, query.limit);
  }
}
