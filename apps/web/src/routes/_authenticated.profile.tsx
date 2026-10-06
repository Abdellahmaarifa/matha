import { createFileRoute } from "@tanstack/react-router";

import { MyProfilePage } from "@/features/profile/my-profile-page";

export const Route = createFileRoute("/_authenticated/profile")({
  staticData: { title: "Profile" },
  component: MyProfilePage,
});
