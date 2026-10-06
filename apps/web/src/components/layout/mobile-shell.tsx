import { Link } from "@tanstack/react-router";
import { Bell, LogOut, Map, MessageCircle, Search, User, Users } from "lucide-react";
import type { ReactNode } from "react";

import { useNotifications } from "@matcha/api-client/hooks";
import logo from "@/assets/logo.png";
import { useAuth } from "@/features/auth/auth-context";

const TABS = [
  { to: "/", label: "Discover", icon: Users, exact: true },
  { to: "/map", label: "Map", icon: Map, exact: false },
  { to: "/search", label: "Search", icon: Search, exact: false },
  { to: "/chat", label: "Chat", icon: MessageCircle, exact: false },
  { to: "/notifications", label: "Alerts", icon: Bell, exact: false },
  { to: "/profile", label: "Me", icon: User, exact: false },
] as const;

export function MobileShell({ title, children }: { title: string; children: ReactNode }) {
  const { data } = useNotifications();
  const { logout } = useAuth();
  const unread = data?.unread_count ?? 0;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col border-x-2 border-border bg-background sm:max-w-lg md:max-w-2xl lg:max-w-none lg:flex-row lg:border-x-0">
      <nav className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:self-start lg:border-r-2 lg:border-border lg:bg-background">
        <div className="flex h-16 items-center gap-2 border-b-2 border-border px-5">
          <img src={logo} alt="" className="size-9" />
          <span className="font-head text-xl uppercase tracking-tight">Matcha</span>
        </div>
        <ul className="flex flex-col gap-1.5 p-3">
          {TABS.map(({ to, label, icon: Icon, exact }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact }}
                className="relative flex items-center gap-3 rounded border-2 border-transparent px-3 py-2.5 font-head text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{
                  className: "border-border bg-primary text-primary-foreground shadow-xs",
                }}
              >
                <Icon className="size-5" strokeWidth={2} />
                {label}
                {to === "/notifications" && unread > 0 ? (
                  <span className="ml-auto flex size-5 items-center justify-center rounded-full border-2 border-border bg-destructive text-[10px] text-destructive-foreground">
                    {unread > 9 ? "9+" : unread}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => logout()}
          className="mt-auto flex items-center gap-3 border-t-2 border-border px-5 py-3 font-head text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <LogOut className="size-5" strokeWidth={2} />
          Log out
        </button>
      </nav>

      <div className="flex h-full min-h-0 flex-1 flex-col lg:min-w-0">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b-2 border-border bg-background px-4">
          <h1 className="font-head text-lg uppercase tracking-tight">{title}</h1>
          {/* Subject requirement: "users must be able to log out with a single
              click from any page on the site." The lg: sidebar already covers
              desktop -- this covers mobile, where that sidebar is hidden. */}
          <button
            type="button"
            onClick={() => logout()}
            aria-label="Log out"
            className="flex size-9 items-center justify-center rounded border-2 border-transparent text-muted-foreground transition-colors hover:border-border hover:text-foreground lg:hidden"
          >
            <LogOut className="size-5" strokeWidth={2} />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto pb-24 lg:pb-6">{children}</main>

        <nav className="fixed bottom-0 left-1/2 z-10 w-full max-w-md -translate-x-1/2 border-t-2 border-border bg-background sm:max-w-lg md:max-w-2xl lg:hidden">
          <ul className="grid grid-cols-6 gap-1.5 p-1.5">
            {TABS.map(({ to, label, icon: Icon, exact }) => (
              <li key={to}>
                <Link
                  to={to}
                  activeOptions={{ exact }}
                  className="relative flex flex-col items-center gap-1 rounded border-2 border-transparent py-2 text-[11px] font-head text-muted-foreground transition-colors hover:text-foreground"
                  activeProps={{
                    className: "border-border bg-primary text-primary-foreground shadow-xs",
                  }}
                >
                  <Icon className="size-5" strokeWidth={2} />
                  {label}
                  {to === "/notifications" && unread > 0 ? (
                    <span className="absolute right-4 top-0.5 flex size-4 items-center justify-center rounded-full border-2 border-border bg-destructive text-[9px] text-destructive-foreground">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
