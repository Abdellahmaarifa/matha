import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { VerifyEmailPage } from "@/features/auth/verify-email-page";

const searchSchema = z.object({
  token: z.string().catch(""),
});

export const Route = createFileRoute("/verify-email")({
  validateSearch: searchSchema,
  component: VerifyEmailPage,
});
