import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Send } from "lucide-react";
import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";

import { useMe, useMessages, useSendMessage } from "@matcha/api-client/hooks";
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
  const { data: messages } = useMessages(id);
  const sendMessage = useSendMessage(id);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, reset } = useForm<MessageInput>({ resolver: zodResolver(messageSchema) });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const onSubmit = handleSubmit((values) => {
    sendMessage.mutate(values.body, {
      onError: (error) => toast.error(apiErrorMessage(error, "Could not send message")),
    });
    reset();
  });

  return (
    <div className="flex h-[calc(100dvh-3.25rem-5rem)] flex-col lg:h-full">
      <div className="flex items-center gap-2 border-b-2 border-border px-3 py-2 lg:hidden">
        <Link to="/chat" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Back
        </Link>
      </div>

      <DatePlanner peerId={id} />

      <div className="flex-1 overflow-y-auto px-4 py-3">
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
        <Input placeholder="Message…" aria-label="Message" {...register("body")} autoComplete="off" />
        <Button type="submit" size="icon" disabled={sendMessage.isPending} aria-label="Send message">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
