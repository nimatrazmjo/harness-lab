import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser, CurrentUserPayload } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";

/** Admin-only surface. Grows with Tier 1 (roster, templates, view-all) — this is the base gate. */
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AdminController {
  @Get("ping")
  ping(@CurrentUser() user: CurrentUserPayload) {
    return { ok: true, role: user.role };
  }
}
