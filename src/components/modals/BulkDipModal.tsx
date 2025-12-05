import React, { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle2, Upload, Download, Calendar, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { getPerthToday } from '@/utils/timezone';
import { useTaTanksCompat as useTanks } from '@/hooks/useTaTanksCompat';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { businessRules } from '@/lib/validation';
import type { Tank } from '@/types/fuel';
import { cn } from '@/lib/utils';
import { Z_INDEX } from '@/lib/z-index';
import CSVImportModal from '@/components/CSVImportModal';

interface BulkDipEntry {
  tankId: string;
  tankLocation: string;
  subgroup: string;
  safeLevel: number;
  currentLevel: number;
  dipValue: string;
  error?: string;
  success?: boolean;
}

interface BulkDipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  groupName: string;
}

export default function BulkDipModal({ open, onOpenChange, groupId, groupName }: BulkDipModalProps) {
  const { tanks, isLoading: tanksLoading } = useTanks();
  const { data: permissions } = useUserPermissions();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dipDate, setDipDate] = useState(new Date(getPerthToday()));
  const [entries, setEntries] = useState<Record<string, BulkDipEntry>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  // Filter tanks for this group and user permissions
  const filteredTanks = useMemo(() => {
    if (!tanks || !groupId) return [];
    
    let groupTanks = tanks.filter(t => t.group_id === groupId);
    
    // Skip subgroup filtering for Kalgoorlie - one person manages all subgroups
    const KALGOORLIE_GROUP_ID = '7e4d01d8-e2d7-4977-9cef-8046d7fbaf1d';
    
    // If user has subgroup restrictions AND this is not Kalgoorlie, filter by those
    const groupPermission = permissions?.accessibleGroups.find(g => g.id === groupId);
    if (groupId !== KALGOORLIE_GROUP_ID && groupPermission && groupPermission.subgroups.length > 0) {
      groupTanks = groupTanks.filter(t => 
        t.subgroup && groupPermission.subgroups.includes(t.subgroup)
      );
    }
    
    return groupTanks;
  }, [tanks, groupId, permissions]);

  // Group tanks by subgroup
  const tanksBySubgroup = useMemo(() => {
    const grouped: Record<string, Tank[]> = {};
    filteredTanks.forEach(tank => {
      const subgroup = tank.subgroup || 'No Subgroup';
      if (!grouped[subgroup]) grouped[subgroup] = [];
      grouped[subgroup].push(tank);
    });
    return grouped;
  }, [filteredTanks]);

  // Initialize entries when modal opens or tanks change
  useEffect(() => {
    if (open && filteredTanks.length > 0) {
      const newEntries: Record<string, BulkDipEntry> = {};
      filteredTanks.forEach(tank => {
        newEntries[tank.id] = {
          tankId: tank.id,
          tankLocation: tank.location || 'Unknown',
          subgroup: tank.subgroup || 'No Subgroup',
          safeLevel: tank.safe_level || 0,
          currentLevel: tank.current_level || 0,
          dipValue: '',
          error: undefined,
          success: false,
        };
      });
      setEntries(newEntries);
    }
  }, [open, filteredTanks]);

  // Get user info
  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setUserProfile(profile);
      }
    };
    fetchUserInfo();
  }, []);

  const handleDipValueChange = (tankId: string, value: string) => {
    setEntries(prev => {
      const entry = prev[tankId];
      if (!entry) return prev;

      // Validate against safe fill level
      let error: string | undefined;
      if (value && !isNaN(Number(value))) {
        const validation = businessRules.validateDipReading(Number(value), entry.safeLevel);
        error = validation.valid ? undefined : validation.error;
      }

      return {
        ...prev,
        [tankId]: {
          ...entry,
          dipValue: value,
          error,
          success: false,
        },
      };
    });
  };

  const getValidEntries = () => {
    return Object.values(entries).filter(
      entry => entry.dipValue && !entry.error && !isNaN(Number(entry.dipValue))
    );
  };

  const handleSubmit = async () => {
    const validEntries = getValidEntries();
    if (validEntries.length === 0) {
      toast({
        title: 'No valid entries',
        description: 'Please enter at least one valid dip reading',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitProgress(0);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Fetch business_id for all tanks in one query
    const tankIds = validEntries.map(e => e.tankId);
    const { data: tankBusinessData } = await supabase
      .from('ta_tanks')
      .select('id, business_id')
      .in('id', tankIds);

    const tankBusinessMap = new Map(tankBusinessData?.map(t => [t.id, t.business_id]) || []);

    // Process in batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < validEntries.length; i += batchSize) {
      const batch = validEntries.slice(i, i + batchSize);

      // Always use Perth time regardless of user's computer timezone
      const now = new Date();
      const perthOffset = 8 * 60; // Perth is UTC+8
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const perthTime = new Date(utc + (perthOffset * 60000));
      const createdAtIso = perthTime.toISOString();

      const batchData = batch.map(entry => ({
        tank_id: entry.tankId,
        business_id: tankBusinessMap.get(entry.tankId),
        level_liters: Number(entry.dipValue),
        measured_at: createdAtIso,
        measured_by: userId,
        measured_by_name: userProfile?.full_name || null,
        method: 'manual',
        source_channel: 'web',
        quality_status: 'ok',
        notes: `Bulk entry for ${groupName}`,
      }));

      try {
        const { error } = await supabase.from('ta_tank_dips').insert(batchData);
        
        if (error) {
          results.failed += batch.length;
          results.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
          
          // Mark entries as failed
          setEntries(prev => {
            const updated = { ...prev };
            batch.forEach(entry => {
              updated[entry.tankId] = {
                ...updated[entry.tankId],
                error: 'Failed to save',
                success: false,
              };
            });
            return updated;
          });
        } else {
          results.success += batch.length;
          
          // Mark entries as successful
          setEntries(prev => {
            const updated = { ...prev };
            batch.forEach(entry => {
              updated[entry.tankId] = {
                ...updated[entry.tankId],
                error: undefined,
                success: true,
              };
            });
            return updated;
          });
        }
      } catch (err) {
        results.failed += batch.length;
        results.errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }

      setSubmitProgress(((i + batch.length) / validEntries.length) * 100);
    }

    setIsSubmitting(false);

    // Invalidate queries to refresh data
    await queryClient.invalidateQueries({ queryKey: ['tanks'] });
    await queryClient.invalidateQueries({ queryKey: ['tank-history'] });
    await queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'recent-dips'
    });

    // Show results
    if (results.failed === 0) {
      toast({
        title: 'Success',
        description: `Successfully saved ${results.success} dip readings`,
      });
      onOpenChange(false);
    } else {
      toast({
        title: 'Partial Success',
        description: `Saved ${results.success} readings, ${results.failed} failed`,
        variant: 'destructive',
      });
    }
  };

  const handleExportTemplate = () => {
    const headers = ['Subgroup', 'Tank Location', 'Tank ID', 'Safe Level', 'Current Level', 'New Dip Reading'];
    const rows = filteredTanks.map(tank => [
      tank.subgroup || 'No Subgroup',
      tank.location || 'Unknown',
      tank.id,
      tank.safe_level || 0,
      tank.current_level || 0,
      '', // Empty for new dip reading
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bulk-dip-template-${groupName}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCSVImport = (readings: Array<{ tank_id: string; value: number }>) => {
    // Update entries with CSV data
    setEntries(prev => {
      const updated = { ...prev };
      readings.forEach(reading => {
        const tank = filteredTanks.find(t => t.id === reading.tank_id);
        if (tank && updated[reading.tank_id]) {
          updated[reading.tank_id].dipValue = reading.value.toString();
          updated[reading.tank_id].error = undefined;
          updated[reading.tank_id].success = false;
        }
      });
      return updated;
    });

    toast({
      title: 'CSV imported successfully',
      description: `${readings.length} dip readings imported`,
    });
  };

  const entriesWithValues = Object.values(entries).filter(e => e.dipValue);
  const entriesWithErrors = Object.values(entries).filter(e => e.error);
  const entriesSuccessful = Object.values(entries).filter(e => e.success);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" style={{ zIndex: Z_INDEX.NESTED_MODAL_CONTENT }}>
        <DialogHeader>
          <DialogTitle>Bulk Dip Entry - {groupName}</DialogTitle>
          <DialogDescription>
            Enter multiple dip readings at once. Readings will be saved with the selected date.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col space-y-4">
          {/* Date Selection */}
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Date:</span>
            </div>
            <Input
              type="date"
              value={dipDate.toISOString().slice(0, 10)}
              onChange={(e) => setDipDate(new Date(e.target.value))}
              max={getPerthToday()}
              className="w-48"
            />
            <div className="ml-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCsvImportOpen(true)}
              >
                <FileText className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportTemplate}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Template
              </Button>
            </div>
          </div>

          {/* Progress Stats */}
          <div className="flex gap-4 text-sm">
            <Badge variant="outline" className="gap-1">
              Total: {filteredTanks.length} tanks
            </Badge>
            <Badge variant="outline" className="gap-1 text-blue-700">
              Entered: {entriesWithValues.length}
            </Badge>
            {entriesWithErrors.length > 0 && (
              <Badge variant="outline" className="gap-1 text-red-700">
                Errors: {entriesWithErrors.length}
              </Badge>
            )}
            {entriesSuccessful.length > 0 && (
              <Badge variant="outline" className="gap-1 text-green-700">
                Saved: {entriesSuccessful.length}
              </Badge>
            )}
          </div>

          {/* Tank Entry Accordions */}
          <div className="flex-1 overflow-y-auto">
            <Accordion type="multiple" className="space-y-2">
              {Object.entries(tanksBySubgroup).map(([subgroup, subgroupTanks]) => (
                <AccordionItem key={subgroup} value={subgroup} className="border rounded-lg">
                  <AccordionTrigger className="px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{subgroup}</span>
                      <Badge variant="outline" className="text-xs">
                        {subgroupTanks.length} tanks
                      </Badge>
                      {subgroupTanks.some(t => entries[t.id]?.dipValue) && (
                        <Badge className="text-xs bg-blue-500">
                          {subgroupTanks.filter(t => entries[t.id]?.dipValue).length} entered
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-2 p-4">
                      {subgroupTanks.map(tank => {
                        const entry = entries[tank.id];
                        if (!entry) return null;

                        return (
                          <div
                            key={tank.id}
                            className={cn(
                              'grid grid-cols-12 gap-4 items-center p-3 rounded-lg border',
                              entry.success && 'bg-green-50 border-green-200',
                              entry.error && 'bg-red-50 border-red-200'
                            )}
                          >
                            <div className="col-span-4">
                              <div className="font-medium">{entry.tankLocation}</div>
                              <div className="text-xs text-muted-foreground">
                                Safe: {entry.safeLevel.toLocaleString()}L | Current: {entry.currentLevel.toLocaleString()}L
                              </div>
                            </div>
                            <div className="col-span-3">
                              <Input
                                type="number"
                                placeholder="Enter dip reading"
                                value={entry.dipValue}
                                onChange={(e) => handleDipValueChange(tank.id, e.target.value)}
                                min={0}
                                max={entry.safeLevel}
                                className={cn(
                                  'w-full',
                                  entry.error && 'border-red-500'
                                )}
                                disabled={isSubmitting || entry.success}
                              />
                            </div>
                            <div className="col-span-5 flex items-center gap-2">
                              {entry.dipValue && !entry.error && (
                                <div className="text-sm text-muted-foreground">
                                  Ullage: {(entry.safeLevel - Number(entry.dipValue)).toLocaleString()}L
                                </div>
                              )}
                              {entry.error && (
                                <div className="flex items-center gap-1 text-red-600 text-sm">
                                  <AlertCircle className="h-4 w-4" />
                                  {entry.error}
                                </div>
                              )}
                              {entry.success && (
                                <div className="flex items-center gap-1 text-green-600 text-sm">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Saved
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Submit Progress */}
          {isSubmitting && (
            <div className="space-y-2">
              <Progress value={submitProgress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                Saving readings... {Math.round(submitProgress)}%
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || getValidEntries().length === 0}
          >
            {isSubmitting ? 'Saving...' : `Save ${getValidEntries().length} Readings`}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* CSV Import Modal */}
      <CSVImportModal
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        onImport={handleCSVImport}
        tanks={filteredTanks.map(tank => ({
          id: tank.id,
          location: tank.location || 'Unknown',
          subgroup: tank.subgroup,
          safe_level: tank.safe_level || 0,
          current_level: tank.current_level || 0,
        }))}
      />
    </Dialog>
  );
}