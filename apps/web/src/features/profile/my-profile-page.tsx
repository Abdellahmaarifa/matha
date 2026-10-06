import { LogOut, TriangleAlert } from "lucide-react";

import { useLikers, useMe, useVisitors } from "@matcha/api-client/hooks";
import { Button } from "@matcha/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@matcha/ui/tabs";
import { useAuth } from "@/features/auth/auth-context";
import { EditProfileForm } from "@/features/profile/edit-profile-form";
import { LocationEditor } from "@/features/profile/location-editor";
import { PeopleList } from "@/features/profile/people-list";
import { PhotosManager } from "@/features/profile/photos-manager";
import { TagsEditor } from "@/features/profile/tags-editor";

export function MyProfilePage() {
  const { data: me, isPending } = useMe();
  const { data: visitors } = useVisitors();
  const { data: likers } = useLikers();
  const { logout } = useAuth();

  if (isPending || !me) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>;

  const missing = [
    !me.gender ? "gender" : null,
    !me.biography.trim() ? "a short bio" : null,
    me.tags.length === 0 ? "at least one interest tag" : null,
    me.photos.length === 0 ? "at least one photo" : null,
  ].filter((v): v is string => v !== null);

  return (
    <Tabs defaultValue="profile" className="gap-0 lg:mx-auto lg:max-w-5xl lg:px-6 lg:py-6">
      <TabsList className="w-full justify-start rounded-none border-b-2 border-border bg-transparent px-2">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="visitors">Visitors</TabsTrigger>
        <TabsTrigger value="likers">Likers</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="m-0 flex flex-col lg:mx-auto lg:w-full lg:max-w-xl">
        <div className="px-4 pt-4">
          <p className="text-sm font-medium">@{me.username}</p>
        </div>
        {!me.profile_complete ? (
          <div className="mx-4 mt-3 flex items-start gap-2.5 rounded border-2 border-border bg-accent px-3 py-2.5 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p>
              Finish your profile to start browsing and matching -- you still need: {missing.join(", ")}.
            </p>
          </div>
        ) : null}
        <EditProfileForm me={me} />
        <TagsEditor tags={me.tags} />
        <PhotosManager photos={me.photos} />
        <LocationEditor currentLabel={me.location_label} />
        <div className="px-4 py-4">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => logout()}>
            <LogOut className="size-3.5" />
            Log out
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="visitors" className="m-0">
        <PeopleList people={visitors ?? []} emptyLabel="No one has viewed your profile yet." />
      </TabsContent>

      <TabsContent value="likers" className="m-0">
        <PeopleList people={likers ?? []} emptyLabel="No likes yet, keep browsing!" />
      </TabsContent>
    </Tabs>
  );
}
