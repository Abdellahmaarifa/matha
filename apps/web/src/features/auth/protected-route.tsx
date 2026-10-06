import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";

import { useMe } from "@matcha/api-client/hooks";
import { useAuth } from "@/features/auth/auth-context";

const PROFILE_PATH = "/profile";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: me, isPending } = useMe();

  // Subject requirement (IV.2): "Once his profile is complete, he can access
  // the website" -- a verified user who hasn't filled in gender/bio/tags/a
  // photo yet must be steered to finish their profile before they can browse,
  // search or match, instead of silently being let through with the defaults.
  const mustCompleteProfile = !isPending && !!me && !me.profile_complete && location.pathname !== PROFILE_PATH;

  // The route's beforeLoad handles the first visit; this covers logging out
  // while already on a protected page. Navigating from an effect (not a
  // <Navigate> rendered inline) avoids an endless render loop.
  useEffect(() => {
    if (!isAuthenticated) {
      navigate({ to: "/login", replace: true });
    } else if (mustCompleteProfile) {
      navigate({ to: PROFILE_PATH, replace: true });
    }
  }, [isAuthenticated, mustCompleteProfile, navigate]);

  if (!isAuthenticated || mustCompleteProfile) return null;

  return <>{children}</>;
}
