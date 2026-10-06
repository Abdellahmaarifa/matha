import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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
import { apiErrorMessage } from "@/lib/api-error";
import { loginSchema, type LoginInput } from "@/lib/schemas";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: () => navigate({ to: "/" }),
    onError: (error) => toast.error(apiErrorMessage(error, "Could not sign in")),
  });

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
          <h1 className="font-head text-2xl uppercase tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to keep matching.</p>
        </div>

        <Card>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
              <FormField label="Username or email" error={errors.identifier?.message}>
                <Input autoComplete="username" {...register("identifier")} />
              </FormField>
              <FormField label="Password" error={errors.password?.message}>
                <Input type="password" autoComplete="current-password" {...register("password")} />
              </FormField>

              <Link to="/forgot-password" className="text-right text-xs text-muted-foreground underline underline-offset-4">
                Forgot password?
              </Link>

              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link to="/register" className="text-foreground underline underline-offset-4">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
