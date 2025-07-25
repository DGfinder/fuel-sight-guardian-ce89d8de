import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useTankGroups } from "@/hooks/useTankGroups";
import { useTanks }      from "@/hooks/useTanks";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import type { Tank }     from "@/types/fuel";
import { supabase } from '@/lib/supabase';
import { Z_INDEX } from '@/lib/z-index';
import { differenceInHours } from 'date-fns';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (groupId: string, tankId: string, dip: number, date: string) => Promise<void>;
  initialGroupId?: string;
  initialTankId?: string;
}

import { schemas, type EditDipFormData } from '@/lib/validation';

// Use centralized validation schema
const editDipSchema = schemas.editDip;

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
  // Debug logging only in development
  if (process.env.NODE_ENV === 'development' && (initialGroupId || initialTankId)) {
    console.log('EditDipModal rendered - isOpen:', isOpen, 'initialGroupId:', initialGroupId, 'initialTankId:', initialTankId);
  }
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
  
  // Delete functionality state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

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
  
  // User permissions for deletion
  const { data: permissions } = useUserPermissions();
  const selectedDip = availableDips.find(d => d.created_at === selectedDate);
  
  // Check if user can delete this dip
  const canDelete = useMemo(() => {
    if (!selectedDip || !permissions) return false;
    
    // Admins can delete any dip
    if (permissions.isAdmin) return true;
    
    // Users can only delete their own dips within 24 hours
    const dipCreatedAt = new Date(selectedDip.created_at);
    const hoursOld = differenceInHours(new Date(), dipCreatedAt);
    
    // For now, we'll allow deletion if it's less than 24 hours old
    // In a more complete implementation, we'd also check if the current user created it
    return hoursOld <= 24;
  }, [selectedDip, permissions]);

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
      .is('archived_at', null) // Only active readings
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
    
    // Basic required field check
    if (!groupId || !tankId || !dipValue || !selectedDate) {
      setSubmitError("All fields are required");
      return;
    }
    
    // Comprehensive validation using Zod schema
    try {
      editDipSchema.parse({ dipValue });
      setSaving(true);
      
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
    } catch (validationError) {
      // Handle validation errors from Zod schema
      if (validationError instanceof z.ZodError) {
        const errorMessage = validationError.errors.map(err => err.message).join(', ');
        setSubmitError(`Validation error: ${errorMessage}`);
      } else {
        setSubmitError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDip || !deleteReason.trim()) {
      setSubmitError("Deletion reason is required");
      return;
    }

    setDeleting(true);
    try {
      // Soft delete: set archived_at, deleted_by, and deletion_reason
      const { error } = await supabase
        .from('dip_readings')
        .update({
          archived_at: new Date().toISOString(),
          deleted_by: userId,
          deletion_reason: deleteReason.trim()
        })
        .eq('id', selectedDip.id);

      if (error) {
        setSubmitError(error.message);
      } else {
        setSubmitSuccess('Dip reading deleted successfully!');
        await queryClient.invalidateQueries({ queryKey: ['tanks'] });
        await queryClient.invalidateQueries({ queryKey: ['tank-history'] });
        setShowDeleteDialog(false);
        setDeleteReason("");
        // Close modal after successful deletion
        setTimeout(() => onClose(), 1000);
      }
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to delete dip reading');
    } finally {
      setDeleting(false);
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
    <>
    <Dialog open={isOpen} onOpenChange={handleModalOpenChange}>
      <DialogContent className="bg-white border shadow-lg max-w-md" style={{ zIndex: Z_INDEX.NESTED_MODAL_CONTENT + 5 }}>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Edit Dip Reading
          </DialogTitle>
          <DialogDescription className="sr-only">
            Edit an existing dip reading for a fuel tank
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Depot Group *</label>
            {isEditMode ? (
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-700">{selectedGroup?.name || groupId}</div>
            ) : (
              <Select value={groupId} onValueChange={setGroupId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select depot group" />
                </SelectTrigger>
                <SelectContent className="z-[1200]">
                  {groups.map(group => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Tank *</label>
            {isEditMode ? (
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-700">{selectedTank?.location || tankId}</div>
            ) : (
              <Select value={tankId} onValueChange={setTankId} required disabled={!groupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tank" />
                </SelectTrigger>
                <SelectContent className="z-[1200]">
                  {tanks.filter(t => t.group_id === groupId).map(tank => (
                    <SelectItem key={tank.id} value={tank.id}>{tank.location}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          {/* Subgroup read-only in edit mode if present */}
          {isEditMode && selectedTank?.subgroup && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Sub-group</label>
              <div className="px-3 py-2 bg-gray-100 rounded text-gray-700">{selectedTank.subgroup}</div>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium">Date *</label>
            <Select value={selectedDate} onValueChange={setSelectedDate} required disabled={!tankId}>
              <SelectTrigger>
                <SelectValue placeholder="Select date" />
              </SelectTrigger>
              <SelectContent className="z-[1200]">
                {availableDips.map(dip => (
                  <SelectItem key={dip.created_at} value={dip.created_at}>{formatDate(dip.created_at)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Dip Reading (litres) *</label>
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
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving || deleting}
              >
                Cancel
              </Button>
              {canDelete && selectedDip && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={saving || deleting}
                >
                  Delete
                </Button>
              )}
              <Button
                type="submit"
                disabled={saving || deleting || !groupId || !tankId || !dipValue.trim().length || !selectedDate}
              >
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Delete confirmation dialog */}
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Dip Reading?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this dip reading? This action cannot be undone.
            <br /><br />
            <strong>Tank:</strong> {selectedTank?.location}<br />
            <strong>Date:</strong> {selectedDate ? formatDate(selectedDate) : 'N/A'}<br />
            <strong>Value:</strong> {dipValue} L
          </AlertDialogDescription>
        </AlertDialogHeader>
        
        <div className="space-y-2 py-4">
          <label className="text-sm font-medium">Reason for deletion *</label>
          <Textarea
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="Please provide a reason for deleting this dip reading..."
            rows={3}
            required
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel 
            onClick={() => {
              setShowDeleteDialog(false);
              setDeleteReason("");
            }}
            disabled={deleting}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting || !deleteReason.trim()}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleting ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>);
} 