import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { useConversations } from "@matcha/api-client/hooks";

/**
 * Subject requirement: "the user must be able to see from any page if a new
 * message is received". Mounted once in the shell, this returns the total
 * unread count (for the Chat tab badge) and pops a toast whenever a peer's
 * unread count goes up -- except for the thread the user is already reading.
 * Rides the conversations poll (5s), inside the subject's 10s budget.
 */
export function useNewMessageAlerts(): number {
  const { data } = useConversations();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const seen = useRef<Map<number, number> | null>(null);

  useEffect(() => {
    if (!data) return;
    const previous = seen.current;
    seen.current = new Map(data.map((conv) => [conv.id, conv.unread_count]));
    // First load: just record the baseline, don't toast for old messages.
    if (!previous) return;
    for (const conv of data) {
      if (conv.unread_count <= (previous.get(conv.id) ?? 0)) continue;
      if (pathname === `/chat/${conv.id}`) continue;
      toast(`New message from ${conv.first_name}`, {
        id: `message-${conv.id}`,
        description: conv.last_message ?? undefined,
        action: {
          label: "Open",
          onClick: () => navigate({ to: "/chat/$peerId", params: { peerId: String(conv.id) } }),
        },
      });
    }
  }, [data, pathname, navigate]);

  return data?.reduce((total, conv) => total + conv.unread_count, 0) ?? 0;
}
