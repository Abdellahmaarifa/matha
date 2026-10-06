import { Link } from "@tanstack/react-router";
import { Calendar, CalendarCheck, CalendarX, Heart, HeartCrack, MessageCircle, Sparkles, Eye } from "lucide-react";

import { photoUrl } from "@matcha/api-client/client";
import { useMarkAllNotificationsRead, useNotifications } from "@matcha/api-client/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@matcha/ui/avatar";
import { Button } from "@matcha/ui/button";

const ICONS = {
  like: Heart,
  unlike: HeartCrack,
  view: Eye,
  message: MessageCircle,
  match: Sparkles,
  date_proposed: Calendar,
  date_accepted: CalendarCheck,
  date_declined: CalendarX,
  date_cancelled: CalendarX,
};

const LABELS: Record<string, string> = {
  like: "liked your profile",
  unlike: "removed their like",
  view: "viewed your profile",
  message: "sent you a message",
  match: "matched with you",
  date_proposed: "proposed a date",
  date_accepted: "confirmed your date",
  date_declined: "declined your date",
  date_cancelled: "cancelled a date",
};

export function NotificationsPage() {
  const { data } = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  return (
    <div className="flex flex-col lg:mx-auto lg:max-w-5xl lg:px-6 lg:py-6">
      {data && data.unread_count > 0 ? (
        <div className="flex justify-end px-4 py-2">
          <Button variant="ghost" size="sm" onClick={() => markAllRead.mutate()}>
            Mark all read
          </Button>
        </div>
      ) : null}

      {!data || data.items.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 p-3 lg:grid-cols-2">
          {data.items.map((n) => {
            const Icon = ICONS[n.type as keyof typeof ICONS] ?? Sparkles;
            const className = `flex items-center gap-3 rounded border-2 border-border px-3 py-2.5 shadow-xs transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${n.is_read ? "bg-card" : "bg-accent"}`;
            const content = (
              <>
                <Avatar className="size-9">
                  <AvatarImage src={photoUrl(n.actor_photo)} />
                  <AvatarFallback>{n.actor_first_name?.at(0)?.toUpperCase() ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 text-sm">
                  <span className="font-medium">{n.actor_first_name ?? "Someone"}</span>{" "}
                  {LABELS[n.type] ?? n.type}
                </div>
                <Icon className="size-4 text-muted-foreground" />
              </>
            );
            if (!n.actor_id) {
              return (
                <div key={n.id} className={className}>
                  {content}
                </div>
              );
            }
            // A "new message" notification should open the conversation, not
            // the sender's profile -- everything else still points at the
            // profile the notification is about. Date notifications need the
            // same treatment: the only UI that can respond to a date
            // proposal (the date planner) lives inside the chat thread page.
            if (
              n.type === "message" ||
              n.type === "date_proposed" ||
              n.type === "date_accepted" ||
              n.type === "date_declined" ||
              n.type === "date_cancelled"
            ) {
              return (
                <Link key={n.id} to="/chat/$peerId" params={{ peerId: String(n.actor_id) }} className={className}>
                  {content}
                </Link>
              );
            }
            return (
              <Link key={n.id} to="/users/$userId" params={{ userId: String(n.actor_id) }} className={className}>
                {content}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
