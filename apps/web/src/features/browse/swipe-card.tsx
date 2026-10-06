import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Info, MapPin, Sparkles } from "lucide-react";

import { photoUrl } from "@matcha/api-client/client";
import type { components } from "@matcha/api-client/schema";
import { Badge } from "@matcha/ui/badge";

type BrowseCard = components["schemas"]["BrowseCard"];
type Direction = "left" | "right";

const SWIPE_THRESHOLD = 120;
const EXIT_DISTANCE = 700;
const EXIT_DURATION = 260;

export function SwipeCard({
  profile,
  active,
  depth,
  forceExit,
  onExited,
}: {
  profile: BrowseCard;
  active: boolean;
  depth: number;
  forceExit: Direction | null;
  onExited: (direction: Direction) => void;
}) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState<Direction | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (forceExit && active && !exiting) setExiting(forceExit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceExit]);

  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => onExited(exiting), EXIT_DURATION);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exiting]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!active || exiting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    setDrag({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y });
  }

  function onPointerUp() {
    if (!startRef.current) return;
    startRef.current = null;
    setDragging(false);
    if (Math.abs(drag.x) > SWIPE_THRESHOLD) {
      setExiting(drag.x > 0 ? "right" : "left");
    } else {
      setDrag({ x: 0, y: 0 });
    }
  }

  const x = exiting ? (exiting === "right" ? EXIT_DISTANCE : -EXIT_DISTANCE) : drag.x;
  const y = exiting ? drag.y - 60 : drag.y;
  const rotate = exiting ? (exiting === "right" ? 24 : -24) : drag.x / 18;

  const style: React.CSSProperties = active
    ? {
        transform: `translate(${x}px, ${y}px) rotate(${rotate}deg)`,
        transition: dragging ? "none" : `transform ${EXIT_DURATION}ms ease`,
      }
    : {
        transform: `scale(${1 - depth * 0.04}) translateY(${depth * 12}px)`,
      };

  const likeOpacity = Math.min(Math.max(drag.x, 0) / 100, 1);
  const nopeOpacity = Math.min(Math.max(-drag.x, 0) / 100, 1);

  return (
    <div
      className="absolute inset-0 flex touch-none select-none flex-col overflow-hidden rounded border-2 border-border bg-card shadow-lg"
      style={{ ...style, zIndex: 10 - depth, cursor: active ? (dragging ? "grabbing" : "grab") : "default" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="relative flex-1 bg-muted">
        {profile.photo ? (
          <img src={photoUrl(profile.photo)} alt={profile.first_name} className="size-full object-cover" draggable={false} />
        ) : (
          <div className="flex size-full items-center justify-center font-head text-6xl text-muted-foreground">
            {profile.first_name.at(0)?.toUpperCase()}
          </div>
        )}

        {active ? (
          <>
            <span
              className="absolute top-6 left-6 rotate-[-12deg] rounded border-2 border-primary bg-card px-3 py-1 font-head text-2xl uppercase text-primary shadow-md"
              style={{ opacity: likeOpacity }}
            >
              Like
            </span>
            <span
              className="absolute top-6 right-6 rotate-[12deg] rounded border-2 border-destructive bg-card px-3 py-1 font-head text-2xl uppercase text-destructive shadow-md"
              style={{ opacity: nopeOpacity }}
            >
              Nope
            </span>
            <Link
              to="/users/$userId"
              params={{ userId: String(profile.id) }}
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded border-2 border-border bg-card/90 px-2.5 py-1.5 text-xs font-head text-foreground shadow-sm"
              aria-label="View full profile and all photos"
            >
              <Info className="size-3.5" />
              Profile
            </Link>
          </>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 pt-14 pb-6 text-white">
          <div className="flex items-center gap-2">
            <h2 className="font-head text-xl">
              {profile.first_name}, {profile.age}
            </h2>
            {profile.is_online ? <span role="status" aria-label="Online" className="size-2 shrink-0 rounded-full bg-emerald-400" /> : null}
          </div>
          {profile.location_label ? (
            <p className="mt-0.5 mb-4 flex items-center gap-1 text-xs text-white/90">
              <MapPin className="size-3 shrink-0" />
              {profile.location_label}
              {profile.distance_km != null ? ` · ${Math.round(profile.distance_km)} km` : ""}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Sparkles className="size-3" />
              {profile.fame_rating}
            </Badge>
            {profile.shared_tags > 0 ? (
              <Badge variant="outline" className="border-white/60 bg-transparent text-[10px] text-white">
                {profile.shared_tags} shared tags
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
