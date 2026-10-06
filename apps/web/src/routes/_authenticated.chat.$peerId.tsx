import { createFileRoute } from "@tanstack/react-router";

import { ChatThreadPage } from "@/features/chat/chat-thread-page";

export const Route = createFileRoute("/_authenticated/chat/$peerId")({
  staticData: { title: "Chat" },
  component: ChatThreadPage,
});
