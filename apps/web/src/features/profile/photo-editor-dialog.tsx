import { RotateCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@matcha/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@matcha/ui/dialog";
import { Label } from "@matcha/ui/label";
import { Slider } from "@matcha/ui/slider";

const FRAME_SIZE = 280;
const OUTPUT_SIZE = 480;
const MAX_ZOOM = 3;

const FILTERS = [
  { id: "none", label: "Original", css: "none" },
  { id: "mono", label: "Mono", css: "grayscale(1) contrast(1.05)" },
  { id: "sepia", label: "Sepia", css: "sepia(0.75) saturate(1.1)" },
  { id: "vivid", label: "Vivid", css: "saturate(1.6) contrast(1.12)" },
  { id: "cool", label: "Cool", css: "hue-rotate(200deg) saturate(1.15) brightness(1.02)" },
  { id: "fade", label: "Fade", css: "contrast(0.85) brightness(1.1) saturate(0.7)" },
] as const;

export function PhotoEditorDialog({
  file,
  onCancel,
  onSave,
  saving,
}: {
  file: File | null;
  onCancel: () => void;
  onSave: (blob: Blob) => void;
  saving: boolean;
}) {
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [filterId, setFilterId] = useState<(typeof FILTERS)[number]["id"]>("none");
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // A fresh object URL is a pure function of `file`, so it's derived during render
  // rather than pushed into state from an effect; a separate effect only revokes it.
  const imgUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (imgUrl) URL.revokeObjectURL(imgUrl);
    };
  }, [imgUrl]);

  // Reset the editing state whenever a new file comes in. This is the
  // React-endorsed "adjust state during render" pattern (not an effect): it
  // reacts to the prop change directly instead of a setState-in-effect render cascade.
  const [lastFile, setLastFile] = useState(file);
  if (file !== lastFile) {
    setLastFile(file);
    setNaturalSize({ w: 0, h: 0 });
    setRotation(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFilterId("none");
  }

  const filter = FILTERS.find((f) => f.id === filterId) ?? FILTERS[0];

  // "Cover" scale for the frame, computed from the image's own (unrotated) natural
  // size -- since the frame is square, rotating the fully-covering content by 90°
  // steps still fully covers it, so rotation never needs to change this.
  const coverScale = useMemo(() => {
    if (!naturalSize.w || !naturalSize.h) return 1;
    return Math.max(FRAME_SIZE / naturalSize.w, FRAME_SIZE / naturalSize.h);
  }, [naturalSize]);

  const displayScale = coverScale * zoom;
  const drawW = naturalSize.w * displayScale;
  const drawH = naturalSize.h * displayScale;

  function rotate() {
    setRotation((r) => (r + 90) % 360);
    // Rotating changes what "centered" looks like -- reset pan/zoom rather than
    // try to carry over an offset that no longer means the same thing.
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
  function onPointerUp() {
    dragRef.current = null;
  }

  function save() {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = OUTPUT_SIZE / FRAME_SIZE;
    ctx.filter = filter.css;
    ctx.save();
    ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    const outW = drawW * ratio;
    const outH = drawH * ratio;
    ctx.drawImage(img, -outW / 2 + pan.x * ratio, -outH / 2 + pan.y * ratio, outW, outH);
    ctx.restore();
    canvas.toBlob((blob) => blob && onSave(blob), "image/jpeg", 0.92);
  }

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit photo</DialogTitle>
        </DialogHeader>

        <div
          className="mx-auto overflow-hidden rounded border-2 border-border bg-muted"
          style={{ width: FRAME_SIZE, height: FRAME_SIZE }}
        >
          <div
            className="relative size-full touch-none"
            style={{ transform: `rotate(${rotation}deg)`, filter: filter.css }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {imgUrl ? (
              <img
                ref={imgRef}
                src={imgUrl}
                alt=""
                draggable={false}
                onLoad={(e) => {
                  const el = e.currentTarget;
                  setNaturalSize({ w: el.naturalWidth, h: el.naturalHeight });
                }}
                className="absolute top-1/2 left-1/2 max-w-none cursor-grab active:cursor-grabbing"
                style={{
                  width: drawW || undefined,
                  height: drawH || undefined,
                  transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
                }}
              />
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon-sm" onClick={rotate} aria-label="Rotate 90°">
              <RotateCw className="size-4" />
            </Button>
            <div className="flex-1">
              <Label className="mb-1 text-xs font-normal text-muted-foreground">Zoom</Label>
              <Slider min={1} max={MAX_ZOOM} step={0.05} value={[zoom]} onValueChange={([z]) => setZoom(z ?? 1)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterId(f.id)}
                className={`rounded border-2 px-2 py-1 text-xs transition-colors ${
                  f.id === filterId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={save} disabled={saving || !imgUrl}>
            {saving ? "Uploading…" : "Save photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
