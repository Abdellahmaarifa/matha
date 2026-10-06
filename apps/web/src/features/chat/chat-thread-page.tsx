import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Send } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";

import { photoUrl } from "@matcha/api-client/client";
import { useConversations, useMe, useMessages, useSendMessage } from "@matcha/api-client/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@matcha/ui/avatar";
import { Button } from "@matcha/ui/button";
import { Input } from "@matcha/ui/input";
import { DatePlanner } from "@/features/chat/date-planner";
import { apiErrorMessage } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import { messageSchema, type MessageInput } from "@/lib/schemas";

export function ChatThreadPage() {
  const { peerId } = useParams({ from: "/_authenticated/chat/$peerId" });
  const id = Number(peerId);
  const { data: me } = useMe();
  const { data: conversations, isPending: conversationsPending } = useConversations();
  // The conversations list only holds matched, unblocked users: anyone else's
  // thread would be answered with an error, so it isn't fetched at all.
  const peer = conversations?.find((conv) => conv.id === id);
  const { data: messages } = useMessages(id, !!peer);
  const sendMessage = useSendMessage(id);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, reset } = useForm<MessageInput>({ resolver: zodResolver(messageSchema) });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  // Fetching the thread marks it read server-side; refresh the Chat/Alerts
  // badges now instead of leaving them stale until their next poll.
  const queryClient = useQueryClient();
  const peerUnread = peer?.unread_count ?? 0;
  useEffect(() => {
    if (!messages || peerUnread === 0) return;
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }, [messages, peerUnread, queryClient]);

  const onSubmit = handleSubmit((values) => {
    sendMessage.mutate(values.body, {
      onError: (error) => toast.error(apiErrorMessage(error, "Could not send message")),
    });
    reset();
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b-2 border-border px-3 py-2">
        <Link
          to="/chat"
          aria-label="Back to conversations"
          className="flex items-center text-muted-foreground hover:text-foreground lg:hidden"
        >
          <ArrowLeft className="size-4" />
        </Link>
        {peer ? (
          <Link
            to="/users/$userId"
            params={{ userId: peerId }}
            className="flex min-w-0 items-center gap-2 rounded px-1 py-0.5 hover:bg-accent"
          >
            <Avatar className="size-8">
              <AvatarImage src={photoUrl(peer.photo)} alt={peer.first_name} />
              <AvatarFallback>{peer.first_name.at(0)?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{peer.first_name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {peer.is_online ? "Online" : `@${peer.username}`}
              </p>
            </div>
          </Link>
        ) : null}
      </div>

      {peer ? (
        <DatePlanner peerId={id} />
      ) : (
        <p className="p-4 text-sm text-muted-foreground">
          {conversationsPending ? "Loading…" : "This conversation isn't available. You can only chat with your matches."}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {(messages ?? []).map((message) => {
          const mine = message.sender_id === me?.id;
          return (
            <div key={message.id} className={cn("mb-2 flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[75%] rounded border-2 border-border px-3 py-2 text-sm shadow-xs",
                  mine ? "bg-primary text-primary-foreground" : "bg-card text-foreground",
                )}
              >
                {message.body}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t-2 border-border px-3 py-2">
        <Input placeholder="Message…" aria-label="Message" {...register("body")} autoComplete="off" disabled={!peer} />
        <Button type="submit" size="icon" disabled={!peer || sendMessage.isPending} aria-label="Send message">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
