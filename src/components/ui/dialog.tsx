// src/components/modals/AddDipModal.tsx
import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { useTankGroups } from "@/hooks/useTankGroups";
import { useTanks } from "@/hooks/useTanks";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import type { Tank } from "@/types/fuel";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  depotGroupId?: string;
  tankId?: string;
}

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/40 backdrop-blur-sm",
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-white p-6 shadow-lg duration-200 sm:rounded-lg",
        className
      )}
      {...props}
    />
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

export default function AddDipModal({
  open,
  onOpenChange,
  depotGroupId,
  tankId,
}: Props) {
  /* ───────────────────────── State ───────────────────────── */
  const [groupId, setGroupId] = useState(depotGroupId ?? "");
  const [localTankId, setLocalTankId] = useState(tankId ?? "");
  const [dipValue, setDipValue] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);

  /* ──────────────────────── Data hooks ────────────────────── */
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: groups = [], isLoading: groupsLoading } = useTankGroups();
  const { tanks = [], isLoading: tanksLoading } = useTanks();

  /* ───────────────── Form-state sync ──────────────────────── */
  useEffect(() => {
    setGroupId(depotGroupId ?? "");
    setLocalTankId(tankId ?? "");
  }, [depotGroupId, tankId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) =>
      setUser(session?.user || null)
    );
    return () => listener?.subscription.unsubscribe();
  }, []);

  /* ───────────────────── Derived collections ───────────────── */
  const validTanks: Tank[] = useMemo(
    () =>
      tanks.filter(
        (t): t is Tank =>
          !!t && typeof t.id === "string" && typeof t.location === "string"
      ),
    [tanks]
  );

  const tanksForGroup = validTanks.filter(t => t.group_id === groupId);
  const selectedTank = validTanks.find(t => t.id === localTankId);

  const dipNum = parseInt(dipValue, 10);
  const ullage =
    selectedTank && !isNaN(dipNum)
      ? Math.max(0, selectedTank.safe_level - dipNum)
      : null;

  /* ───────────────────────── Submit ───────────────────────── */
  const handleSubmit: React.FormEventHandler = async e => {
    e.preventDefault();
    if (!groupId || !localTankId || !dipValue) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("dip_readings").insert({
        tank_id: localTankId,
        value: dipNum,
        notes: notes || null,
        recorded_by: user?.id ?? "unknown",
      });
      if (error) throw error;

      // optimistic toast
      toast({ title: "Dip reading added", description: `${dipNum.toLocaleString()} L recorded.` });

      // force tables & charts to refresh
      await queryClient.invalidateQueries({ queryKey: ["dips", localTankId] });
      await queryClient.invalidateQueries({ queryKey: ["tanks"] });

      // clear form + close
      setDipValue("");
      setNotes("");
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Failed to add dip",
        description: (err as Error)?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /* ────────────────────────── JSX ─────────────────────────── */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Dim-the-background overlay */}
        <DialogOverlay />

        {/* Modal panel */}
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Dip Reading</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ───── Group ───── */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Depot Group<span className="text-red-500">*</span></label>
              <Select
                value={groupId}
                disabled={!!depotGroupId || groupsLoading}
                onValueChange={val => {
                  setGroupId(val);
                  setLocalTankId(""); // reset tank when group changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select depot group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ───── Tank ───── */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Tank<span className="text-red-500">*</span></label>
              {tanksLoading ? (
                <LoadingSpinner size={16} text="Loading tanks..." />
              ) : (
                <Select
                  value={localTankId}
                  disabled={!groupId || !!tankId}
                  onValueChange={setLocalTankId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose tank" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto">
                    {tanksForGroup.length === 0 && (
                      <div className="p-2 text-sm">No tanks in this group</div>
                    )}
                    {tanksForGroup.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex flex-col">
                          <span>{t.location}</span>
                          <span className="text-xs text-muted-foreground">
                            Safe {t.safe_level.toLocaleString()} L
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* ───── Dip value ───── */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Dip Reading (L)<span className="text-red-500">*</span></label>
              <Input
                type="number"
                value={dipValue}
                onChange={e => setDipValue(e.target.value)}
                placeholder="Enter dip reading"
                min={0}
                required
              />
            </div>

            {/* ───── Live feedback card ───── */}
            {selectedTank && (
              <div className="border rounded-md p-3 bg-white dark:bg-gray-800 shadow-sm space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Safe Fill:</span>
                  <span className="font-semibold">
                    {selectedTank.safe_level.toLocaleString()} L
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Dip:</span>
                  <span className="font-semibold">
                    {dipValue ? Number(dipValue).toLocaleString() + " L" : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Ullage:</span>
                  <span className="font-semibold">
                    {ullage !== null ? ullage.toLocaleString() + " L" : "—"}
                  </span>
                </div>
              </div>
            )}

            {/* ───── Notes ───── */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                rows={3}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes…"
              />
            </div>

            {/* ───── Footer buttons ───── */}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !groupId || !localTankId || !dipValue}
              >
                {submitting ? "Adding…" : "Submit Dip Reading"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
};
