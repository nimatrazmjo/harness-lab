import { Module } from "@nestjs/common";
import { PatientsRepository } from "../patients/patients.repository";
import { EncountersController } from "./encounters.controller";
import { EncountersRepository } from "./encounters.repository";
import { EncountersService } from "./encounters.service";

@Module({
  controllers: [EncountersController],
  providers: [EncountersService, EncountersRepository, PatientsRepository],
  exports: [EncountersService, EncountersRepository, PatientsRepository],
})
export class EncountersModule {}
