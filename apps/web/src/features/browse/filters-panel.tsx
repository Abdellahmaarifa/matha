import { X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import type { BrowseFilters } from "@matcha/api-client/hooks";
import { Badge } from "@matcha/ui/badge";
import { Button } from "@matcha/ui/button";
import { Input } from "@matcha/ui/input";
import { Label } from "@matcha/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@matcha/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@matcha/ui/select";
import { Slider } from "@matcha/ui/slider";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { TAG_POOL } from "@/lib/tags-data";

const SORT_OPTIONS = [
  { value: "", label: "Suggested" },
  { value: "age", label: "Age" },
  { value: "location", label: "Distance" },
  { value: "fame_rating", label: "Fame rating" },
  { value: "tags", label: "Shared tags" },
];

function TagsFilterField({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    return TAG_POOL.filter((t) => !value.includes(t) && (q === "" || t.includes(q)));
  }, [draft, value]);

  function addTag(tag: string) {
    const clean = tag.trim().toLowerCase();
    if (!clean || value.includes(clean)) return;
    onChange([...value, clean]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="outline" className="gap-1 pr-1">
              #{tag}
              <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      {/* `open` is the single source of truth for visibility -- it is never re-derived
          from `suggestions.length`, so the list can't flicker open/closed as it changes. */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag(suggestions[0] ?? draft);
                setOpen(false);
              } else if (e.key === "Escape") {
                setOpen(false);
              } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
                onChange(value.slice(0, -1));
              }
            }}
            placeholder="Start typing to pick tags…"
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
          {suggestions.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No matching tags</p>
          ) : (
            suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                className="block w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  addTag(tag);
                  setOpen(false);
                }}
              >
                #{tag}
              </button>
            ))
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function FiltersPanel({
  value,
  onChange,
}: {
  value: BrowseFilters;
  onChange: (next: BrowseFilters) => void;
}) {
  const [ageRange, setAgeRange] = useState<[number, number]>([value.min_age ?? 18, value.max_age ?? 60]);
  const [fameRange, setFameRange] = useState<[number, number]>([value.min_fame ?? 0, value.max_fame ?? 100]);
  const [location, setLocation] = useState(value.location ?? "");
  const [tags, setTags] = useState<string[]>(value.tags ? value.tags.split(",").map((t) => t.trim()).filter(Boolean) : []);

  function apply(overrides?: Partial<{ location: string; tags: string[] }>) {
    const nextLocation = overrides?.location ?? location;
    const nextTags = overrides?.tags ?? tags;
    onChange({
      ...value,
      min_age: ageRange[0],
      max_age: ageRange[1],
      min_fame: fameRange[0],
      max_fame: fameRange[1],
      location: nextLocation || undefined,
      tags: nextTags.length > 0 ? nextTags.join(",") : undefined,
    });
  }

  return (
    // @container: the grid below responds to this panel's own rendered width, not the
    // viewport -- it goes multi-column when the panel is wide (e.g. the Search page,
    // where it shares the page's full max-width with the results grid) but stays
    // single-column when it's embedded somewhere narrow (e.g. Discover's sidebar column).
    <div className="@container border-b-2 border-border bg-accent px-4 py-4">
      <div className="grid grid-cols-1 gap-5 @lg:grid-cols-3 @lg:gap-x-5 @lg:gap-y-5">
        <div className="flex flex-col gap-1.5">
          <Label>Sort by</Label>
          <Select
            value={value.sort ?? ""}
            onValueChange={(sort) =>
              onChange({ ...value, sort: (sort.trim() || undefined) as BrowseFilters["sort"] })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Suggested" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value || " "}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Location contains</Label>
          <CityAutocomplete
            value={location}
            onChange={setLocation}
            onSelect={(city) => setLocation(city.label)}
            onEnter={() => apply()}
            placeholder="New York…"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Tags</Label>
          <TagsFilterField value={tags} onChange={setTags} />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="flex justify-between text-xs font-normal text-muted-foreground">
            <span>Age</span>
            <span>
              {ageRange[0]} – {ageRange[1]}
            </span>
          </Label>
          <Slider
            min={18}
            max={90}
            step={1}
            value={ageRange}
            onValueChange={(v) => setAgeRange(v as [number, number])}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="flex justify-between text-xs font-normal text-muted-foreground">
            <span>Fame rating</span>
            <span>
              {fameRange[0]} – {fameRange[1]}
            </span>
          </Label>
          <Slider
            min={0}
            max={100}
            step={1}
            value={fameRange}
            onValueChange={(v) => setFameRange(v as [number, number])}
          />
        </div>
      </div>

      <Button onClick={() => apply()} size="sm" className="mt-5 w-full @lg:w-auto">
        Apply filters
      </Button>
    </div>
  );
}
