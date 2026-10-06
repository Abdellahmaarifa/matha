import { createFileRoute } from "@tanstack/react-router";

import { PublicProfilePage } from "@/features/profile/public-profile-page";

export const Route = createFileRoute("/_authenticated/users/$userId")({
  staticData: { title: "Profile" },
  component: PublicProfilePage,
});
