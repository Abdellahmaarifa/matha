import { Flag, Heart, MessageCircle, ShieldOff } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import { toast } from "sonner";

import { photoUrl } from "@matcha/api-client/client";
import { useBlockUser, useLikeUser, useReportUser, useUnlikeUser, useUserProfile } from "@matcha/api-client/hooks";
import { Avatar, AvatarFallback, AvatarImage } from "@matcha/ui/avatar";
import { Badge } from "@matcha/ui/badge";
import { Button } from "@matcha/ui/button";
import { Card, CardContent } from "@matcha/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@matcha/ui/dialog";
import { apiErrorMessage } from "@/lib/api-error";
import { REPORT_REASONS } from "@/lib/schemas";

export function PublicProfilePage() {
  const { userId } = useParams({ from: "/_authenticated/users/$userId" });
  const id = Number(userId);
  const navigate = useNavigate();
  const { data: profile, isPending, isError } = useUserProfile(id);

  const like = useLikeUser();
  const unlike = useUnlikeUser();
  const block = useBlockUser();
  const report = useReportUser();
  const [reportOpen, setReportOpen] = useState(false);

  if (isPending) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;
  if (isError || !profile) return <p className="p-4 text-sm text-destructive">Profile not found.</p>;

  const mainPhoto = profile.photos.find((p) => p.is_profile) ?? profile.photos[0];

  function titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function toggleLike() {
    if (like.isPending || unlike.isPending) return;
    const onError = (error: unknown) => toast.error(apiErrorMessage(error, "Could not update like"));

    if (profile!.liked_by_me) {
      unlike.mutate(id, { onError });
    } else {
      like.mutate(id, {
        onError,
        onSuccess: (result) => {
          if (result.connected) toast.success("It's a match! You can chat now.");
        },
      });
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 lg:mx-auto lg:max-w-xl lg:px-6 lg:py-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 text-center">
          <Avatar className="size-24">
            <AvatarImage src={photoUrl(mainPhoto?.filename)} alt={profile.first_name} />
            <AvatarFallback className="text-lg">{profile.first_name.at(0)?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-head text-lg uppercase tracking-tight">
              {profile.first_name} {profile.last_name}, {profile.age}
            </h2>
            <p className="text-xs text-muted-foreground">@{profile.username}</p>
            <p className="text-xs text-muted-foreground">
              {profile.is_online ? "Online now" : profile.last_seen_at ? `Last seen ${new Date(profile.last_seen_at).toLocaleString()}` : "Offline"}
            </p>
          </div>

          {/* Subject requirement (IV.5): "Profiles should display all available
              information except for the email address and password" -- gender
              and sexual preference are mandatory profile fields but weren't
              being rendered here even though the API already returns them. */}
          <div className="flex flex-wrap justify-center gap-1.5">
            <Badge variant="secondary">Fame {profile.fame_rating}</Badge>
            {profile.gender ? <Badge variant="outline">{titleCase(profile.gender)}</Badge> : null}
            {profile.sexual_pref ? <Badge variant="outline">{titleCase(profile.sexual_pref)}</Badge> : null}
            {profile.location_label ? <Badge variant="outline">{profile.location_label}</Badge> : null}
            {profile.likes_me ? <Badge>Likes you</Badge> : null}
            {profile.connected ? <Badge variant="default">Connected</Badge> : null}
          </div>

          {profile.photos.length > 1 ? (
            <div className="flex gap-2 overflow-x-auto pt-1">
              {profile.photos.map((photo) => (
                <img
                  key={photo.id}
                  src={photoUrl(photo.filename)}
                  alt=""
                  className="size-16 shrink-0 rounded border-2 border-border object-cover"
                />
              ))}
            </div>
          ) : null}

          <div className="flex w-full gap-2 pt-2">
            <Button
              className="flex-1 gap-1.5"
              variant={profile.liked_by_me ? "outline" : "default"}
              onClick={toggleLike}
              disabled={like.isPending || unlike.isPending}
            >
              <Heart className="size-4" fill={profile.liked_by_me ? "currentColor" : "none"} />
              {profile.liked_by_me ? "Liked" : "Like"}
            </Button>
            {profile.connected ? (
              <Button
                className="flex-1 gap-1.5"
                variant="secondary"
                onClick={() => navigate({ to: "/chat/$peerId", params: { peerId: String(id) } })}
              >
                <MessageCircle className="size-4" />
                Chat
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {profile.biography ? (
        <Card>
          <CardContent>
            <h3 className="mb-1 font-head text-xs uppercase text-muted-foreground">About</h3>
            <p className="text-sm">{profile.biography}</p>
          </CardContent>
        </Card>
      ) : null}

      {profile.tags.length > 0 ? (
        <Card>
          <CardContent>
            <h3 className="mb-2 font-head text-xs uppercase text-muted-foreground">Interests</h3>
            <div className="flex flex-wrap gap-1.5">
              {profile.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  #{tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="flex justify-center gap-6 py-2 text-xs text-muted-foreground">
        <button
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => block.mutate(id, { onSuccess: () => navigate({ to: "/" }) })}
        >
          <ShieldOff className="size-3.5" />
          Block
        </button>

        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-1 hover:text-foreground">
              <Flag className="size-3.5" />
              Report
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report this profile</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              {REPORT_REASONS.map((reason) => (
                <Button
                  key={reason}
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() =>
                    report.mutate(
                      { userId: id, reason },
                      {
                        onSuccess: () => {
                          toast.success("Thanks, we received your report");
                          setReportOpen(false);
                        },
                      },
                    )
                  }
                >
                  {reason.replaceAll("_", " ")}
                </Button>
              ))}
            </div>
            <DialogFooter />
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
