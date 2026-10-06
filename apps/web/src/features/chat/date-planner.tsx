import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Check, MapPin, X } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { useCancelDate, useDates, useMe, useProposeDate, useRespondToDate } from "@matcha/api-client/hooks";
import { Badge } from "@matcha/ui/badge";
import { Button } from "@matcha/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@matcha/ui/dialog";
import { Input } from "@matcha/ui/input";
import { Textarea } from "@matcha/ui/textarea";
import { FormField } from "@/components/form-field";
import { apiErrorMessage } from "@/lib/api-error";

const proposeSchema = z.object({
  title: z.string().min(1, "Required").max(120),
  location_label: z.string().min(1, "Required").max(120),
  scheduled_at: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()) && new Date(v) > new Date(), {
    message: "Pick a date and time in the future",
  }),
  note: z.string().max(500).optional(),
});
type ProposeForm = z.infer<typeof proposeSchema>;

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  accepted: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};
const STATUS_VARIANT: Record<string, "secondary" | "default" | "outline"> = {
  pending: "secondary",
  accepted: "default",
  declined: "outline",
  cancelled: "outline",
};

export function DatePlanner({ peerId }: { peerId: number }) {
  const { data: me } = useMe();
  const { data: dates } = useDates(peerId);
  const proposeDate = useProposeDate(peerId);
  const respondToDate = useRespondToDate(peerId);
  const cancelDate = useCancelDate(peerId);
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProposeForm>({ resolver: zodResolver(proposeSchema) });

  const active = (dates ?? []).filter((d) => d.status !== "cancelled" && d.status !== "declined");
  const past = (dates ?? []).filter((d) => d.status === "cancelled" || d.status === "declined");

  function onSubmit(values: ProposeForm) {
    proposeDate.mutate(
      { ...values, scheduled_at: new Date(values.scheduled_at).toISOString() },
      {
        onSuccess: () => {
          toast.success("Date proposed");
          reset();
          setOpen(false);
        },
        onError: (error) => toast.error(apiErrorMessage(error, "Could not propose a date")),
      },
    );
  }

  return (
    <div className="flex flex-col gap-2 border-b-2 border-border px-3 py-2">
      <div className="flex items-center justify-between">
        <h3 className="font-head text-xs uppercase text-muted-foreground">Plan a date</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1.5">
              <CalendarPlus className="size-3.5" />
              Propose
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Propose a real-life date</DialogTitle>
            </DialogHeader>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
              <FormField label="What" error={errors.title?.message}>
                <Input placeholder="Coffee, dinner, a walk…" {...register("title")} />
              </FormField>
              <FormField label="Where" error={errors.location_label?.message}>
                <Input placeholder="Blue Bottle Coffee, 5th Ave…" {...register("location_label")} />
              </FormField>
              <FormField label="When" error={errors.scheduled_at?.message}>
                <Input type="datetime-local" {...register("scheduled_at")} />
              </FormField>
              <FormField label="Note (optional)" error={errors.note?.message}>
                <Textarea rows={2} placeholder="Anything they should know…" {...register("note")} />
              </FormField>
              <DialogFooter>
                <Button type="submit" disabled={proposeDate.isPending}>
                  {proposeDate.isPending ? "Sending…" : "Send proposal"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {active.length > 0 ? (
        <div className="flex flex-col gap-2">
          {active.map((d) => {
            const isRecipient = d.recipient_id === me?.id;
            const when = new Date(d.scheduled_at).toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            });
            return (
              <div key={d.id} className="flex flex-col gap-1 rounded border-2 border-border bg-card px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{d.title}</span>
                  <Badge variant={STATUS_VARIANT[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{when}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3 shrink-0" />
                  {d.location_label}
                </p>
                {d.note ? <p className="text-xs text-muted-foreground">"{d.note}"</p> : null}

                <div className="mt-1 flex gap-1.5">
                  {d.status === "pending" && isRecipient ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() =>
                          respondToDate.mutate(
                            { dateId: d.id, status: "accepted" },
                            { onError: (e) => toast.error(apiErrorMessage(e)) },
                          )
                        }
                      >
                        <Check className="size-3.5" />
                        Accept
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-muted-foreground"
                        onClick={() =>
                          respondToDate.mutate(
                            { dateId: d.id, status: "declined" },
                            { onError: (e) => toast.error(apiErrorMessage(e)) },
                          )
                        }
                      >
                        <X className="size-3.5" />
                        Decline
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="gap-1 text-muted-foreground"
                      onClick={() => cancelDate.mutate(d.id, { onError: (e) => toast.error(apiErrorMessage(e)) })}
                    >
                      <X className="size-3.5" />
                      {d.status === "pending" ? "Cancel proposal" : "Cancel"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {past.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {past.length} earlier {past.length === 1 ? "proposal" : "proposals"} declined or cancelled.
        </p>
      ) : null}
    </div>
  );
}
