import { Outlet, createFileRoute } from "@tanstack/react-router";

import { ConversationsList } from "@/features/chat/conversations-list";

export const Route = createFileRoute("/_authenticated/chat")({
  staticData: { fullHeight: true },
  component: ChatLayout,
});

function ChatLayout() {
  return (
    <div className="flex h-full min-h-0 flex-col lg:flex-row">
      <div className="hidden lg:flex lg:min-h-0 lg:w-80 lg:shrink-0 lg:flex-col lg:overflow-y-auto lg:border-r-2 lg:border-border">
        <ConversationsList />
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
