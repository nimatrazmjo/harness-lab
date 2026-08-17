import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { CreateEncounterRequest, UpdateEncounterInputRequest } from "@scribe/shared-types";
import type { CurrentUserPayload } from "../auth/current-user.decorator";
import { PatientsRepository } from "../patients/patients.repository";
import { EncounterRow, EncountersRepository } from "./encounters.repository";

@Injectable()
export class EncountersService {
  constructor(
    private readonly encounters: EncountersRepository,
    private readonly patients: PatientsRepository,
  ) {}

  async create(providerId: string, dto: CreateEncounterRequest): Promise<EncounterRow> {
    const patient = await this.patients.findOrCreate({
      firstName: dto.patientFirstName,
      lastName: dto.patientLastName,
      dob: dto.patientDob,
    });
    return this.encounters.create({
      providerId,
      patientId: patient.id,
      templateId: dto.templateId ?? null,
    });
  }

  /**
   * Tenant isolation gate — see AGENTS.md [TENANT-ISOLATION]. Every provider-facing
   * read/write of an encounter must go through this. Admin bypasses only via the
   * explicit `allowAdmin` param, which callers set only on admin-only routes.
   */
  async getForUser(encounterId: string, user: CurrentUserPayload, allowAdmin = true): Promise<EncounterRow> {
    const encounter = await this.encounters.findById(encounterId);
    if (!encounter) throw new NotFoundException("Encounter not found");

    const isOwner = encounter.provider_id === user.id;
    const isAdminBypass = allowAdmin && user.role === "admin";
    if (!isOwner && !isAdminBypass) {
      throw new ForbiddenException("You do not have access to this encounter");
    }
    return encounter;
  }

  async updateInput(
    encounterId: string,
    user: CurrentUserPayload,
    dto: UpdateEncounterInputRequest,
  ): Promise<EncounterRow> {
    await this.getForUser(encounterId, user, false);
    const updated = await this.encounters.updateInput(encounterId, dto.transcript, dto.templateId ?? null);
    if (!updated) throw new NotFoundException("Encounter not found");
    return updated;
  }

  async listMine(providerId: string): Promise<EncounterRow[]> {
    return this.encounters.listForProvider(providerId);
  }
}
