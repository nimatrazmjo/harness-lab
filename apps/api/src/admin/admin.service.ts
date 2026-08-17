import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { AdminEncounterFilter, CreateProviderRequest } from "@scribe/shared-types";
import { AuthService } from "../auth/auth.service";
import { ProviderRow, ProvidersRepository } from "../auth/providers.repository";
import { EncounterRow, EncountersRepository } from "../encounters/encounters.repository";

@Injectable()
export class AdminService {
  constructor(
    private readonly encounters: EncountersRepository,
    private readonly providers: ProvidersRepository,
  ) {}

  /** Admin-only cross-provider view (AGENTS.md [TENANT-ISOLATION]: bypass only through this
   * explicit admin guard — every route calling this lives behind @Roles('admin')). */
  async listAllEncounters(filter: AdminEncounterFilter): Promise<EncounterRow[]> {
    return this.encounters.listAll(filter);
  }

  async createProvider(dto: CreateProviderRequest): Promise<ProviderRow> {
    const existing = await this.providers.findByEmail(dto.email);
    if (existing) throw new ConflictException("A provider with this email already exists");

    const passwordHash = await AuthService.hashPassword(dto.password);
    return this.providers.create({ email: dto.email, passwordHash, name: dto.name, role: dto.role });
  }

  async listProviders(): Promise<ProviderRow[]> {
    return this.providers.listAll();
  }

  /** Deactivation never touches the provider's data — only is_active flips. Their session ends
   * on their next authenticated request (JwtStrategy re-checks is_active per request), not
   * immediately and not by revoking anything already in flight. Draft/encounter data is
   * untouched and remains readable (by the provider once reactivated, or by an admin). */
  async deactivateProvider(id: string): Promise<void> {
    const provider = await this.providers.findById(id);
    if (!provider) throw new NotFoundException("Provider not found");
    await this.providers.setActive(id, false);
  }
}
