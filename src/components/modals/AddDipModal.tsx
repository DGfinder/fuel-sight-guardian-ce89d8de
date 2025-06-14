/* ──────────────────────────────────────────────────────────────
   AddDipModal.tsx
   Fully-featured modal for recording manual dip readings
   – Group → Sub-group → Tank cascade
   – Live Safe-Fill / Dip / Ullage card
   – Centred dialog with dark overlay (uses the shared Dialog UI)
   – Default export (fixes "Element type is invalid" crash)
──────────────────────────────────────────────────────────────── */

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from '@tanstack/react-query';

import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input }   from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

import { useTankGroups } from "@/hooks/useTankGroups";
import { useTanks }      from "@/hooks/useTanks";
import type { Tank }     from "@/types/fuel";
import { supabase } from '@/lib/supabase';
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fire when the user submits a dip (groupId, tankId, dipValue) */
  onSubmit: (groupId: string, tankId: string, dip: number) => Promise<void>;
  initialGroupId?: string;
  initialTankId?: string;
}

/* -----------------------------------------------------------------------
   Component
------------------------------------------------------------------------ */
export default function AddDipModal({
  open,
  onOpenChange,
  onSubmit,
  initialGroupId = "",
  initialTankId = "",
}: Props) {
  /* ─────────── Data hooks ───────────────────────────────────────── */
  const { data: groups = [], isLoading: groupsLoading } = useTankGroups();
  const { tanks = [], isLoading: tanksLoading, error }  = useTanks();
  const queryClient = useQueryClient();

  /* ─────────── Local state ─────────────────────────────────────── */
  const [groupId,    setGroupId]    = useState(initialGroupId);
  const [subgroup,   setSubgroup]   = useState("");
  const [tankId,     setTankId]     = useState(initialTankId);
  const [dipValue,   setDipValue]   = useState("");
  const [dipDate,    setDipDate]    = useState<Date>(new Date());
  const [saving,     setSaving]     = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  /* ─────────── Derived collections ─────────────────────────────── */
  const tanksForGroup = useMemo(
    () => tanks.filter(t => t.group_id === groupId),
    [tanks, groupId],
  );

  const subgroups = useMemo(
    () => Array.from(
      new Set(
        tanksForGroup
          .map(t => t.subgroup)
          .filter(Boolean)
      )),
    [tanksForGroup],
  );

  const tanksForDropdown = useMemo(
    () => subgroup
      ? tanksForGroup.filter(t => t.subgroup === subgroup)
      : tanksForGroup,
    [tanksForGroup, subgroup],
  );

  /* ─────────── Helpers ─────────────────────────────────────────── */
  const selectedTank: Tank | undefined = tanks.find(t => t.id === tankId);
  const ullage =
    selectedTank && dipValue
      ? Math.max(0, selectedTank.safe_fill - Number(dipValue))
      : null;

  const resetForm = () => {
    setGroupId("");
    setSubgroup("");
    setTankId("");
    setDipValue("");
    setDipDate(new Date());
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id || null);
    });
  }, []);

  /* ─────────── Submit handler ──────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    if (!groupId || !tankId || !dipValue) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('dip_readings').insert({
        tank_id: tankId,
        value: Number(dipValue),
        created_at: dipDate.toISOString(),
        recorded_by: userId,
        notes: null
      });
      if (error) {
        setSubmitError(error.message);
      } else {
        setSubmitSuccess('Dip submitted successfully!');
        await queryClient.invalidateQueries({ queryKey: ['tanks'] });
        resetForm();
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  /* ─────────── Loading / error guards ──────────────────────────── */
  if (tanksLoading || groupsLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center p-10">
            <LoadingSpinner />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (error) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <p className="p-6 text-center text-red-600 text-sm">
            Failed to load tanks:&nbsp;
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  /* ─────────── Render modal ────────────────────────────────────── */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Add Dip Reading
          </DialogTitle>
          <p id="add-dip-desc" className="sr-only">
            Record a manual dip reading for a fuel tank
          </p>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          aria-describedby="add-dip-desc"
          className="space-y-4"
        >
          {submitError && (
            <div className="text-red-600 text-sm">{submitError}</div>
          )}
          {submitSuccess && (
            <div className="text-green-600 text-sm">{submitSuccess}</div>
          )}
          {/* Depot group */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Depot Group <span className="text-red-500">*</span>
            </label>
            <Select
              value={groupId}
              onValueChange={v => {
                setGroupId(v);
                setSubgroup("");
                setTankId("");
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

          {/* Sub-group (only if more than one exists) */}
          {subgroups.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Sub-group</label>
              <Select
                value={subgroup}
                onValueChange={v => {
                  setSubgroup(v);
                  setTankId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All sub-groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {subgroups.map(sg => (
                    <SelectItem key={sg!} value={sg!}>
                      {sg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tank */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Tank <span className="text-red-500">*</span>
            </label>
            <Select
              value={tankId}
              onValueChange={setTankId}
              disabled={!groupId}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    groupId ? "Select tank" : "Choose group first"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {tanksForDropdown.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No tanks in selection
                  </p>
                )}
                {tanksForDropdown.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.location}{" "}
                    <span className="text-xs text-muted-foreground">
                      Safe&nbsp;{t.safe_fill.toLocaleString()} L
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date picker */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Date <span className="text-red-500">*</span>
            </label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dipDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dipDate ? format(dipDate, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dipDate}
                  onSelect={(date) => date && setDipDate(date)}
                  disabled={(date) =>
                    date > new Date() || date < new Date("1900-01-01")
                  }
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Dip reading */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Dip Reading&nbsp;(litres) <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min={0}
              value={dipValue}
              onChange={e => setDipValue(e.target.value)}
              placeholder="Enter dip reading"
              required
            />
          </div>

          {/* Live Safe-fill card */}
          {selectedTank && (
            <div className="mt-2 rounded-lg border divide-y divide-gray-200 bg-gray-50 text-sm">
              <div className="flex justify-between px-4 py-2">
                <span>Safe Fill</span>
                <span className="font-semibold">
                  {selectedTank.safe_fill.toLocaleString()} L
                </span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span>Dip</span>
                <span className="font-semibold">
                  {dipValue
                    ? Number(dipValue).toLocaleString() + " L"
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span>Ullage</span>
                <span className="font-semibold">
                  {ullage !== null
                    ? ullage.toLocaleString() + " L"
                    : "—"}
                </span>
              </div>
            </div>
          )}

          {/* Footer */}
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                saving || !groupId || !tankId || !dipValue.trim().length
              }
            >
              {saving ? "Saving…" : "Submit Dip Reading"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
