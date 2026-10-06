import { createFileRoute } from "@tanstack/react-router";

import { MapPage } from "@/features/map/map-page";

export const Route = createFileRoute("/_authenticated/map")({
  staticData: { title: "Map" },
  component: MapPage,
});
