import { Module } from "@nestjs/common";
import { EncountersModule } from "../encounters/encounters.module";
import { Icd10Module } from "../icd10/icd10.module";
import { NotesModule } from "../notes/notes.module";
import { TemplatesModule } from "../templates/templates.module";
import { ScribeController } from "./scribe.controller";
import { ScribeService } from "./scribe.service";

@Module({
  imports: [EncountersModule, Icd10Module, NotesModule, TemplatesModule],
  controllers: [ScribeController],
  providers: [ScribeService],
})
export class ScribeModule {}
