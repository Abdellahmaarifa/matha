import { Link } from "@tanstack/react-router";

import { photoUrl } from "@matcha/api-client/client";
import { useConversations } from "@matcha/api-client/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@matcha/ui/avatar";
import { Badge } from "@matcha/ui/badge";

export function ConversationsList() {
  const { data } = useConversations();

  if (!data || data.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">Match with someone to start chatting.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5 p-3">
      {data.map((conv) => (
        <Link
          key={conv.id}
          to="/chat/$peerId"
          params={{ peerId: String(conv.id) }}
          className="flex items-center gap-3 rounded border-2 border-border bg-card px-3 py-2.5 shadow-xs transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          activeProps={{ className: "bg-accent" }}
        >
          <Avatar className="size-11">
            <AvatarImage src={photoUrl(conv.photo)} alt={conv.first_name} />
            <AvatarFallback>{conv.first_name.at(0)?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{conv.first_name}</p>
            <p className="truncate text-xs text-muted-foreground">{conv.last_message ?? "Say hi!"}</p>
          </div>
          {conv.unread_count > 0 ? (
            <Badge className="size-5 justify-center rounded-full p-0 text-[10px]">{conv.unread_count}</Badge>
          ) : null}
        </Link>
      ))}
    </div>
  );
}
