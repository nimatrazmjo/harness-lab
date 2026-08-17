import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "./roles.guard";

function makeContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  it("allows any authenticated user when no @Roles() is set", () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: "provider" }))).toBe(true);
  });

  it("allows a user whose role is in the required list", () => {
    const reflector = { getAllAndOverride: () => ["admin"] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: "admin" }))).toBe(true);
  });

  it("denies a user whose role is not in the required list", () => {
    const reflector = { getAllAndOverride: () => ["admin"] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: "provider" }))).toBe(false);
  });

  it("denies when there is no authenticated user", () => {
    const reflector = { getAllAndOverride: () => ["admin"] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext(undefined))).toBe(false);
  });
});
