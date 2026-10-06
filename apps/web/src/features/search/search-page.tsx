import { useEffect, useState } from "react";

import { BROWSE_PAGE_SIZE, type BrowseFilters, useSearch } from "@matcha/api-client/hooks";
import type { components } from "@matcha/api-client/schema";
import { Button } from "@matcha/ui/button";
import { Skeleton } from "@matcha/ui/skeleton";
import { FiltersPanel } from "@/features/browse/filters-panel";
import { ProfileCard } from "@/features/browse/profile-card";

type BrowseCard = components["schemas"]["BrowseCard"];

export function SearchPage() {
  const [filters, setFilters] = useState<BrowseFilters>({});
  const [offset, setOffset] = useState(0);
  const [results, setResults] = useState<BrowseCard[]>([]);
  const { data, isPending, isFetching, isError } = useSearch({ ...filters, offset });

  // A criteria change starts a fresh result set at page 0 -- otherwise we'd
  // be appending page-2-of-the-old-filters onto page-1-of-the-new-filters.
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    setOffset(0);
    setResults([]);
  }, [filtersKey]);

  // Browse/search only ever return one page at a time (see PAGE_SIZE
  // server-side), so accumulate pages here instead of replacing the list --
  // that's what makes "Load more" append rather than reset the view.
  useEffect(() => {
    if (!data) return;
    setResults((prev) => (offset === 0 ? data : [...prev, ...data]));
  }, [data, offset]);

  const hasMore = (data?.length ?? 0) === BROWSE_PAGE_SIZE;

  return (
    <div className="flex flex-col lg:mx-auto lg:max-w-5xl lg:px-6 lg:py-6">
      <FiltersPanel value={filters} onChange={setFilters} />

      {isPending ? (
        <div className="flex flex-col gap-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : isError ? (
        <p className="p-4 text-sm text-destructive">Search failed.</p>
      ) : results.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-2.5 p-3 lg:grid-cols-2 xl:grid-cols-3">
            {results.map((profile) => (
              <ProfileCard key={profile.id} profile={profile} />
            ))}
          </div>
          {hasMore ? (
            <div className="flex justify-center pb-6">
              <Button variant="outline" onClick={() => setOffset((o) => o + BROWSE_PAGE_SIZE)} disabled={isFetching}>
                {isFetching ? "Loading…" : "Load more"}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="p-4 text-sm text-muted-foreground">No results. Adjust your criteria above.</p>
      )}
    </div>
  );
}
