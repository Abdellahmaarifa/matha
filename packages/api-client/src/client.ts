import createClient, { type Middleware } from "openapi-fetch";

import type { paths } from "./schema";
import { tokenStore } from "./tokens";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** Refresh this long before the access token actually expires, so a request
 * never goes out with a token the server is about to reject. */
const EXPIRY_MARGIN_MS = 60_000;

/** Fired when the session can't be renewed (refresh token gone or expired). */
export const SESSION_EXPIRED_EVENT = "matcha:session-expired";

// Endpoints that work without (and must not wait on) an access token.
const PUBLIC_PATHS = ["/api/auth/", "/api/photos/"];
const AUTHENTICATED_AUTH_PATHS = ["/api/auth/logout"];

function expiresAtMs(token: string): number | null {
  try {
    const payload = token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload)) as { exp?: number };
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function isUsable(token: string | null, marginMs: number): token is string {
  if (!token) return false;
  const expiresAt = expiresAtMs(token);
  return expiresAt !== null && expiresAt - marginMs > Date.now();
}

/** True when there's a session the client can keep alive without a new login. */
export function hasUsableSession(): boolean {
  return isUsable(tokenStore.getRefresh(), EXPIRY_MARGIN_MS);
}

function endSession() {
  tokenStore.clear();
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.getRefresh();
  // Checked locally first: sending an expired refresh token would only earn a 401.
  if (!isUsable(refreshToken, EXPIRY_MARGIN_MS)) {
    endSession();
    return null;
  }

  const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    endSession();
    return null;
  }
  const data = (await res.json()) as { access_token: string };
  tokenStore.setAccess(data.access_token);
  return data.access_token;
}

function renewAccessToken(): Promise<string | null> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function freshAccessToken(): Promise<string | null> {
  const token = tokenStore.getAccess();
  if (isUsable(token, EXPIRY_MARGIN_MS)) return token;
  return renewAccessToken();
}

function needsAuth(url: string): boolean {
  const { pathname } = new URL(url);
  if (AUTHENTICATED_AUTH_PATHS.some((path) => pathname.startsWith(path))) return true;
  return !PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    if (!needsAuth(request.url)) return request;

    const token = await freshAccessToken();
    if (!token) {
      // No session left: answer locally rather than sending a request the
      // server can only reject (which the browser would log in the console).
      const body = { error: "unauthorized", message: "Your session has expired, please sign in again", fields: {} };
      return new Response(JSON.stringify(body), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
  async onResponse({ request, response }) {
    // Safety net for a token the server rejects despite looking valid here
    // (e.g. the server's secret changed): renew once and replay.
    if (response.status !== 401 || !needsAuth(request.url) || !request.headers.has("Authorization")) {
      return response;
    }
    const newToken = await renewAccessToken();
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
