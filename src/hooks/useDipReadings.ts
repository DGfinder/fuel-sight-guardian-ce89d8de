/**
 * Unified Dip Readings Hook
 *
 * Consolidates all dip reading queries into a single, optimized hook.
 * Replaces: useTankDips, useTankHistory, useGroupTankHistory, useRecentDips
 *
 * Benefits:
 * - Eliminates N+1 queries (uses materialized view)
 * - Single source of truth for dip data
 * - Automatic query optimization
 * - Type-safe with full TypeScript support
 * - Reduces code duplication by ~200 lines
 */

import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DipReading } from '@/types/fuel';

// ============================================================================
// Types
// ============================================================================

export interface DipReadingsParams {
  /** Single tank ID or array of tank IDs */
  tankIds?: string | string[];

  /** Enable/disable the query */
  enabled?: boolean;

  /** Filter by date range */
  dateFrom?: Date;
  dateTo?: Date;

  /** Quick date range presets */
  days?: number; // Last N days

  /** Text search in notes or recorded_by name */
  searchQuery?: string;

  /** Filter by who recorded it (user ID) */
  recordedBy?: string;

  /** Filter by value range */
  minValue?: number;
  maxValue?: number;

  /** Sorting */
  sortBy?: 'created_at' | 'value' | 'recorded_by';
  sortOrder?: 'asc' | 'desc';

  /** Pagination */
  limit?: number;
  offset?: number;

  /** Include archived readings */
  includeArchived?: boolean;
}

export interface DipReadingsResult {
  readings: DipReading[];
  totalCount: number;
  hasMore: boolean;
}

export interface RecorderInfo {
  id: string;
  fullName: string;
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Unified hook for fetching dip readings with optimal performance
 *
 * @example
 * // Single tank
 * const { data } = useDipReadings({ tankIds: 'tank-123' });
 *
 * @example
 * // Multiple tanks with filters
 * const { data } = useDipReadings({
 *   tankIds: ['tank-1', 'tank-2'],
 *   dateFrom: new Date('2025-01-01'),
 *   limit: 50
 * });
 *
 * @example
 * // Recent readings across all tanks
 * const { data } = useDipReadings({ days: 30, limit: 100 });
 */
export function useDipReadings(
  params: DipReadingsParams = {}
): UseQueryResult<DipReadingsResult> {
  const {
    tankIds,
    enabled = true,
    dateFrom,
    dateTo,
    days,
    searchQuery,
    recordedBy,
    minValue,
    maxValue,
    sortBy = 'created_at',
    sortOrder = 'desc',
    limit = 100,
    offset = 0,
    includeArchived = false,
  } = params;

  // Normalize tankIds to array
  const tankIdsArray = tankIds
    ? Array.isArray(tankIds) ? tankIds : [tankIds]
    : [];

  return useQuery({
    queryKey: [
      'dip-readings',
      tankIdsArray.sort().join(','),
      dateFrom?.toISOString(),
      dateTo?.toISOString(),
      days,
      searchQuery,
      recordedBy,
      minValue,
      maxValue,
      sortBy,
      sortOrder,
      limit,
      offset,
      includeArchived,
    ],
    queryFn: async (): Promise<DipReadingsResult> => {
      // Use optimized materialized view (eliminates N+1 queries!)
      let query = supabase
        .from('dip_readings_with_users')
        .select('*', { count: 'exact' });

      // Filter by tank IDs
      if (tankIdsArray.length === 1) {
        query = query.eq('tank_id', tankIdsArray[0]);
      } else if (tankIdsArray.length > 1) {
        query = query.in('tank_id', tankIdsArray);
      }

      // Date filtering
      if (dateFrom && dateTo) {
        query = query
          .gte('created_at', dateFrom.toISOString())
          .lte('created_at', dateTo.toISOString());
      } else if (days) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days);
        query = query.gte('created_at', fromDate.toISOString());
      }

      // Text search (now searches in pre-joined user names!)
      if (searchQuery) {
        query = query.or(
          `notes.ilike.%${searchQuery}%,recorded_by_name.ilike.%${searchQuery}%`
        );
      }

      // Filter by recorded_by user
      if (recordedBy && recordedBy !== 'all') {
        query = query.eq('recorded_by', recordedBy);
      }

      // Value range filtering
      if (minValue !== undefined) {
        query = query.gte('value', minValue);
      }
      if (maxValue !== undefined) {
        query = query.lte('value', maxValue);
      }

      // Archived filter (default: exclude archived)
      if (!includeArchived) {
        query = query.is('archived_at', null);
      }

      // Sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Pagination
      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching dip readings:', error);
        throw error;
      }

      // Transform to DipReading format
      const readings: DipReading[] = (data || []).map((row) => ({
        id: row.id,
        tank_id: row.tank_id,
        value: row.value,
        created_at: row.created_at,
        recorded_by: row.recorded_by_name, // Pre-joined! No second query needed
        notes: row.notes,
        created_by_name: row.recorded_by_name,
      }));

      return {
        readings,
        totalCount: count || 0,
        hasMore: (count || 0) > offset + (data?.length || 0),
      };
    },
    enabled: enabled,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
  });
}

// ============================================================================
// Specialized Hooks (backwards compatibility)
// ============================================================================

/**
 * Get recent dip readings for a single tank
 * @deprecated Use useDipReadings({ tankIds: tankId, limit: 30 }) instead
 */
export function useTankDips(tankId: string | undefined) {
  return useDipReadings({
    tankIds: tankId,
    enabled: !!tankId,
    limit: 30,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
}

/**
 * Get recent dip readings across all tanks
 * @deprecated Use useDipReadings({ limit: 30 }) instead
 */
export function useRecentDips(limit = 30) {
  return useDipReadings({
    limit,
    sortBy: 'created_at',
    sortOrder: 'desc',
  });
}

/**
 * Get unique recorders for filtering
 */
export function useRecorders(
  tankIds?: string | string[]
): UseQueryResult<RecorderInfo[]> {
  const tankIdsArray = tankIds
    ? Array.isArray(tankIds) ? tankIds : [tankIds]
    : [];

  return useQuery({
    queryKey: ['dip-recorders', tankIdsArray.sort().join(',')],
    queryFn: async (): Promise<RecorderInfo[]> => {
      let query = supabase
        .from('dip_readings_with_users')
        .select('recorded_by, recorded_by_name')
        .not('recorded_by', 'is', null)
        .is('archived_at', null);

      if (tankIdsArray.length > 0) {
        if (tankIdsArray.length === 1) {
          query = query.eq('tank_id', tankIdsArray[0]);
        } else {
          query = query.in('tank_id', tankIdsArray);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get unique recorders
      const uniqueRecorders = new Map<string, string>();
      data?.forEach((row) => {
        if (row.recorded_by && row.recorded_by_name) {
          uniqueRecorders.set(row.recorded_by, row.recorded_by_name);
        }
      });

      return Array.from(uniqueRecorders.entries())
        .map(([id, fullName]) => ({ id, fullName }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
    },
    enabled: true,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

/**
 * Get reading statistics for a tank
 */
export function useDipStatistics(
  tankId: string,
  dateFrom?: Date,
  dateTo?: Date
): UseQueryResult<{
  count: number;
  min: number;
  max: number;
  average: number;
  latest: DipReading | null;
  oldest: DipReading | null;
}> {
  return useQuery({
    queryKey: ['dip-stats', tankId, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('dip_readings_with_users')
        .select('*')
        .eq('tank_id', tankId)
        .is('archived_at', null);

      if (dateFrom && dateTo) {
        query = query
          .gte('created_at', dateFrom.toISOString())
          .lte('created_at', dateTo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        return {
          count: 0,
          min: 0,
          max: 0,
          average: 0,
          latest: null,
          oldest: null,
        };
      }

      const values = data.map((r) => r.value).filter((v) => v !== null);
      const sortedByDate = data.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const latest = sortedByDate[sortedByDate.length - 1];
      const oldest = sortedByDate[0];

      return {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        latest: latest ? {
          id: latest.id,
          tank_id: latest.tank_id,
          value: latest.value,
          created_at: latest.created_at,
          recorded_by: latest.recorded_by_name,
          notes: latest.notes,
        } : null,
        oldest: oldest ? {
          id: oldest.id,
          tank_id: oldest.tank_id,
          value: oldest.value,
          created_at: oldest.created_at,
          recorded_by: oldest.recorded_by_name,
          notes: oldest.notes,
        } : null,
      };
    },
    enabled: !!tankId,
  });
}
