import { Link } from "@tanstack/react-router";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { useBrowse, useMe } from "@matcha/api-client/hooks";
import { photoUrl } from "@matcha/api-client/client";
import type { components } from "@matcha/api-client/schema";
import { Skeleton } from "@matcha/ui/skeleton";

type BrowseCard = components["schemas"]["BrowseCard"];

// A round profile-photo pin per user instead of Leaflet's default blue marker.
function profileIcon(profile: Pick<BrowseCard, "photo" | "first_name">) {
  return L.divIcon({
    className: "",
    html: renderToStaticMarkup(
      <div className="flex size-9 items-center justify-center overflow-hidden rounded-full border-2 border-card bg-muted shadow-md">
        {profile.photo ? (
          <img src={photoUrl(profile.photo)} alt="" className="size-full object-cover" />
        ) : (
          <span className="font-head text-xs text-muted-foreground">{profile.first_name.at(0)?.toUpperCase()}</span>
        )}
      </div>,
    ),
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

const SELF_ICON = L.divIcon({
  className: "",
  html: renderToStaticMarkup(
    <div className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-primary shadow-md">
      <div className="size-2 rounded-full bg-primary-foreground" />
    </div>,
  ),
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const DEFAULT_CENTER: [number, number] = [20, 0];
const DEFAULT_ZOOM = 2;
const LOCATED_ZOOM = 12;

export function MapPage() {
  const { data: me, isPending: mePending } = useMe();
  const { data: profiles, isPending: profilesPending } = useBrowse({});
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Center on the current user once we know where they are.
  useEffect(() => {
    if (!mapRef.current || !me?.latitude || !me?.longitude) return;
    mapRef.current.setView([me.latitude, me.longitude], LOCATED_ZOOM);
  }, [me?.latitude, me?.longitude]);

  // Redraw markers whenever the candidate list or the user's own position changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    if (me?.latitude && me?.longitude) {
      L.marker([me.latitude, me.longitude], { icon: SELF_ICON }).addTo(layer).bindPopup("You are here");
    }

    for (const profile of profiles ?? []) {
      if (profile.latitude == null || profile.longitude == null) continue;
      const popupHtml = renderToStaticMarkup(
        <div className="flex items-center gap-2 text-sm">
          {profile.photo ? (
            <img src={photoUrl(profile.photo)} alt="" className="size-10 shrink-0 rounded object-cover" />
          ) : null}
          <div className="flex flex-col gap-0.5">
            <p className="font-medium">
              {profile.first_name}, {profile.age}
            </p>
            {profile.distance_km != null ? (
              <p className="text-xs text-muted-foreground">{Math.round(profile.distance_km)} km away</p>
            ) : null}
            <a href={`/users/${profile.id}`} className="text-xs font-medium text-primary underline">
              View profile
            </a>
          </div>
        </div>,
      );
      L.marker([profile.latitude, profile.longitude], { icon: profileIcon(profile) }).addTo(layer).bindPopup(popupHtml);
    }
  }, [profiles, me?.latitude, me?.longitude]);

  const loading = mePending || profilesPending;

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      {loading ? <Skeleton className="absolute inset-2 z-[1000] rounded" /> : null}
      {!mePending && !me?.latitude ? (
        <div className="absolute inset-x-2 top-2 z-[1000] rounded border-2 border-border bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
          Set your location on your{" "}
          <Link to="/profile" className="font-medium text-primary underline">
            profile
          </Link>{" "}
          to center the map on you.
        </div>
      ) : null}
      <div ref={containerRef} className="size-full" />
    </div>
  );
}
