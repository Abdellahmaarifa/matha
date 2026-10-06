import { Link } from "@tanstack/react-router";

import { photoUrl } from "@matcha/api-client/client";
import { Avatar, AvatarFallback, AvatarImage } from "@matcha/ui/avatar";
import { Badge } from "@matcha/ui/badge";

interface PersonRow {
  id: number;
  username: string;
  first_name: string;
  fame_rating: number;
  photo: string | null;
  /** Set on the Visitors list: when they last viewed this profile. */
  visited_at?: string;
  /** Set on the Visitors list: how many times they've viewed this profile. */
  visit_count?: number;
  /** Set on the Likers list: when they liked this profile. */
  liked_at?: string;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function PeopleList({ people, emptyLabel }: { people: PersonRow[]; emptyLabel: string }) {
  if (people.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-2.5 p-3 lg:grid-cols-2 xl:grid-cols-3">
      {people.map((person) => {
        const when = person.visited_at ?? person.liked_at;
        return (
          <Link
            key={person.id}
            to="/users/$userId"
            params={{ userId: String(person.id) }}
            className="flex items-center gap-3 rounded border-2 border-border bg-card px-3 py-2.5 shadow-xs transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <Avatar className="size-10">
              <AvatarImage src={photoUrl(person.photo)} alt={person.first_name} />
              <AvatarFallback>{person.first_name.at(0)?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm">{person.first_name}</p>
              {when ? (
                <p className="truncate text-xs text-muted-foreground">
                  {formatRelativeTime(when)}
                  {person.visit_count && person.visit_count > 1 ? ` · visited ${person.visit_count}×` : ""}
                </p>
              ) : null}
            </div>
            <Badge variant="secondary" className="text-[10px]">
              Fame {person.fame_rating}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}
