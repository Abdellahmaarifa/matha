import { Link } from "@tanstack/react-router";
import { MapPin, Sparkles } from "lucide-react";

import { photoUrl } from "@matcha/api-client/client";
import { Avatar, AvatarFallback, AvatarImage } from "@matcha/ui/avatar";
import { Badge } from "@matcha/ui/badge";
import type { components } from "@matcha/api-client/schema";

type BrowseCard = components["schemas"]["BrowseCard"];

export function ProfileCard({ profile }: { profile: BrowseCard }) {
  return (
    <Link
      to="/users/$userId"
      params={{ userId: String(profile.id) }}
      className="flex items-center gap-3 rounded border-2 border-border bg-card px-3 py-2.5 shadow-xs transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
    >
      <Avatar className="size-12">
        <AvatarImage src={photoUrl(profile.photo)} alt={profile.first_name} />
        <AvatarFallback>{profile.first_name.at(0)?.toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">
            {profile.first_name}, {profile.age}
          </p>
          {profile.is_online ? <span role="status" aria-label="Online" className="size-1.5 rounded-full bg-emerald-500" /> : null}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {profile.location_label ? (
            <span className="flex items-center gap-0.5">
              <MapPin className="size-3" />
              {profile.location_label}
              {profile.distance_km != null ? ` · ${Math.round(profile.distance_km)} km` : ""}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <Badge variant="secondary" className="gap-1 text-[10px]">
          <Sparkles className="size-3" />
          {profile.fame_rating}
        </Badge>
        {profile.shared_tags > 0 ? (
          <span className="text-[10px] text-muted-foreground">{profile.shared_tags} shared tags</span>
        ) : null}
      </div>
    </Link>
  );
}
