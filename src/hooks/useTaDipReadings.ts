import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

/**
 * TaDipReading - Dip reading from ta_tank_dips table
 */
export interface TaDipReading {
  id: string;
  business_id: string;
  tank_id: string;
  measured_at: string;
  measured_by: string | null;
  measured_by_name: string | null;
  method: 'dipstick' | 'sensor' | 'automatic' | 'estimate';
  source_channel: 'web_portal' | 'mobile_app' | 'legacy_import' | 'api' | 'sensor';
  level_liters: number;
  level_percent: number | null;
  raw_value: number;
  raw_unit: string;
  is_estimate: boolean;
  delivery_id: string | null;
  temperature_c: number | null;
  notes: string | null;
  quality_status: 'ok' | 'warning' | 'suspect' | 'invalid';
  anomaly_score: number | null;
  device_id: string | null;
  device_type: string | null;
  created_by: string | null;
  created_by_name: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Input for creating a new dip reading
 */
export interface CreateDipReadingInput {
  tank_id: string;
  level_liters: number;
  method?: 'dipstick' | 'sensor' | 'automatic' | 'estimate';
  source_channel?: 'web_portal' | 'mobile_app' | 'api';
  notes?: string;
  measured_at?: string; // Defaults to now
}

/**
 * useTaDipReadings - Hook for managing dip readings from ta_tank_dips
 */
export const useTaDipReadings = (options?: {
  tankId?: string;
  businessId?: string;
  limit?: number;
  daysBack?: number;
}) => {
  const queryClient = useQueryClient();
  const limit = options?.limit || 100;
  const daysBack = options?.daysBack || 30;

  // Calculate date range
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const readingsQuery = useQuery({
    queryKey: ['ta-dip-readings', options],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        return [];
      }

      let query = supabase
        .from('ta_tank_dips')
        .select('*')
        .is('archived_at', null)
        .gte('measured_at', startDate.toISOString())
        .order('measured_at', { ascending: false })
        .limit(limit);

      if (options?.tankId) {
        query = query.eq('tank_id', options.tankId);
      }
      if (options?.businessId) {
        query = query.eq('business_id', options.businessId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('[TA_DIP_READINGS] Error fetching readings:', error);
        throw error;
      }

      return (data || []) as TaDipReading[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Create new dip reading
  const createMutation = useMutation({
    mutationFn: async (input: CreateDipReadingInput) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Get business_id from the tank
      const { data: tank, error: tankError } = await supabase
        .from('ta_tanks')
        .select('business_id, capacity_liters')
        .eq('id', input.tank_id)
        .single();

      if (tankError || !tank) {
        throw new Error('Tank not found');
      }

      // Calculate percentage if capacity is known
      const level_percent = tank.capacity_liters > 0
        ? Math.round((input.level_liters / tank.capacity_liters) * 100 * 10) / 10
        : null;

      const { data, error } = await supabase
        .from('ta_tank_dips')
        .insert({
          business_id: tank.business_id,
          tank_id: input.tank_id,
          level_liters: input.level_liters,
          level_percent,
          raw_value: input.level_liters,
          raw_unit: 'L',
          method: input.method || 'dipstick',
          source_channel: input.source_channel || 'web_portal',
          measured_at: input.measured_at || new Date().toISOString(),
          measured_by: user.id,
          quality_status: 'ok',
          is_estimate: false,
          notes: input.notes || null,
        })
        .select()
        .single();

      if (error) {
        logger.error('[TA_DIP_READINGS] Error creating reading:', error);
        throw error;
      }

      // Update the tank's current level
      await supabase
        .from('ta_tanks')
        .update({
          current_level_liters: input.level_liters,
          current_level_datetime: input.measured_at || new Date().toISOString(),
          current_level_source: 'dip',
          fill_percent: level_percent,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.tank_id);

      return data as TaDipReading;
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['ta-dip-readings'] });
      queryClient.invalidateQueries({ queryKey: ['ta-tanks'] });
    },
  });

  // Archive (soft delete) a dip reading
  const archiveMutation = useMutation({
    mutationFn: async (readingId: string) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase
        .from('ta_tank_dips')
        .update({
          archived_at: new Date().toISOString(),
          deleted_by: user.id,
        })
        .eq('id', readingId);

      if (error) {
        logger.error('[TA_DIP_READINGS] Error archiving reading:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ta-dip-readings'] });
      queryClient.invalidateQueries({ queryKey: ['ta-tanks'] });
    },
  });

  // Batch create multiple dip readings (for bulk entry pages)
  const batchCreateMutation = useMutation({
    mutationFn: async (inputs: CreateDipReadingInput[]) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error('Not authenticated');
      }

      if (inputs.length === 0) {
        return [];
      }

      // Get all unique tank IDs
      const tankIds = [...new Set(inputs.map(i => i.tank_id))];

      // Fetch tank info for all tanks in one query
      const { data: tanks, error: tanksError } = await supabase
        .from('ta_tanks')
        .select('id, business_id, capacity_liters')
        .in('id', tankIds);

      if (tanksError || !tanks) {
        throw new Error('Failed to fetch tank information');
      }

      const tankMap = new Map(tanks.map(t => [t.id, t]));

      // Build records for batch insert
      const records = inputs.map(input => {
        const tank = tankMap.get(input.tank_id);
        if (!tank) {
          throw new Error(`Tank not found: ${input.tank_id}`);
        }

        const level_percent = tank.capacity_liters > 0
          ? Math.round((input.level_liters / tank.capacity_liters) * 100 * 10) / 10
          : null;

        return {
          business_id: tank.business_id,
          tank_id: input.tank_id,
          level_liters: input.level_liters,
          level_percent,
          raw_value: input.level_liters,
          raw_unit: 'L',
          method: input.method || 'dipstick',
          source_channel: input.source_channel || 'web_portal',
          measured_at: input.measured_at || new Date().toISOString(),
          measured_by: user.id,
          quality_status: 'ok' as const,
          is_estimate: false,
          notes: input.notes || null,
        };
      });

      // Batch insert all dip readings
      const { data, error } = await supabase
        .from('ta_tank_dips')
        .insert(records)
        .select();

      if (error) {
        logger.error('[TA_DIP_READINGS] Error batch creating readings:', error);
        throw error;
      }

      logger.info(`[TA_DIP_READINGS] Batch created ${records.length} readings`);
      return (data || []) as TaDipReading[];
    },
    onSuccess: () => {
      // Invalidate related queries - triggers will handle tank updates
      queryClient.invalidateQueries({ queryKey: ['ta-dip-readings'] });
      queryClient.invalidateQueries({ queryKey: ['ta-tanks'] });
      queryClient.invalidateQueries({ queryKey: ['ta-tanks-compat'] });
    },
  });

  const readings = readingsQuery.data || [];

  return {
    readings,
    data: readings,
    isLoading: readingsQuery.isLoading,
    error: readingsQuery.error,
    refetch: readingsQuery.refetch,

    // Mutations
    createReading: createMutation.mutateAsync,
    batchCreateReadings: batchCreateMutation.mutateAsync,
    archiveReading: archiveMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isBatchCreating: batchCreateMutation.isPending,
    isArchiving: archiveMutation.isPending,

    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ['ta-dip-readings'] });
    },

    // Helpers
    getLatestForTank: (tankId: string) =>
      readings.find(r => r.tank_id === tankId),

    getReadingsForTank: (tankId: string) =>
      readings.filter(r => r.tank_id === tankId),
  };
};

export default useTaDipReadings;
