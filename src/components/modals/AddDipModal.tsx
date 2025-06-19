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
  DialogDescription,
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
import { Z_INDEX } from '@/lib/z-index';

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
  const [calendarOpen, setCalendarOpen] = useState(false);
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
      ? Math.max(0, selectedTank.safe_level - Number(dipValue))
      : null;

  const resetForm = () => {
    setGroupId("");
    setSubgroup("");
    setTankId("");
    setDipValue("");
    setDipDate(new Date());
    setCalendarOpen(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id || null);
    });
  }, []);

  // Handle auto-close after success with proper cleanup
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (submitSuccess) {
      timeoutId = setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [submitSuccess, onOpenChange]);

  // Add this useEffect to reset the form only when the modal closes
  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

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
        // Coordinate all query invalidations
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['tanks'] }),
          queryClient.invalidateQueries({ queryKey: ['tankHistory'] }),
          queryClient.invalidateQueries({ queryKey: ['tankAlerts'] })
        ]);
        resetForm();
        // Don't auto-close here, let useEffect handle it
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
          <DialogDescription className="sr-only">
            Loading tank data for dip reading form
          </DialogDescription>
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
          <DialogDescription className="sr-only">
            Error loading tank data
          </DialogDescription>
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
      <DialogContent className="max-w-md" style={{ zIndex: Z_INDEX.NESTED_MODAL_CONTENT }}>
        <DialogDescription className="sr-only">
          Record a manual dip reading for a fuel tank
        </DialogDescription>
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
                      Safe&nbsp;{typeof t.safe_level === 'number' ? t.safe_level.toLocaleString() : 'N/A'} L
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date picker - Fallback to native HTML5 date input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                type="date"
                value={dipDate ? dipDate.toISOString().slice(0, 10) : ''}
                onChange={(e) => {
                  console.log('Date input changed:', e.target.value);
                  if (e.target.value) {
                    setDipDate(new Date(e.target.value));
                  }
                }}
                max={new Date().toISOString().slice(0, 10)} // Today
                min={new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)} // 1 year ago
                className="w-full"
              />
            </div>
            {/* Alternative: Popover Calendar (currently disabled for debugging) */}
            <div className="text-xs text-gray-500">
              Fallback to HTML5 date picker due to calendar component issues
            </div>
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
                  {typeof selectedTank.safe_level === 'number' ? selectedTank.safe_level.toLocaleString() : 'N/A'} L
                </span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span>Dip</span>
                <span className="font-semibold">
                  {dipValue !== undefined && dipValue !== null && !isNaN(Number(dipValue)) ? Number(dipValue).toLocaleString() + " L" : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between px-4 py-2">
                <span>Ullage</span>
                <span className="font-semibold">
                  {ullage !== undefined && ullage !== null && !isNaN(Number(ullage)) ? ullage.toLocaleString() + " L" : 'N/A'}
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
