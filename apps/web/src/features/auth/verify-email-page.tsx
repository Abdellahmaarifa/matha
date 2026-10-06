import { useQuery } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";

import { api } from "@matcha/api-client/client";
import { Card, CardContent } from "@matcha/ui/card";
import { apiErrorMessage } from "@/lib/api-error";

export function VerifyEmailPage() {
  const { token } = useSearch({ from: "/verify-email" });

  const { isPending, isError, error } = useQuery({
    queryKey: ["verify-email", token],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/auth/verify-email", { params: { query: { token } } });
      if (error) throw error;
      return data;
    },
    enabled: token.length > 0,
    retry: false,
  });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center gap-6 px-6 text-center">
      <Card className="w-full">
        <CardContent className="flex flex-col items-center gap-2 text-center">
          {!token ? (
            <p className="text-sm text-muted-foreground">Missing verification token.</p>
          ) : isPending ? (
            <p className="text-sm text-muted-foreground">Verifying your account…</p>
          ) : isError ? (
            <p className="text-sm text-destructive">{apiErrorMessage(error, "This link is invalid or expired.")}</p>
          ) : (
            <>
              <h1 className="font-head text-2xl uppercase tracking-tight">Account verified</h1>
              <p className="text-sm text-muted-foreground">You can sign in now.</p>
            </>
          )}
        </CardContent>
      </Card>
      <Link to="/login" className="text-sm underline underline-offset-4">
        Go to sign in
      </Link>
    </div>
  );
}
