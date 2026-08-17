import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module";
import { AiModule } from "./ai/ai.module";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { ConfigModule } from "./config/config.module";
import { DatabaseModule } from "./database/database.module";
import { DraftsModule } from "./drafts/drafts.module";
import { EncountersModule } from "./encounters/encounters.module";
import { HealthModule } from "./health/health.module";
import { Icd10Module } from "./icd10/icd10.module";
import { NotesModule } from "./notes/notes.module";
import { PatientsModule } from "./patients/patients.module";
import { ScribeModule } from "./scribe/scribe.module";
import { TemplatesModule } from "./templates/templates.module";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AiModule,
    AuditModule,
    AuthModule,
    EncountersModule,
    NotesModule,
    ScribeModule,
    Icd10Module,
    HealthModule,
    AdminModule,
    TemplatesModule,
    DraftsModule,
    PatientsModule,
  ],
})
export class AppModule {}
