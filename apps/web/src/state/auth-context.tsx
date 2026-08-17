import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AuthUser, LoginResponse } from "@scribe/shared-types";
import { api } from "../api/client";
import { clearToken, setToken } from "../api/client";

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_KEY = "scribe.user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: async (email: string, password: string) => {
        const response = await api.post<LoginResponse>("/auth/login", { email, password });
        setToken(response.accessToken);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
        setUser(response.user);
      },
      logout: () => {
        clearToken();
        localStorage.removeItem(USER_KEY);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
