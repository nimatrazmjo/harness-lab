import type { AuditLog } from "@scribe/shared-types";
import type { AuditLogRow } from "./audit.service";

export function toAuditLogDto(row: AuditLogRow): AuditLog {
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    metadata: row.metadata,
    createdAt: row.created_at.toISOString(),
  };
}
