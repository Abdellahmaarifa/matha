import { Outlet, createFileRoute } from "@tanstack/react-router";

import { ConversationsList } from "@/features/chat/conversations-list";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  return (
    <div className="flex flex-col lg:h-[calc(100dvh-3.25rem)] lg:flex-row">
      <div className="hidden lg:flex lg:w-80 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r-2 lg:border-border">
        <ConversationsList />
      </div>
      <div className="flex-1 lg:min-w-0 lg:overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
