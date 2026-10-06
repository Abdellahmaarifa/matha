import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";

import { AuthProvider } from "@/features/auth/auth-context";
import "@/index.css";

import { routeTree } from "./routeTree.gen";

// A query that failed because the API answered with an error (4xx/5xx) gets
// the same answer if retried -- only retry network failures, so a single
// error never turns into a second one in the console.
function isApiError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "error" in error;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => failureCount < 1 && !isApiError(error),
      refetchOnWindowFocus: false,
    },
  },
});

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
