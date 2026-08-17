import type { CurrentUserPayload } from "../auth/current-user.decorator";
import type { EncounterRow } from "../encounters/encounters.repository";

/**
 * Direct list/read access to encounter records stays scoped to the requesting provider's own
 * `provider_id`; admin bypasses only via an explicit role check — mirrors
 * `EncountersService.getForUser`'s `allowAdmin` pattern applied to a set instead of one row
 * (AGENTS.md [TENANT-ISOLATION]). Pure and side-effect-free so tenant isolation for bulk export
 * can be asserted directly, without parsing the rendered PDF.
 */
export function selectEncountersForExport(
  encounters: EncounterRow[],
  requestingUser: CurrentUserPayload,
): EncounterRow[] {
  if (requestingUser.role === "admin") return encounters;
  return encounters.filter((e) => e.provider_id === requestingUser.id);
}
