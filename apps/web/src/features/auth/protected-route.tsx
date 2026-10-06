import type { ReactNode } from "react";
import { Navigate, useLocation } from "@tanstack/react-router";

import { useMe } from "@matcha/api-client/hooks";
import { useAuth } from "@/features/auth/auth-context";

const PROFILE_PATH = "/profile";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const { data: me, isPending } = useMe();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Subject requirement (IV.2): "Once his profile is complete, he can access
  // the website" -- a verified user who hasn't filled in gender/bio/tags/a
  // photo yet must be steered to finish their profile before they can browse,
  // search or match, instead of silently being let through with the defaults.
  if (!isPending && me && !me.profile_complete && location.pathname !== PROFILE_PATH) {
    return <Navigate to={PROFILE_PATH} replace />;
  }

  return <>{children}</>;
}
