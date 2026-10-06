import { useQuery } from "@tanstack/react-query";

import { api } from "@matcha/api-client/client";

/** Which OAuth strategies the backend has credentials configured for (bonus feature). */
export function useOAuthProviders() {
  return useQuery({
    queryKey: ["oauth-providers"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/auth/oauth/providers", {});
      if (error) throw error;
      return data.providers;
    },
    staleTime: Infinity,
  });
}
