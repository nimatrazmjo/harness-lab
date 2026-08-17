import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe";

describe("ZodValidationPipe", () => {
  const schema = z.object({ name: z.string().min(1) });

  it("passes through and returns the parsed value on success", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ name: "Ada" })).toEqual({ name: "Ada" });
  });

  it("throws BadRequestException on validation failure", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({ name: "" })).toThrow(BadRequestException);
  });

  it("throws on missing required fields", () => {
    const pipe = new ZodValidationPipe(schema);
    expect(() => pipe.transform({})).toThrow(BadRequestException);
  });
});
