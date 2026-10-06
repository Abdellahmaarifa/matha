import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { OAuthCompleteSignupPage } from "@/features/auth/oauth-complete-signup-page";

const searchSchema = z.object({
  token: z.string().catch(""),
  first_name: z.string().catch(""),
  last_name: z.string().catch(""),
  email: z.string().catch(""),
});

export const Route = createFileRoute("/oauth/complete-signup")({
  validateSearch: searchSchema,
  component: OAuthCompleteSignupPage,
});
