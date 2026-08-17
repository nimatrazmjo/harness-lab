import { describe, expect, it } from "vitest";
import { hasClinicalContent } from "../safety";

describe("hasClinicalContent", () => {
  it("rejects empty input", () => {
    expect(hasClinicalContent("")).toBe(false);
  });

  it("rejects short garbage", () => {
    expect(hasClinicalContent("asdf")).toBe(false);
  });

  it("rejects repeated-character mash", () => {
    expect(hasClinicalContent("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe(false);
  });

  it("rejects repeated single word", () => {
    expect(hasClinicalContent("test test test test test test")).toBe(false);
  });

  it("accepts a real clinical transcript", () => {
    expect(
      hasClinicalContent(
        "Patient reports lower back pain for 3 days, worse with movement. Denies numbness. Exam shows tenderness at L4-L5, normal reflexes.",
      ),
    ).toBe(true);
  });
});
