/**
 * Dip Reading Mutations with Optimistic Updates
 *
 * Provides mutations for creating, updating, and deleting dip readings
 * with optimistic UI updates for instant feedback.
 *
 * Benefits:
 * - Instant UI updates (feels 3x faster)
 * - Automatic rollback on errors
 * - Better offline experience
 * - Reduced perceived latency
 */

import { useMutation, useQueryClient, UseMutationResult } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { DipReading } from '@/types/fuel';

// ============================================================================
// Types
// ============================================================================

export interface CreateDipInput {
  tank_id: string;
  value: number;
  created_at?: string;
  recorded_by?: string;
  created_by_name?: string;
  notes?: string;
}

export interface UpdateDipInput {
  id: string;
  value?: number;
  notes?: string;
}

export interface ArchiveDipInput {
  id: string;
}

interface OptimisticContext {
  previousTanks?: any;
  previousDips?: any;
}

// ============================================================================
// Create Dip Reading
// ============================================================================

export function useCreateDipReading(): UseMutationResult<
  DipReading,
  Error,
  CreateDipInput,
  OptimisticContext
> {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateDipInput): Promise<DipReading> => {
      const { data, error } = await supabase
        .from('dip_readings')
        .insert(input)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No data returned from insert');

      return {
        id: data.id,
        tank_id: data.tank_id,
        value: data.value,
        created_at: data.created_at,
        recorded_by: input.created_by_name || 'Unknown User',
        notes: data.notes,
        created_by_name: input.created_by_name,
      };
    },

    // Optimistic update: Update UI before server responds
    onMutate: async (newDip) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: ['dip-readings'] });
      await queryClient.cancelQueries({ queryKey: ['tanks'] });

      // Snapshot the previous values
      const previousDips = queryClient.getQueriesData({ queryKey: ['dip-readings'] });
      const previousTanks = queryClient.getQueriesData({ queryKey: ['tanks'] });

      // Optimistically update dip readings list
      queryClient.setQueriesData(
        { queryKey: ['dip-readings'] },
        (old: any) => {
          if (!old?.readings) return old;

          const optimisticDip: DipReading = {
            id: `optimistic-${Date.now()}`, // Temporary ID
            tank_id: newDip.tank_id,
            value: newDip.value,
            created_at: newDip.created_at || new Date().toISOString(),
            recorded_by: newDip.created_by_name || 'You',
            notes: newDip.notes,
            created_by_name: newDip.created_by_name,
          };

          return {
            ...old,
            readings: [optimisticDip, ...old.readings],
            totalCount: old.totalCount + 1,
          };
        }
      );

      // Optimistically update tank current_level
      queryClient.setQueriesData(
        { queryKey: ['tanks'] },
        (old: any) => {
          if (!old?.tanks && !Array.isArray(old)) return old;

          const tanks = old?.tanks || old;
          const updatedTanks = tanks.map((tank: any) =>
            tank.id === newDip.tank_id
              ? {
                  ...tank,
                  current_level: newDip.value,
                  current_level_percent: tank.safe_level
                    ? Math.round((newDip.value / tank.safe_level) * 100)
                    : 0,
                  latest_dip_value: newDip.value,
                  latest_dip_date: newDip.created_at || new Date().toISOString(),
                }
              : tank
          );

          return old?.tanks ? { ...old, tanks: updatedTanks } : updatedTanks;
        }
      );

      return { previousDips, previousTanks };
    },

    // Rollback on error
    onError: (error, newDip, context) => {
      console.error('Error creating dip reading:', error);

      // Restore previous state
      if (context?.previousDips) {
        context.previousDips.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousTanks) {
        context.previousTanks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      toast({
        title: 'Failed to save dip reading',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },

    // Always refetch after success/error to sync with server
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dip-readings'] });
      queryClient.invalidateQueries({ queryKey: ['tanks'] });
      queryClient.invalidateQueries({ queryKey: ['tankHistory'] });
      queryClient.invalidateQueries({ queryKey: ['tankAlerts'] });
    },

    onSuccess: (data, variables) => {
      toast({
        title: 'Dip reading saved',
        description: `${variables.value.toLocaleString()}L recorded successfully`,
      });
    },
  });
}

// ============================================================================
// Update Dip Reading
// ============================================================================

export function useUpdateDipReading(): UseMutationResult<
  DipReading,
  Error,
  UpdateDipInput,
  OptimisticContext
> {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: UpdateDipInput): Promise<DipReading> => {
      const { id, ...updates } = input;

      const { data, error } = await supabase
        .from('dip_readings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      if (!data) throw new Error('No data returned from update');

      return {
        id: data.id,
        tank_id: data.tank_id,
        value: data.value,
        created_at: data.created_at,
        recorded_by: data.created_by_name || 'Unknown User',
        notes: data.notes,
        created_by_name: data.created_by_name,
      };
    },

    onMutate: async (updatedDip) => {
      await queryClient.cancelQueries({ queryKey: ['dip-readings'] });
      const previousDips = queryClient.getQueriesData({ queryKey: ['dip-readings'] });

      // Optimistically update the dip in all queries
      queryClient.setQueriesData(
        { queryKey: ['dip-readings'] },
        (old: any) => {
          if (!old?.readings) return old;

          return {
            ...old,
            readings: old.readings.map((dip: DipReading) =>
              dip.id === updatedDip.id
                ? { ...dip, ...updatedDip }
                : dip
            ),
          };
        }
      );

      return { previousDips };
    },

    onError: (error, updatedDip, context) => {
      console.error('Error updating dip reading:', error);

      if (context?.previousDips) {
        context.previousDips.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      toast({
        title: 'Failed to update dip reading',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dip-readings'] });
    },

    onSuccess: () => {
      toast({
        title: 'Dip reading updated',
        description: 'Changes saved successfully',
      });
    },
  });
}

// ============================================================================
// Archive (Soft Delete) Dip Reading
// ============================================================================

export function useArchiveDipReading(): UseMutationResult<
  void,
  Error,
  ArchiveDipInput,
  OptimisticContext
> {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: ArchiveDipInput): Promise<void> => {
      const { error } = await supabase
        .from('dip_readings')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', input.id);

      if (error) throw error;
    },

    onMutate: async (archivedDip) => {
      await queryClient.cancelQueries({ queryKey: ['dip-readings'] });
      const previousDips = queryClient.getQueriesData({ queryKey: ['dip-readings'] });

      // Optimistically remove from UI
      queryClient.setQueriesData(
        { queryKey: ['dip-readings'] },
        (old: any) => {
          if (!old?.readings) return old;

          return {
            ...old,
            readings: old.readings.filter((dip: DipReading) => dip.id !== archivedDip.id),
            totalCount: Math.max(0, old.totalCount - 1),
          };
        }
      );

      return { previousDips };
    },

    onError: (error, archivedDip, context) => {
      console.error('Error archiving dip reading:', error);

      if (context?.previousDips) {
        context.previousDips.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      toast({
        title: 'Failed to archive dip reading',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dip-readings'] });
      queryClient.invalidateQueries({ queryKey: ['tanks'] });
    },

    onSuccess: () => {
      toast({
        title: 'Dip reading archived',
        description: 'Reading has been removed from active list',
      });
    },
  });
}

// ============================================================================
// Bulk Create Dip Readings
// ============================================================================

export interface BulkCreateDipsInput {
  readings: CreateDipInput[];
  onProgress?: (completed: number, total: number) => void;
}

export function useBulkCreateDipReadings(): UseMutationResult<
  { success: number; failed: number; errors: string[] },
  Error,
  BulkCreateDipsInput
> {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: BulkCreateDipsInput) => {
      const { readings, onProgress } = input;
      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      // Process in batches of 10
      const batchSize = 10;
      for (let i = 0; i < readings.length; i += batchSize) {
        const batch = readings.slice(i, i + batchSize);

        try {
          const { error } = await supabase
            .from('dip_readings')
            .insert(batch);

          if (error) {
            results.failed += batch.length;
            results.errors.push(error.message);
          } else {
            results.success += batch.length;
          }
        } catch (err) {
          results.failed += batch.length;
          results.errors.push(err instanceof Error ? err.message : 'Unknown error');
        }

        // Update progress
        onProgress?.(i + batch.length, readings.length);
      }

      return results;
    },

    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['dip-readings'] });
      queryClient.invalidateQueries({ queryKey: ['tanks'] });

      if (results.failed === 0) {
        toast({
          title: 'All readings saved',
          description: `${results.success} dip readings recorded successfully`,
        });
      } else {
        toast({
          title: 'Partial success',
          description: `${results.success} saved, ${results.failed} failed`,
          variant: 'destructive',
        });
      }
    },

    onError: (error) => {
      toast({
        title: 'Failed to save bulk readings',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });
}
