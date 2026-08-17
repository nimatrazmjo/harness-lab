import type { ProviderSummary } from "@scribe/shared-types";
import type { ProviderRow } from "../auth/providers.repository";

/** Never include password_hash — this is the boundary that keeps it out of any API response. */
export function toProviderSummaryDto(row: ProviderRow): ProviderSummary {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at.toISOString(),
  };
}
