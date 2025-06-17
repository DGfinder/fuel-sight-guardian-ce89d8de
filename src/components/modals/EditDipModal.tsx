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
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useTankGroups } from "@/hooks/useTankGroups";
import { useTanks }      from "@/hooks/useTanks";
import type { Tank }     from "@/types/fuel";
import { supabase } from '@/lib/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (groupId: string, tankId: string, dip: number, date: string) => Promise<void>;
  initialGroupId?: string;
  initialTankId?: string;
}

export default function EditDipModal({
  isOpen,
  onClose,
  onSubmit,
  initialGroupId = "",
  initialTankId = "",
}: Props) {
  const { data: groups = [], isLoading: groupsLoading } = useTankGroups();
  const { tanks = [], isLoading: tanksLoading, error }  = useTanks();
  const queryClient = useQueryClient();

  const [groupId,    setGroupId]    = useState(initialGroupId);
  const [subgroup,   setSubgroup]   = useState("");
  const [tankId,     setTankId]     = useState(initialTankId);
  const [dipValue,   setDipValue]   = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [saving,     setSaving]     = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [availableDips, setAvailableDips] = useState<{ value: number, created_at: string, id: string }[]>([]);

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

  const selectedTank: Tank | undefined = tanks.find(t => t.id === tankId);

  // Fetch available dips for selected tank
  useEffect(() => {
    if (!tankId) {
      setAvailableDips([]);
      setSelectedDate("");
      setDipValue("");
      return;
    }
    supabase
      .from('dip_readings')
      .select('id, value, created_at')
      .eq('tank_id', tankId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setAvailableDips(data || []);
        if (data && data.length > 0) {
          setSelectedDate(data[0].created_at);
          setDipValue(data[0].value.toString());
        } else {
          setSelectedDate("");
          setDipValue("");
        }
      });
  }, [tankId]);

  // When date changes, update dip value
  useEffect(() => {
    if (!selectedDate) return;
    const dip = availableDips.find(d => d.created_at === selectedDate);
    setDipValue(dip ? dip.value.toString() : "");
  }, [selectedDate, availableDips]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id || null);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    if (!groupId || !tankId || !dipValue || !selectedDate) return;
    setSaving(true);
    try {
      // Find the dip reading id for the selected date
      const dip = availableDips.find(d => d.created_at === selectedDate);
      if (!dip) throw new Error("Dip reading not found for selected date");
      const { error } = await supabase
        .from('dip_readings')
        .update({ value: Number(dipValue), recorded_by: userId })
        .eq('id', dip.id);
      if (error) {
        setSubmitError(error.message);
      } else {
        setSubmitSuccess('Dip updated successfully!');
        await queryClient.invalidateQueries({ queryKey: ['tanks'] });
        if (onSubmit) await onSubmit(groupId, tankId, Number(dipValue), selectedDate);
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (tanksLoading || groupsLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
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
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <p className="p-6 text-center text-red-600 text-sm">
            Failed to load tanks:&nbsp;
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  const handleClose = () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="z-[65] bg-white border shadow-lg max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Edit Dip Reading
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
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
              onValueChange={v => setTankId(v)}
              disabled={!groupId}
            >
              <SelectTrigger>
                <SelectValue placeholder={groupId ? "Select tank" : "Choose group first"} />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto">
                {tanksForDropdown.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No tanks in selection
                  </p>
                )}
                {tanksForDropdown.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.location} <span className="text-xs text-muted-foreground">Safe&nbsp;{t.safe_fill.toLocaleString()} L</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Date */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Date <span className="text-red-500">*</span>
            </label>
            <Select
              value={selectedDate}
              onValueChange={(value) => {
                setSelectedDate(value);
                const selectedDip = availableDips.find(d => d.created_at === value);
                if (selectedDip) {
                  setDipValue(selectedDip.value.toString());
                }
              }}
              disabled={!tankId || availableDips.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={tankId ? (availableDips.length ? "Select date" : "No dips found") : "Choose tank first"} />
              </SelectTrigger>
              <SelectContent className="max-h-60 overflow-y-auto z-[75]">
                {availableDips.length === 0 && (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No dips for this tank
                  </p>
                )}
                {availableDips.map(dip => (
                  <SelectItem key={dip.id} value={dip.created_at}>
                    {new Date(dip.created_at).toLocaleString()} ({dip.value.toLocaleString()} L)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Dip value */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Dip Reading (litres) <span className="text-red-500">*</span>
            </label>
            <Input
              type="number"
              min={0}
              value={dipValue}
              onChange={e => setDipValue(e.target.value)}
              placeholder="Enter dip reading"
              required
              disabled={!selectedDate}
            />
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !groupId || !tankId || !dipValue.trim().length || !selectedDate}
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 