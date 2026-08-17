import { z } from "zod";

export const RoleSchema = z.enum(["provider", "admin"]);
export type Role = z.infer<typeof RoleSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema,
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  expiresAt: z.string().datetime(),
  user: AuthUserSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export interface JwtClaims {
  sub: string;
  role: Role;
  email: string;
  iat: number;
  exp: number;
}
