import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { OAuthCallbackPage } from "@/features/auth/oauth-callback-page";

const searchSchema = z.object({
  access_token: z.string().catch(""),
  refresh_token: z.string().catch(""),
});

export const Route = createFileRoute("/oauth/callback")({
  validateSearch: searchSchema,
  component: OAuthCallbackPage,
});
