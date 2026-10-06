import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "@tanstack/react-router";

import { api } from "@matcha/api-client/client";
import { FormField } from "@/components/form-field";
import { Button } from "@matcha/ui/button";
import { Card, CardContent } from "@matcha/ui/card";
import { Input } from "@matcha/ui/input";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/schemas";

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const mutation = useMutation({
    mutationFn: async (input: ForgotPasswordInput) => {
      const { error } = await api.POST("/api/auth/forgot-password", { body: input });
      if (error) throw error;
    },
    onSuccess: () => setSent(true),
  });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6 py-10">
      <div>
        <h1 className="font-head text-2xl uppercase tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground">We'll email you a reset link.</p>
      </div>

      {sent ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              If that email exists, a reset link is on its way.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
              <FormField label="Email" error={errors.email?.message}>
                <Input type="email" {...register("email")} />
              </FormField>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Link to="/login" className="text-center text-sm underline underline-offset-4">
        Back to sign in
      </Link>
    </div>
  );
}
