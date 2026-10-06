import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import hero from "@/assets/hero.png";
import logo from "@/assets/logo.png";
import { FormField } from "@/components/form-field";
import { Button } from "@matcha/ui/button";
import { Card, CardContent } from "@matcha/ui/card";
import { Input } from "@matcha/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { OAuthButtons } from "@/features/auth/oauth-buttons";
import { apiErrorMessage } from "@/lib/api-error";
import { registerFormSchema, type RegisterFormInput } from "@/lib/schemas";

export function RegisterPage() {
  const { register: doRegister } = useAuth();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormInput>({ resolver: zodResolver(registerFormSchema) });

  const mutation = useMutation({
    mutationFn: ({ confirm_password: _confirm_password, ...input }: RegisterFormInput) => doRegister(input),
    onSuccess: () => setDone(true),
    onError: (error) => toast.error(apiErrorMessage(error, "Could not create your account")),
  });

  if (done) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="font-head text-2xl uppercase tracking-tight">Check your inbox</h1>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to your email. Open it to activate your account.
        </p>
        <Button variant="outline" onClick={() => navigate({ to: "/login" })}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-sm flex-col overflow-hidden px-6 py-8">
      <img
        src={hero}
        alt=""
        className="pointer-events-none absolute top-0 left-1/2 h-72 w-72 -translate-x-1/2 -translate-y-10 opacity-40"
      />

      <div className="relative z-10 flex flex-col items-center gap-1 pb-2">
        <img src={logo} alt="Matcha" className="size-14" />
        <span className="font-head text-base uppercase tracking-tight">Matcha</span>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center gap-6">
        <div>
          <h1 className="font-head text-2xl uppercase tracking-tight">Create your account</h1>
          <p className="text-sm text-muted-foreground">Takes less than a minute.</p>
        </div>

        <Card>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
              <FormField label="Email" error={errors.email?.message}>
                <Input type="email" autoComplete="email" {...register("email")} />
              </FormField>
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
              <FormField label="Password" error={errors.password?.message}>
                <Input type="password" autoComplete="new-password" {...register("password")} />
              </FormField>
              <FormField label="Confirm password" error={errors.confirm_password?.message}>
                <Input type="password" autoComplete="new-password" {...register("confirm_password")} />
              </FormField>

              <Button type="submit" disabled={mutation.isPending} className="mt-2">
                {mutation.isPending ? "Creating…" : "Create account"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <OAuthButtons />

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
