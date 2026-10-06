import { useEffect, useRef, useState } from "react";

import { Input } from "@matcha/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@matcha/ui/popover";
import { type CitySuggestion, searchCities } from "@/lib/geocoding";

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/** Free-text city search backed by a live worldwide geocoding lookup (debounced). */
export function CityAutocomplete({
  value,
  onChange,
  onSelect,
  onEnter,
  placeholder,
}: {
  value: string;
  onChange: (text: string) => void;
  onSelect?: (city: CitySuggestion) => void;
  onEnter?: () => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<CitySuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const query = value.trim();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      searchCities(query, controller.signal)
        .then(setResults)
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name !== "AbortError") setResults([]);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    // `open` is the single source of truth for visibility -- it is never re-derived
    // from `loading`/`results`, so the list can't flicker open/closed as those settle.
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setOpen(false);
              onEnter?.();
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder ?? "Search a city…"}
        />
      </PopoverAnchor>
      <PopoverContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          // The input is only a Popover *anchor* (for positioning), not a Trigger --
          // Radix's dismissable layer only ever excludes a Trigger from "outside"
          // detection, so without this check every click back into the input while
          // the list is open is treated as an outside click and closes it instantly.
          if (inputRef.current && e.target instanceof Node && inputRef.current.contains(e.target)) {
            e.preventDefault();
            return;
          }
          setOpen(false);
        }}
        className="max-h-56 overflow-y-auto p-1"
      >
        {query.length < MIN_QUERY_LENGTH ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Type at least 2 characters…</p>
        ) : loading ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">Searching…</p>
        ) : results.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">No cities found</p>
        ) : (
          results.map((city, i) => (
            <button
              key={`${city.label}-${i}`}
              type="button"
              className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                onSelect?.(city);
                setOpen(false);
              }}
            >
              {city.label}
            </button>
          ))
        )}
      </PopoverContent>
    </Popover>
  );
}
