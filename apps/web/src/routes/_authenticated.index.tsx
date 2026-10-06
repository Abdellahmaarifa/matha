import { createFileRoute } from "@tanstack/react-router";

import { BrowsePage } from "@/features/browse/browse-page";

export const Route = createFileRoute("/_authenticated/")({
  staticData: { title: "Discover" },
  component: BrowsePage,
});
