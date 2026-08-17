import { Module } from "@nestjs/common";
import { TemplatesController } from "./templates.controller";
import { TemplatesRepository } from "./templates.repository";

@Module({
  controllers: [TemplatesController],
  providers: [TemplatesRepository],
  exports: [TemplatesRepository],
})
export class TemplatesModule {}
