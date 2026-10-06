import { Outlet, createFileRoute, useMatches } from "@tanstack/react-router";

import { MobileShell } from "@/components/layout/mobile-shell";
import { ProtectedRoute } from "@/features/auth/protected-route";

export const Route = createFileRoute("/_authenticated")({
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
