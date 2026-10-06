import { createFileRoute } from "@tanstack/react-router";

import { ConversationsList } from "@/features/chat/conversations-list";

export const Route = createFileRoute("/_authenticated/chat/")({
  staticData: { title: "Messages" },
  component: ChatIndexPage,
});

function ChatIndexPage() {
  return (
    <>
      <div className="lg:hidden">
        <ConversationsList />
      </div>
      <div className="hidden h-full flex-col items-center justify-center gap-2 p-8 text-center lg:flex">
        <p className="font-head text-lg uppercase tracking-tight">Your messages</p>
        <p className="text-sm text-muted-foreground">Select a conversation to start chatting.</p>
      </div>
    </>
  );
}
