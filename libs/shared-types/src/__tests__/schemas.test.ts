import { describe, expect, it } from "vitest";
import { CreateEncounterRequestSchema } from "../encounter";
import { Icd10SearchRequestSchema } from "../icd10";
import { LoginRequestSchema } from "../auth";

describe("CreateEncounterRequestSchema", () => {
  it("accepts a valid payload", () => {
    const result = CreateEncounterRequestSchema.safeParse({
      patientFirstName: "Jane",
      patientLastName: "Doe",
      patientDob: "1990-01-01",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed DOB", () => {
    const result = CreateEncounterRequestSchema.safeParse({
      patientFirstName: "Jane",
      patientLastName: "Doe",
      patientDob: "01/01/1990",
    });
    expect(result.success).toBe(false);
  });
});

describe("Icd10SearchRequestSchema", () => {
  it("coerces a query-string limit into a number", () => {
    const result = Icd10SearchRequestSchema.safeParse({ query: "back pain", limit: "5" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(5);
  });

  it("defaults limit to 10 when omitted", () => {
    const result = Icd10SearchRequestSchema.safeParse({ query: "back pain" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.limit).toBe(10);
  });
});

describe("LoginRequestSchema", () => {
  it("rejects an invalid email", () => {
    const result = LoginRequestSchema.safeParse({ email: "not-an-email", password: "x" });
    expect(result.success).toBe(false);
  });
});
