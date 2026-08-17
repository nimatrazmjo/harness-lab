import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EncountersModule } from "../encounters/encounters.module";
import { NotesModule } from "../notes/notes.module";
import { PatientsController } from "./patients.controller";
import { PatientsService } from "./patients.service";
import { PdfExportService } from "./pdf-export.service";

@Module({
  imports: [EncountersModule, NotesModule, AuthModule],
  controllers: [PatientsController],
  providers: [PatientsService, PdfExportService],
})
export class PatientsModule {}
