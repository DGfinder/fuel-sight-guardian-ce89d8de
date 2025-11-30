/**
 * useDipReadingsCrud Hook
 * CRUD operations for Dip Readings with archive functionality
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { DipReading, DipFilters, DipReadingFormData } from '@/types/admin';

const defaultFilters: DipFilters = {
  search: '',
  tankId: null,
  dateFrom: null,
  dateTo: null,
  valueMin: null,
  valueMax: null,
  includeArchived: false,
};

export function useDipReadingsCrud(filters: Partial<DipFilters> = {}) {
  const queryClient = useQueryClient();
  const appliedFilters = { ...defaultFilters, ...filters };

  // Fetch dip readings with tank info
  const readingsQuery = useQuery({
    queryKey: ['admin-dip-readings', appliedFilters],
    queryFn: async (): Promise<DipReading[]> => {
      let query = supabase
        .from('dip_readings')
        .select(`
          *,
          fuel_tanks(location, tank_groups(name))
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (!appliedFilters.includeArchived) {
        query = query.is('archived_at', null);
      }

      if (appliedFilters.tankId) {
        query = query.eq('tank_id', appliedFilters.tankId);
      }

      if (appliedFilters.dateFrom) {
        query = query.gte('created_at', appliedFilters.dateFrom.toISOString());
      }

      if (appliedFilters.dateTo) {
        query = query.lte('created_at', appliedFilters.dateTo.toISOString());
      }

      if (appliedFilters.valueMin !== null) {
        query = query.gte('value', appliedFilters.valueMin);
      }

      if (appliedFilters.valueMax !== null) {
        query = query.lte('value', appliedFilters.valueMax);
      }

      const { data, error } = await query.limit(500);

      if (error) {
        console.error('Error fetching dip readings:', error);
        throw error;
      }

      let result = (data || []).map((reading: any) => ({
        ...reading,
        tank_location: reading.fuel_tanks?.location || 'Unknown',
        tank_group: reading.fuel_tanks?.tank_groups?.name || 'Unknown',
      }));

      // Client-side search filter
      if (appliedFilters.search) {
        const searchLower = appliedFilters.search.toLowerCase();
        result = result.filter(
          (r: DipReading) =>
            (r.tank_location || '').toLowerCase().includes(searchLower) ||
            (r.created_by_name || '').toLowerCase().includes(searchLower) ||
            (r.notes || '').toLowerCase().includes(searchLower)
        );
      }

      return result;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch tanks for dropdown
  const tanksQuery = useQuery({
    queryKey: ['admin-tanks-simple'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fuel_tanks')
        .select('id, location')
        .eq('status', 'active')
        .order('location');

      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Update reading
  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: DipReadingFormData }) => {
      const { data, error } = await supabase
        .from('dip_readings')
        .update({
          value: input.value,
          notes: input.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Dip reading updated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-dip-readings'] });
    },
    onError: (error) => {
      console.error('Error updating dip reading:', error);
      toast.error('Failed to update dip reading');
    },
  });

  // Archive reading (soft delete)
  const archiveMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from('dip_readings')
        .update({
          archived_at: new Date().toISOString(),
          deletion_reason: reason,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Dip reading archived successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-dip-readings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-entity-counts'] });
    },
    onError: (error) => {
      console.error('Error archiving dip reading:', error);
      toast.error('Failed to archive dip reading');
    },
  });

  // Restore reading
  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('dip_readings')
        .update({
          archived_at: null,
          deletion_reason: null,
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Dip reading restored successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-dip-readings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-entity-counts'] });
    },
    onError: (error) => {
      console.error('Error restoring dip reading:', error);
      toast.error('Failed to restore dip reading');
    },
  });

  // Bulk archive
  const bulkArchiveMutation = useMutation({
    mutationFn: async ({ ids, reason }: { ids: string[]; reason: string }) => {
      const { error } = await supabase
        .from('dip_readings')
        .update({
          archived_at: new Date().toISOString(),
          deletion_reason: reason,
        })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: (_, { ids }) => {
      toast.success(`${ids.length} dip reading(s) archived successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-dip-readings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-entity-counts'] });
    },
    onError: (error) => {
      console.error('Error bulk archiving dip readings:', error);
      toast.error('Failed to archive dip readings');
    },
  });

  // Bulk restore
  const bulkRestoreMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from('dip_readings')
        .update({
          archived_at: null,
          deletion_reason: null,
        })
        .in('id', ids);

      if (error) throw error;
    },
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} dip reading(s) restored successfully`);
      queryClient.invalidateQueries({ queryKey: ['admin-dip-readings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-entity-counts'] });
    },
    onError: (error) => {
      console.error('Error bulk restoring dip readings:', error);
      toast.error('Failed to restore dip readings');
    },
  });

  return {
    // Data
    readings: readingsQuery.data || [],
    tanks: tanksQuery.data || [],
    isLoading: readingsQuery.isLoading,
    error: readingsQuery.error,

    // Mutations
    updateReading: updateMutation.mutate,
    archiveReading: archiveMutation.mutate,
    restoreReading: restoreMutation.mutate,
    bulkArchiveReadings: bulkArchiveMutation.mutate,
    bulkRestoreReadings: bulkRestoreMutation.mutate,

    // Loading states
    isUpdating: updateMutation.isPending,
    isArchiving: archiveMutation.isPending,
    isRestoring: restoreMutation.isPending,
    isBulkArchiving: bulkArchiveMutation.isPending,
    isBulkRestoring: bulkRestoreMutation.isPending,
  };
}

export default useDipReadingsCrud;
