import { selectEncountersForExport } from "./select-encounters-for-export";
import type { EncounterRow } from "../encounters/encounters.repository";
import type { CurrentUserPayload } from "../auth/current-user.decorator";

function encounter(overrides: Partial<EncounterRow> & { id: string; provider_id: string }): EncounterRow {
  return {
    patient_id: "patient-1",
    template_id: null,
    status: "saved",
    transcript: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function provider(id: string, role: CurrentUserPayload["role"] = "provider"): CurrentUserPayload {
  return { id, email: `${id}@example.dev`, name: id, role };
}

describe("selectEncountersForExport", () => {
  const encounters: EncounterRow[] = [
    encounter({ id: "e1", provider_id: "provider-a" }),
    encounter({ id: "e2", provider_id: "provider-a" }),
    encounter({ id: "e3", provider_id: "provider-b" }),
  ];

  it("a provider only sees their own encounters", () => {
    const result = selectEncountersForExport(encounters, provider("provider-a"));
    expect(result.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  it("a different provider sees only theirs, never another provider's", () => {
    const result = selectEncountersForExport(encounters, provider("provider-b"));
    expect(result.map((e) => e.id)).toEqual(["e3"]);
  });

  it("a provider with none of their own encounters for this patient gets an empty result", () => {
    const result = selectEncountersForExport(encounters, provider("provider-c"));
    expect(result).toEqual([]);
  });

  it("an admin sees every provider's encounters", () => {
    const result = selectEncountersForExport(encounters, provider("admin-1", "admin"));
    expect(result.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
  });

  it("an empty encounter list stays empty regardless of role", () => {
    expect(selectEncountersForExport([], provider("provider-a"))).toEqual([]);
    expect(selectEncountersForExport([], provider("admin-1", "admin"))).toEqual([]);
  });
});
