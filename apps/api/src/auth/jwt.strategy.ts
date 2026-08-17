import { Inject, Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { JwtClaims } from "@scribe/shared-types";
import { APP_CONFIG, AppConfig } from "../config/app-config";
import { ProvidersRepository } from "./providers.repository";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly providers: ProvidersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  async validate(payload: JwtClaims) {
    const provider = await this.providers.findById(payload.sub);
    if (!provider || !provider.is_active) {
      return null; // passport-jwt turns a falsy return into a 401
    }
    return { id: provider.id, email: provider.email, role: provider.role, name: provider.name };
  }
}
