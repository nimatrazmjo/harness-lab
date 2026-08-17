import { Body, Controller, Post, UsePipes } from "@nestjs/common";
import { LoginRequestSchema, type LoginRequest, type LoginResponse } from "@scribe/shared-types";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  @UsePipes(new ZodValidationPipe(LoginRequestSchema))
  async login(@Body() body: LoginRequest): Promise<LoginResponse> {
    return this.auth.login(body.email, body.password);
  }
}
