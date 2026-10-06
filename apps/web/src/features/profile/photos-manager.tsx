import { Plus, Star, Trash2 } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { toast } from "sonner";

import { photoUrl } from "@matcha/api-client/client";
import { useDeletePhoto, useSetProfilePicture, useUploadPhoto } from "@matcha/api-client/hooks";
import type { components } from "@matcha/api-client/schema";
import { PhotoEditorDialog } from "@/features/profile/photo-editor-dialog";
import { apiErrorMessage } from "@/lib/api-error";

type Photo = components["schemas"]["Photo"];

export function PhotosManager({ photos }: { photos: Photo[] }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useUploadPhoto();
  const remove = useDeletePhoto();
  const setProfilePicture = useSetProfilePicture();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function openEditor(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    setPendingFile(file);
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    openEditor(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (photos.length >= 5) return;
    openEditor(e.dataTransfer.files?.[0]);
  }

  function saveEdited(blob: Blob) {
    const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
    upload.mutate(file, {
      onSuccess: () => setPendingFile(null),
      onError: (error) => toast.error(apiErrorMessage(error, "Could not upload photo")),
    });
  }

  const slots = [...photos.sort((a, b) => a.position - b.position)];

  return (
    <div className="flex flex-col gap-3 border-t-2 border-border px-4 py-4">
      <h3 className="font-head text-xs uppercase text-muted-foreground">Photos ({photos.length}/5)</h3>
      <div
        className={`grid grid-cols-3 gap-2 rounded transition-colors ${dragOver ? "outline-2 outline-dashed outline-primary" : ""}`}
        onDragOver={(e) => {
          if (photos.length >= 5) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {slots.map((photo) => (
          <div key={photo.id} className="group relative aspect-square overflow-hidden rounded border-2 border-border bg-muted">
            <img src={photoUrl(photo.filename)} alt="" className="size-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/40 py-1">
              <button
                aria-label="Set as profile picture"
                onClick={() => setProfilePicture.mutate(photo.id)}
                className="rounded p-1 text-white"
              >
                <Star className="size-3.5" fill={photo.is_profile ? "currentColor" : "none"} />
              </button>
              <button
                aria-label="Delete photo"
                onClick={() => remove.mutate(photo.id, { onError: (e) => toast.error(apiErrorMessage(e)) })}
                className="rounded p-1 text-white"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}

        {photos.length < 5 ? (
          <button
            onClick={() => fileInput.current?.click()}
            disabled={upload.isPending}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-border text-muted-foreground"
          >
            <Plus className="size-5" />
            <span className="text-[10px]">{dragOver ? "Drop to add" : upload.isPending ? "Uploading…" : "Add"}</span>
          </button>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">Drag and drop an image here, or click Add. You can crop, rotate and apply a filter before saving.</p>
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFile} />

      <PhotoEditorDialog
        file={pendingFile}
        saving={upload.isPending}
        onCancel={() => setPendingFile(null)}
        onSave={saveEdited}
      />
    </div>
  );
}
