import { Button } from "@matcha/ui/button";
import { useOAuthProviders } from "@/features/auth/use-oauth-providers";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function OAuthButtons() {
  const { data: providers } = useOAuthProviders();

  if (!providers || providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or continue with
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="flex flex-col gap-2">
        {providers.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant="outline"
            // Full-page navigation on purpose: this starts a server-driven
            // OAuth redirect flow, not something the fetch-based API client handles.
            onClick={() => {
              window.location.href = `${API_BASE_URL}/api/auth/oauth/${p.id}`;
            }}
          >
            Continue with {p.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
