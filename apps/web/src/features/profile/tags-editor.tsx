import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useUpdateTags } from "@matcha/api-client/hooks";
import { Badge } from "@matcha/ui/badge";
import { Button } from "@matcha/ui/button";
import { Input } from "@matcha/ui/input";
import { apiErrorMessage } from "@/lib/api-error";

export function TagsEditor({ tags }: { tags: string[] }) {
  const [draft, setDraft] = useState("");
  const updateTags = useUpdateTags();

  function commit(next: string[]) {
    updateTags.mutate(next, {
      onError: (error) => toast.error(apiErrorMessage(error, "Could not update tags")),
    });
  }

  function addTag() {
    const clean = draft.trim().toLowerCase().replace(/^#/, "");
    if (!clean || tags.includes(clean) || tags.length >= 15) {
      setDraft("");
      return;
    }
    commit([...tags, clean]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-3 border-t-2 border-border px-4 py-4">
      <h3 className="font-head text-xs uppercase text-muted-foreground">Interests</h3>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <Badge key={tag} variant="outline" className="gap-1 pr-1">
            #{tag}
            <button onClick={() => commit(tags.filter((t) => t !== tag))} aria-label={`Remove ${tag}`}>
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
          placeholder="Add a tag…"
        />
        <Button type="button" variant="outline" onClick={addTag}>
          Add
        </Button>
      </div>
    </div>
  );
}
