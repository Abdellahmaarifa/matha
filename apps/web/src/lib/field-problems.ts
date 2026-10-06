import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

import { api } from "@matcha/api-client/client";
import type { paths } from "@matcha/api-client/schema";

type SignupFields = NonNullable<paths["/api/auth/validate"]["post"]["requestBody"]>["content"]["application/json"];

// The server owns some rules the client can't check alone (taken usernames
// and emails, the common-password list). Asking first through these pre-check
// endpoints -- which answer 200 either way -- lets a form show those problems
// inline instead of submitting and getting a 400/409 back.

export async function signupFieldProblems(fields: SignupFields): Promise<Record<string, string>> {
  const { data } = await api.POST("/api/auth/validate", { body: fields });
  return data?.fields ?? {};
}

export async function profileFieldProblems(fields: { email?: string }): Promise<Record<string, string>> {
  const { data } = await api.POST("/api/me/validate", { body: fields });
  return data?.fields ?? {};
}

/** Shows each problem under its field; returns true when there was any. */
export function applyFieldProblems<T extends FieldValues>(
  problems: Record<string, string>,
  setError: UseFormSetError<T>,
): boolean {
  const entries = Object.entries(problems);
  for (const [field, message] of entries) {
    setError(field as Path<T>, { type: "server", message }, { shouldFocus: true });
  }
  return entries.length > 0;
}
