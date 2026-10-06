import { LocateFixed } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useUpdateLocation } from "@matcha/api-client/hooks";
import { Button } from "@matcha/ui/button";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { reverseGeocodeCity } from "@/lib/geocoding";
import { apiErrorMessage } from "@/lib/api-error";

export function LocationEditor({ currentLabel }: { currentLabel: string | null }) {
  const updateLocation = useUpdateLocation();
  const [busy, setBusy] = useState(false);
  const [cityDraft, setCityDraft] = useState("");

  function useGps() {
    if (!("geolocation" in navigator)) {
      toast.error("Your browser does not support location");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // The API stores exactly the label we send -- it doesn't reverse-geocode
        // GPS coordinates itself, so without this "Location" would show "Not set
        // yet" even after a successful GPS update.
        const label = (await reverseGeocodeCity(latitude, longitude)) ?? undefined;
        updateLocation.mutate(
          { latitude, longitude, source: "gps", label },
          {
            onSuccess: () => toast.success("Location updated from GPS"),
            onError: (error) => toast.error(apiErrorMessage(error, "Could not save location")),
            onSettled: () => setBusy(false),
          },
        );
      },
      () => {
        toast.error("Location permission denied, pick a city instead");
        setBusy(false);
      },
      // High accuracy asks the device for its best GPS fix (vs. the coarse,
      // network/IP-based estimate browsers default to), at the cost of a slower fix.
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t-2 border-border px-4 py-4">
      <h3 className="font-head text-xs uppercase text-muted-foreground">Location</h3>
      <p className="text-sm">{currentLabel ?? "Not set yet"}</p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={useGps} disabled={busy} className="gap-1.5">
          <LocateFixed className="size-3.5" />
          Use GPS
        </Button>
        <div className="w-48">
          <CityAutocomplete
            value={cityDraft}
            onChange={setCityDraft}
            onSelect={(city) => {
              setCityDraft("");
              updateLocation.mutate(
                { latitude: city.lat, longitude: city.lng, source: "manual", label: city.label },
                {
                  onSuccess: () => toast.success(`Location set to ${city.label}`),
                  onError: (error) => toast.error(apiErrorMessage(error, "Could not save location")),
                },
              );
            }}
            placeholder="Search a city…"
          />
        </div>
      </div>
    </div>
  );
}
