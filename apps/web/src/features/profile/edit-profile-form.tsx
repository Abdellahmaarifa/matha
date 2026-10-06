import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useUpdateMe } from "@matcha/api-client/hooks";
import type { components } from "@matcha/api-client/schema";
import { FormField } from "@/components/form-field";
import { Button } from "@matcha/ui/button";
import { Input } from "@matcha/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@matcha/ui/select";
import { Textarea } from "@matcha/ui/textarea";
import { apiErrorMessage } from "@/lib/api-error";
import { editProfileSchema, GENDERS, ORIENTATIONS, type EditProfileInput } from "@/lib/schemas";

type Me = components["schemas"]["Me"];

export function EditProfileForm({ me }: { me: Me }) {
  const updateMe = useUpdateMe();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditProfileInput>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      first_name: me.first_name,
      last_name: me.last_name,
      email: me.email,
      gender: (me.gender as EditProfileInput["gender"]) ?? "other",
      sexual_pref: (me.sexual_pref as EditProfileInput["sexual_pref"]) ?? "bisexual",
      biography: me.biography,
    },
  });

  useEffect(() => {
    reset({
      first_name: me.first_name,
      last_name: me.last_name,
      email: me.email,
      gender: (me.gender as EditProfileInput["gender"]) ?? "other",
      sexual_pref: (me.sexual_pref as EditProfileInput["sexual_pref"]) ?? "bisexual",
      biography: me.biography,
    });
  }, [me, reset]);

  const onSubmit = handleSubmit((values) => {
    updateMe.mutate(values, {
      onSuccess: () => toast.success("Profile updated"),
      onError: (error) => toast.error(apiErrorMessage(error, "Could not update profile")),
    });
  });

  return (
    <form className="flex flex-col gap-4 px-4 py-4" onSubmit={onSubmit}>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="First name" error={errors.first_name?.message}>
          <Input {...register("first_name")} />
        </FormField>
        <FormField label="Last name" error={errors.last_name?.message}>
          <Input {...register("last_name")} />
        </FormField>
      </div>

      <FormField label="Email" error={errors.email?.message}>
        <Input type="email" {...register("email")} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Gender">
          <Select value={watch("gender")} onValueChange={(v) => setValue("gender", v as EditProfileInput["gender"], { shouldDirty: true })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GENDERS.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Looking for">
          <Select
            value={watch("sexual_pref")}
            onValueChange={(v) => setValue("sexual_pref", v as EditProfileInput["sexual_pref"], { shouldDirty: true })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ORIENTATIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <FormField label="Biography" error={errors.biography?.message}>
        <Textarea rows={4} {...register("biography")} />
      </FormField>

      <Button type="submit" disabled={!isDirty || updateMe.isPending} className="self-start">
        {updateMe.isPending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
