import { Module } from "@nestjs/common";
import { EncountersModule } from "../encounters/encounters.module";
import { DraftsController } from "./drafts.controller";
import { DraftsRepository } from "./drafts.repository";
import { DraftsService } from "./drafts.service";

@Module({
  imports: [EncountersModule],
  controllers: [DraftsController],
  providers: [DraftsService, DraftsRepository],
  exports: [DraftsRepository],
})
export class DraftsModule {}
