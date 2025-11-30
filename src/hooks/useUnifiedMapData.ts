/**
 * useUnifiedMapData - Single query hook for all map data sources
 *
 * Replaces multiple hooks (useTanks, useAgbotLocations, useSmartFillLocations)
 * with a single query to ta_unified_map_locations view.
 *
 * Performance: 1 query instead of 4-5
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface UnifiedMapLocation {
  source: 'manual' | 'agbot' | 'smartfill';
  id: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  current_level_percent: number | null;
  group_name: string | null;
  subgroup_name: string | null;
  product_type: string | null;
  latest_reading_at: string | null;
  urgency_status: 'critical' | 'urgent' | 'warning' | 'ok';
  rolling_avg: number | null;
  days_to_min: number | null;
  capacity_liters: number | null;
  current_level_liters: number | null;
  device_online: boolean | null;
  customer_name: string | null;
  total_assets: number | null;
  assets_online: number | null;
}

interface UseUnifiedMapDataOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
  sources?: ('manual' | 'agbot' | 'smartfill')[];
}

export function useUnifiedMapData(options: UseUnifiedMapDataOptions = {}) {
  const {
    enabled = true,
    staleTime = 2 * 60 * 1000, // 2 minutes
    refetchInterval = false,
    sources,
  } = options;

  const query = useQuery({
    queryKey: ['unified-map-locations', sources],
    queryFn: async (): Promise<UnifiedMapLocation[]> => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        logger.warn('[UNIFIED_MAP] No authenticated user');
        return [];
      }

      let queryBuilder = supabase
        .from('ta_unified_map_locations')
        .select('*');

      // Filter by source if specified
      if (sources && sources.length > 0) {
        queryBuilder = queryBuilder.in('source', sources);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        logger.error('[UNIFIED_MAP] Error fetching locations:', error);
        throw error;
      }

      logger.debug(`[UNIFIED_MAP] Fetched ${data?.length || 0} locations`);
      return (data || []) as UnifiedMapLocation[];
    },
    enabled,
    staleTime,
    refetchInterval,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const locations = query.data || [];

  // Compute summary stats
  const summary = {
    total: locations.length,
    manual: locations.filter(l => l.source === 'manual').length,
    agbot: locations.filter(l => l.source === 'agbot').length,
    smartfill: locations.filter(l => l.source === 'smartfill').length,
    critical: locations.filter(l => l.urgency_status === 'critical').length,
    urgent: locations.filter(l => l.urgency_status === 'urgent').length,
    warning: locations.filter(l => l.urgency_status === 'warning').length,
    online: locations.filter(l => l.device_online === true).length,
    withCoords: locations.filter(l => l.latitude && l.longitude).length,
  };

  return {
    locations,
    data: locations,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    summary,

    // Filter helpers
    getBySource: (source: 'manual' | 'agbot' | 'smartfill') =>
      locations.filter(l => l.source === source),

    getByCritical: () =>
      locations.filter(l => l.urgency_status === 'critical'),

    getByUrgent: () =>
      locations.filter(l => ['critical', 'urgent'].includes(l.urgency_status)),

    getWithCoordinates: () =>
      locations.filter(l => l.latitude && l.longitude),
  };
}

export default useUnifiedMapData;
