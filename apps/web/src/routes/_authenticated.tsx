import { Outlet, createFileRoute, redirect, useMatches } from "@tanstack/react-router";

import { tokenStore } from "@matcha/api-client/tokens";
import { MobileShell } from "@/components/layout/mobile-shell";
import { ProtectedRoute } from "@/features/auth/protected-route";

export const Route = createFileRoute("/_authenticated")({
  // Redirect before anything renders: doing it from inside the component
  // (<Navigate> during render) loops forever on the first page load.
  beforeLoad: () => {
    if (!tokenStore.getAccess()) {
      throw redirect({ to: "/login", replace: true });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const matches = useMatches();
  const title = [...matches].reverse().find((match) => match.staticData?.title)?.staticData?.title ?? "";

  return (
    <ProtectedRoute>
      <MobileShell title={title}>
        <Outlet />
      </MobileShell>
    </ProtectedRoute>
  );
}
