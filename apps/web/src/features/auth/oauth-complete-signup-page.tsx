import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useSearch } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { api } from "@matcha/api-client/client";
import { Button } from "@matcha/ui/button";
import { Card, CardContent } from "@matcha/ui/card";
import { Input } from "@matcha/ui/input";
import { FormField } from "@/components/form-field";
import { useAuth } from "@/features/auth/auth-context";
import { apiErrorMessage } from "@/lib/api-error";
import { completeOAuthSignupSchema, type CompleteOAuthSignupInput } from "@/lib/schemas";

export function OAuthCompleteSignupPage() {
  const search = useSearch({ from: "/oauth/complete-signup" });
  const { completeOAuth } = useAuth();
  const hasEmail = search.email.length > 0;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CompleteOAuthSignupInput>({
    resolver: zodResolver(completeOAuthSignupSchema),
    defaultValues: {
      token: search.token,
      first_name: search.first_name,
      last_name: search.last_name,
      email: search.email || undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: async (input: CompleteOAuthSignupInput) => {
      const { data, error } = await api.POST("/api/auth/oauth/complete", { body: input });
      if (error) throw error;
      if (!data) throw new Error("Empty response");
      return data;
    },
    onSuccess: (data) => {
      completeOAuth(data.access_token, data.refresh_token);
      window.location.href = "/";
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not finish signing up")),
  });

  if (!search.token) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-sm text-destructive">This signup link is missing or invalid.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-8">
      <div>
        <h1 className="font-head text-2xl uppercase tracking-tight">Almost there</h1>
        <p className="text-sm text-muted-foreground">A few more details to finish setting up your account.</p>
      </div>

      <Card>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
            <FormField label="Username" error={errors.username?.message}>
              <Input autoComplete="username" {...register("username")} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First name" error={errors.first_name?.message}>
                <Input {...register("first_name")} />
              </FormField>
              <FormField label="Last name" error={errors.last_name?.message}>
                <Input {...register("last_name")} />
              </FormField>
            </div>
            <FormField label="Birth date" error={errors.birth_date?.message}>
              <Input type="date" {...register("birth_date")} />
            </FormField>
            {hasEmail ? (
              <FormField label="Email">
                <Input value={search.email} disabled readOnly />
              </FormField>
            ) : (
              <FormField label="Email" error={errors.email?.message}>
                <Input type="email" autoComplete="email" {...register("email")} />
              </FormField>
            )}

            <Button type="submit" disabled={mutation.isPending} className="mt-2">
              {mutation.isPending ? "Finishing up…" : "Finish signing up"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
