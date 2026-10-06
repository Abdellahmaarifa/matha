import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { SESSION_EXPIRED_EVENT, api, hasUsableSession } from "@matcha/api-client/client";
import { tokenStore } from "@matcha/api-client/tokens";
import type { LoginInput, RegisterInput } from "@/lib/schemas";

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(hasUsableSession);
  const queryClient = useQueryClient();

  useEffect(() => {
    function onSessionExpired() {
      setIsAuthenticated(false);
      queryClient.clear();
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, [queryClient]);

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
