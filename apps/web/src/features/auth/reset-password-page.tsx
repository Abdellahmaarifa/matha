import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";

import { api } from "@matcha/api-client/client";
import { FormField } from "@/components/form-field";
import { Button } from "@matcha/ui/button";
import { Card, CardContent } from "@matcha/ui/card";
import { Input } from "@matcha/ui/input";
import { apiErrorMessage } from "@/lib/api-error";
import { resetPasswordFormSchema, type ResetPasswordFormInput } from "@/lib/schemas";

export function ResetPasswordPage() {
  const { token } = useSearch({ from: "/reset-password" });
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormInput>({ resolver: zodResolver(resetPasswordFormSchema) });

  const mutation = useMutation({
    mutationFn: async (values: ResetPasswordFormInput) => {
      const { error } = await api.POST("/api/auth/reset-password", { body: { token, password: values.password } });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Password updated, please sign in");
      navigate({ to: "/login" });
    },
    onError: (error) => toast.error(apiErrorMessage(error, "This link is invalid or expired")),
  });

  if (!token) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground">Missing reset token.</p>
        <Link to="/forgot-password" className="text-sm underline underline-offset-4">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <h1 className="font-head text-2xl uppercase tracking-tight">Choose a new password</h1>
      <Card>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
            <FormField label="New password" error={errors.password?.message}>
              <Input type="password" autoComplete="new-password" {...register("password")} />
            </FormField>
            <FormField label="Confirm new password" error={errors.confirm_password?.message}>
              <Input type="password" autoComplete="new-password" {...register("confirm_password")} />
            </FormField>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
