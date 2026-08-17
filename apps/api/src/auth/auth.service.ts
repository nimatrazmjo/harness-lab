import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import type { AuthUser, JwtClaims, LoginResponse } from "@scribe/shared-types";
import { ProvidersRepository } from "./providers.repository";

@Injectable()
export class AuthService {
  constructor(
    private readonly providers: ProvidersRepository,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const provider = await this.providers.findByEmail(email);
    // Constant-shape failure: don't reveal whether the email exists.
    if (!provider || !provider.is_active) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await argon2.verify(provider.password_hash, password);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const claims: Pick<JwtClaims, "sub" | "role" | "email"> = {
      sub: provider.id,
      role: provider.role,
      email: provider.email,
    };
    const accessToken = await this.jwt.signAsync(claims);
    const decoded = this.jwt.decode(accessToken) as JwtClaims;

    const user: AuthUser = {
      id: provider.id,
      email: provider.email,
      name: provider.name,
      role: provider.role,
    };

    return {
      accessToken,
      expiresAt: new Date(decoded.exp * 1000).toISOString(),
      user,
    };
  }

  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }
}
