import { Navigate, Outlet, createRootRoute } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    title?: string;
    /** Page fills the viewport and manages its own scrolling (e.g. chat). */
    fullHeight?: boolean;
  }
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => <Navigate to="/" />,
});

function RootComponent() {
  return (
    <>
      <Outlet />
      {import.meta.env.DEV ? <TanStackRouterDevtools position="bottom-right" /> : null}
    </>
  );
}
