import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuth } from "@/features/auth/auth-context";

export function OAuthCallbackPage() {
  const { access_token, refresh_token } = useSearch({ from: "/oauth/callback" });
  const { completeOAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!access_token || !refresh_token) {
      navigate({ to: "/login", replace: true });
      return;
    }
    completeOAuth(access_token, refresh_token);
    navigate({ to: "/", replace: true });
    // Runs once on mount to finish the redirect-based OAuth flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}
