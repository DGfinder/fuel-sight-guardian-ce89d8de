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
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useTankGroups } from "@/hooks/useTankGroups";
import { useTanks }      from "@/hooks/useTanks";
import type { Tank }     from "@/types/fuel";
import { supabase } from '@/lib/supabase';
import { Z_INDEX } from '@/lib/z-index';
import { Label } from "@/components/ui/label";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (groupId: string, tankId: string, dip: number, date: string) => Promise<void>;
  initialGroupId?: string;
  initialTankId?: string;
}

function formatDate(dateString: string) {
  return dateString.split('T')[0];
}

export default function EditDipModal({
  isOpen,
  onClose,
  onSubmit,
  initialGroupId = "",
  initialTankId = "",
}: Props) {
  console.log('EditDipModal rendered', { isOpen, initialGroupId, initialTankId });
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

  const isEditMode = !!initialTankId;
  const selectedTank = tanks.find(t => t.id === tankId);
  const selectedGroup = groups.find(g => g.id === groupId);

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

  // Handle auto-close after success with proper cleanup
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (submitSuccess) {
      timeoutId = setTimeout(() => {
        onClose();
      }, 1000);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [submitSuccess, onClose]);

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

  // Update state when initial props change (when modal opens with new tank)
  useEffect(() => {
    if (isOpen) {
      console.log('EditDipModal opening with:', { initialGroupId, initialTankId });
      setGroupId(initialGroupId);
      setTankId(initialTankId);
      
      // Set subgroup if the tank has one
      const tank = tanks.find(t => t.id === initialTankId);
      if (tank?.subgroup) {
        setSubgroup(tank.subgroup);
      } else {
        setSubgroup("");
      }
      
      setDipValue("");
      setSelectedDate("");
      setSubmitError(null);
      setSubmitSuccess(null);
    }
  }, [isOpen, initialGroupId, initialTankId, tanks]);

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
        // Don't auto-close here, let useEffect handle it
      }
    } finally {
      setSaving(false);
    }
  };

  if (tanksLoading || groupsLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogDescription className="sr-only">
            Loading tank data for edit dip reading form
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
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <DialogDescription className="sr-only">
            Error loading tank data for edit dip reading form
          </DialogDescription>
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

  // Handle cleanup when modal closes
  const handleModalOpenChange = (open: boolean) => {
    if (!open) {
      // Force remove any pointer-events styling that might be stuck
      setTimeout(() => {
        document.body.style.removeProperty('pointer-events');
      }, 100);
      handleClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleModalOpenChange}>
      <DialogContent className="bg-white border shadow-lg max-w-md" style={{ zIndex: Z_INDEX.NESTED_MODAL_CONTENT + 5 }}>
        <DialogDescription className="sr-only">
          {isEditMode ? 'Edit an existing dip reading.' : 'Add a new dip reading.'}
        </DialogDescription>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>Depot Group *</Label>
            {isEditMode ? (
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-700">{selectedGroup?.name || groupId}</div>
            ) : (
              <Select value={groupId} onValueChange={setGroupId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select depot group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Tank *</Label>
            {isEditMode ? (
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-700">{selectedTank?.location || tankId}</div>
            ) : (
              <Select value={tankId} onValueChange={setTankId} required disabled={!groupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tank" />
                </SelectTrigger>
                <SelectContent>
                  {tanks.filter(t => t.group_id === groupId).map(tank => (
                    <SelectItem key={tank.id} value={tank.id}>{tank.location}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Date *</Label>
            <Select value={selectedDate} onValueChange={setSelectedDate} required disabled={!tankId}>
              <SelectTrigger>
                <SelectValue placeholder="Select date" />
              </SelectTrigger>
              <SelectContent className="z-[1100]">
                {availableDips.map(dip => (
                  <SelectItem key={dip.created_at} value={dip.created_at}>{formatDate(dip.created_at)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dip Reading (litres) *</Label>
            <Input
              type="number"
              value={dipValue}
              onChange={e => setDipValue(e.target.value)}
              placeholder="Enter dip reading"
              required
              disabled={!tankId}
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