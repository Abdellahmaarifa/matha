import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { api } from "@matcha/api-client/client";
import { tokenStore } from "@matcha/api-client/tokens";
import type { LoginInput, RegisterInput } from "@/lib/schemas";

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Finishes an OAuth sign-in: tokens already came from the backend redirect. */
  completeOAuth: (accessToken: string, refreshToken: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(tokenStore.getAccess()));
  const queryClient = useQueryClient();

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      async login(input) {
        const { data, error } = await api.POST("/api/auth/login", { body: input });
        if (error) throw error;
        tokenStore.set(data.access_token, data.refresh_token);
        setIsAuthenticated(true);
      },
      async register(input) {
        const { error } = await api.POST("/api/auth/register", { body: input });
        if (error) throw error;
      },
      completeOAuth(accessToken, refreshToken) {
        tokenStore.set(accessToken, refreshToken);
        setIsAuthenticated(true);
      },
      async logout() {
        try {
          await api.POST("/api/auth/logout", {});
        } finally {
          tokenStore.clear();
          setIsAuthenticated(false);
          queryClient.clear();
        }
      },
    }),
    [isAuthenticated, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
