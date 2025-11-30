import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import type { Tank } from '@/types/fuel';

/**
 * useTaTanksCompat - Compatibility hook that uses the fast ta_tank_full_status view
 * but returns data in the old Tank interface format for gradual migration.
 *
 * Benefits:
 * - Uses optimized single-query view (ta_tank_full_status)
 * - Returns data compatible with existing components
 * - Drop-in replacement for useTanks()
 *
 * Performance: Single query instead of 4, pre-calculated analytics
 */
export const useTaTanksCompat = () => {
  const queryClient = useQueryClient();

  const tanksQuery = useQuery({
    queryKey: ['ta-tanks-compat'],
    queryFn: async () => {
      // Check authentication
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        return [];
      }

      // Single optimized query to ta_tank_full_status view
      const { data, error } = await supabase
        .from('ta_tank_full_status')
        .select('*')
        .order('priority_score', { ascending: true })
        .order('fill_percent', { ascending: true });

      if (error) {
        logger.error('[TA_TANKS_COMPAT] Error fetching tanks:', error);
        throw error;
      }

      // Map ta_tank_full_status fields to old Tank interface
      const mappedTanks: Tank[] = (data || []).map((t: any) => ({
        // Core identification
        id: t.id,
        location: t.name, // ta_tanks uses 'name', old used 'location'
        product_type: 'Diesel', // Default, ta_tanks doesn't have this currently

        // Levels - map to old field names
        safe_level: t.capacity_liters,
        min_level: t.min_level_liters || 0,
        current_level: t.current_level_liters,
        current_level_percent: t.fill_percent,

        // Group info - uses ta_groups.id (matching user_ta_group_permissions)
        group_id: t.group_id,
        group_name: t.group_name || 'Unknown Group',
        subgroup: t.subgroup_name || '',

        // Analytics - pre-calculated from materialized view
        rolling_avg: t.avg_daily_consumption_liters || 0,
        prev_day_used: t.previous_day_use || 0,
        is_recent_refill: false, // Not tracked in new schema
        days_to_min_level: t.estimated_days_until_empty !== 999
          ? t.estimated_days_until_empty
          : null,

        // Calculated fields
        usable_capacity: Math.max(0, (t.capacity_liters || 0) - (t.min_level_liters || 0)),
        ullage: Math.max(0, (t.capacity_liters || 0) - (t.current_level_liters || 0)),

        // Last dip info
        last_dip_ts: t.current_level_datetime,
        last_dip_by: '', // Not in view currently
        last_dip: t.current_level_datetime ? {
          value: t.current_level_liters,
          created_at: t.current_level_datetime,
          recorded_by: ''
        } : null,

        // Status (from old schema, map urgency_status)
        status: 'active' as const,

        // Additional fields (may be null)
        address: '',
        vehicle: '',
        discharge: '',
        bp_portal: '',
        delivery_window: '',
        afterhours_contact: '',
        notes: t.notes || '',
        serviced_on: undefined,
        serviced_by: undefined,
        latitude: t.latitude,
        longitude: t.longitude,
        address: t.location_address || '',
        created_at: t.created_at,
        updated_at: t.updated_at,

        // Enhanced Analytics (new fields from ta_tank_analytics)
        trend_direction: t.trend_direction || 'stable',
        trend_percent_change: t.trend_percent_change || 0,
        last_refill_date: t.last_refill_date,
        last_refill_volume: t.last_refill_volume,
        avg_refill_interval_days: t.avg_refill_interval_days,
        consumption_stddev: t.consumption_stddev || 0,
        predictability: t.predictability || 'unknown',
        days_since_last_dip: t.days_since_last_dip,
        data_quality: t.data_quality || 'no_data',
        peak_daily_consumption: t.peak_daily_consumption || 0,
        consumption_7_days: t.consumption_7_days || 0,
        consumption_30_days: t.consumption_30_days || 0,
        is_anomaly: t.is_anomaly || false,
        anomaly_type: t.anomaly_type,
        optimal_order_date: t.optimal_order_date,
        order_urgency: t.order_urgency || 'ok',
        consumption_vs_group_percent: t.consumption_vs_group_percent,
        efficiency_trend: t.efficiency_trend || 'stable',
      }));

      return mappedTanks;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('No authenticated user')) {
        return false;
      }
      return failureCount < 3;
    }
  });

  // Realtime subscription - instant updates when tanks change
  useEffect(() => {
    const channel = supabase
      .channel('ta-tanks-realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'ta_tanks' },
        (payload) => {
          logger.debug('[TA_TANKS_COMPAT] Realtime update:', payload.eventType, payload.new);
          // Invalidate query to refetch fresh data
          queryClient.invalidateQueries({ queryKey: ['ta-tanks-compat'] });
        }
      )
      .subscribe((status) => {
        logger.debug('[TA_TANKS_COMPAT] Realtime subscription status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const tanks = tanksQuery.data || [];

  return {
    tanks,
    data: tanks,
    isLoading: tanksQuery.isLoading,
    error: tanksQuery.error,
    refetch: tanksQuery.refetch,

    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ['ta-tanks-compat'] });
    },

    // Analytics summary (same interface as old hook)
    getAnalyticsSummary: () => {
      if (!tanks.length) return null;

      const tanksWithData = tanks.filter((t: Tank) => t.rolling_avg > 0);

      return {
        totalTanks: tanks.length,
        tanksWithAnalytics: tanksWithData.length,
        avgRollingConsumption: tanksWithData.length > 0
          ? Math.round(tanksWithData.reduce((sum: number, t: Tank) => sum + t.rolling_avg, 0) / tanksWithData.length)
          : 0,
        tanksNeedingAttention: tanks.filter((t: Tank) =>
          t.current_level_percent < 15 ||
          (t.days_to_min_level !== null && t.days_to_min_level < 7)
        ).length,
        totalDailyConsumption: Math.round(tanksWithData.reduce((sum: number, t: Tank) => sum + t.rolling_avg, 0))
      };
    }
  };
};

// Export as drop-in replacement
export default useTaTanksCompat;
