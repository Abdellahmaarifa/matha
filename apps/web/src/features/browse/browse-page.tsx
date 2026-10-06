import { Heart, RefreshCw, SearchX, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { BROWSE_PAGE_SIZE, type BrowseFilters, useBrowse, useLikeUser } from "@matcha/api-client/hooks";
import type { components } from "@matcha/api-client/schema";
import { Button } from "@matcha/ui/button";
import { Skeleton } from "@matcha/ui/skeleton";
import { FiltersPanel } from "@/features/browse/filters-panel";
import { SwipeCard } from "@/features/browse/swipe-card";
import { apiErrorMessage } from "@/lib/api-error";

type BrowseCard = components["schemas"]["BrowseCard"];
type Direction = "left" | "right";

export function BrowsePage() {
  const [filters, setFilters] = useState<BrowseFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [offset, setOffset] = useState(0);
  const { data, isPending, isError, isFetching, refetch } = useBrowse({ ...filters, offset });
  const like = useLikeUser();

  const [queue, setQueue] = useState<BrowseCard[] | null>(null);
  const [forceExit, setForceExit] = useState<Direction | null>(null);
  const seededKeyRef = useRef<string | null>(null);
  const appliedPageRef = useRef(-1);
  const filtersKey = JSON.stringify(filters);

  // A criteria change starts over from page 0 -- an in-flight "load more"
  // page from the old filters must not get merged into the new stack.
  useEffect(() => {
    setOffset(0);
    setQueue(null);
    seededKeyRef.current = null;
    appliedPageRef.current = -1;
  }, [filtersKey]);

  // Merge each fetched page in exactly once: the first page seeds the swipe
  // stack, later pages (see #5: browse used to hard-cap at 60 suggestions
  // with no way to reach the rest of the pool) are appended to whatever's
  // left in it so swiping never visibly resets.
  useEffect(() => {
    if (!data || appliedPageRef.current === offset) return;
    appliedPageRef.current = offset;
    if (seededKeyRef.current !== filtersKey) {
      setQueue(data);
      seededKeyRef.current = filtersKey;
    } else {
      setQueue((q) => [...(q ?? []), ...data]);
    }
  }, [data, offset, filtersKey]);

  const hasMore = (data?.length ?? 0) === BROWSE_PAGE_SIZE;

  // Fetch the next page automatically once the stack is running low, instead
  // of a "Load more" button that wouldn't fit a swipe-card stack.
  useEffect(() => {
    if (queue && queue.length <= 3 && hasMore && !isFetching && appliedPageRef.current === offset) {
      setOffset((o) => o + BROWSE_PAGE_SIZE);
    }
  }, [queue, hasMore, isFetching, offset]);

  function handleSwiped(profile: BrowseCard, direction: Direction) {
    if (direction === "right") {
      like.mutate(profile.id, {
        onError: (error) => toast.error(apiErrorMessage(error, "Could not update like")),
        onSuccess: (result) => {
          if (result.connected) toast.success("It's a match! You can chat now.");
        },
      });
    }
    setQueue((q) => (q ? q.slice(1) : q));
    setForceExit(null);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!queue || queue.length === 0 || forceExit) return;
      if (e.key === "ArrowLeft") setForceExit("left");
      if (e.key === "ArrowRight") setForceExit("right");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [queue, forceExit]);

  const stack = queue?.slice(0, 3) ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col lg:mx-auto lg:max-w-5xl lg:flex-row lg:gap-8 lg:px-6 lg:py-6">
      <div className="shrink-0 lg:order-2 lg:w-80">
        <div className="flex items-center justify-between px-4 py-2 lg:px-0">
          <p className="text-xs text-muted-foreground">{queue?.length ?? 0} suggested profiles</p>
          <Button variant="ghost" size="sm" onClick={() => setShowFilters((s) => !s)} className="gap-1.5">
            <SlidersHorizontal className="size-3.5" />
            Filters
          </Button>
        </div>
        {showFilters ? <FiltersPanel value={filters} onChange={setFilters} /> : null}
        <p className="hidden px-0 pt-4 text-sm text-muted-foreground lg:block">
          Drag a card left to pass or right to like — or use the buttons under the stack.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center px-4 py-4 lg:order-1 lg:justify-center lg:px-0 lg:py-0">
        {isPending ? (
          <Skeleton className="w-full max-w-sm flex-1" />
        ) : isError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
            <SearchX className="size-10 text-muted-foreground" />
            <p className="text-sm font-medium">Suggestions aren't available right now</p>
            <p className="max-w-xs text-sm text-muted-foreground">Something went wrong on our side. Give it another try in a moment.</p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={isFetching ? "size-3.5 animate-spin" : "size-3.5"} />
              Try again
            </Button>
          </div>
        ) : stack.length > 0 ? (
          <>
            <div className="relative min-h-0 w-full max-w-sm flex-1 lg:max-h-[560px]">
              {stack
                .map((profile, i) => (
                  <SwipeCard
                    key={profile.id}
                    profile={profile}
                    active={i === 0}
                    depth={i}
                    forceExit={i === 0 ? forceExit : null}
                    onExited={(direction) => handleSwiped(profile, direction)}
                  />
                ))
                .reverse()}
            </div>

            <div className="flex shrink-0 justify-center gap-4 py-6">
              <Button
                variant="outline"
                size="icon-lg"
                className="rounded-full border-destructive text-destructive"
                onClick={() => setForceExit("left")}
                disabled={!!forceExit}
                aria-label="Pass"
              >
                <X className="size-6" />
              </Button>
              <Button
                size="icon-lg"
                className="rounded-full"
                onClick={() => setForceExit("right")}
                disabled={!!forceExit}
                aria-label="Like"
              >
                <Heart className="size-6" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center">
            <Heart className="size-10 text-muted-foreground" />
            <p className="text-sm font-medium">No one to show yet</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              No profiles match right now. Try widening your filters or check back later as more people join.
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowFilters(true)}>
              <SlidersHorizontal className="size-3.5" />
              Adjust filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
