import type {
  AdminEncounterFilter,
  AuditLog,
  AuditLogFilter,
  CreateProviderRequest,
  Encounter,
  ProviderSummary,
} from "@scribe/shared-types";
import { api } from "./client";

function toQuery(params: Record<string, string | undefined>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) usp.set(key, value);
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

export const adminApi = {
  listEncounters: (filter: AdminEncounterFilter = {}) =>
    api.get<Encounter[]>(`/admin/encounters${toQuery(filter)}`),
  listProviders: () => api.get<ProviderSummary[]>("/admin/providers"),
  createProvider: (body: CreateProviderRequest) => api.post<ProviderSummary>("/admin/providers", body),
  deactivateProvider: (id: string) => api.patch<{ ok: true }>(`/admin/providers/${id}/deactivate`),
  listAuditLogs: (filter: AuditLogFilter = {}) => api.get<AuditLog[]>(`/admin/audit-logs${toQuery(filter)}`),
};
