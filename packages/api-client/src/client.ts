import createClient, { type Middleware } from "openapi-fetch";

import type { paths } from "./schema";
import { tokenStore } from "./tokens";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.getRefresh();
  if (!refreshToken) return null;

  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    tokenStore.clear();
    return null;
  }
  const data = (await res.json()) as { access_token: string };
  tokenStore.setAccess(data.access_token);
  return data.access_token;
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = tokenStore.getAccess();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
  async onResponse({ request, response }) {
    if (response.status !== 401 || request.url.includes("/api/auth/")) {
      return response;
    }
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
    const newToken = await refreshPromise;
    if (!newToken) return response;

    const retryRequest = request.clone();
    retryRequest.headers.set("Authorization", `Bearer ${newToken}`);
    return fetch(retryRequest);
  },
};

export const api = createClient<paths>({ baseUrl: BASE_URL });
api.use(authMiddleware);

export function photoUrl(filename: string | null | undefined): string | undefined {
  return filename ? `${BASE_URL}/api/photos/${filename}` : undefined;
}
