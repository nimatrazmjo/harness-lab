import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@scribe/shared-types";
import { ROLES_KEY } from "./roles.decorator";

/**
 * Explicit admin-wide-access gate — see AGENTS.md [TENANT-ISOLATION]. Only routes
 * decorated with @Roles('admin') bypass per-provider scoping; everything else
 * must filter by the authenticated provider_id in its own query/service layer.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    return !!user && required.includes(user.role);
  }
}
