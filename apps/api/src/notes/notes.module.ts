import { Module } from "@nestjs/common";
import { EncountersModule } from "../encounters/encounters.module";
import { NotesController } from "./notes.controller";
import { NotesRepository } from "./notes.repository";
import { NotesService } from "./notes.service";

@Module({
  imports: [EncountersModule],
  controllers: [NotesController],
  providers: [NotesService, NotesRepository],
  exports: [NotesRepository],
})
export class NotesModule {}
