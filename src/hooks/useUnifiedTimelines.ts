import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Unified Timeline Event
 * Represents an event from any source (Guardian, LYTX, MTData)
 */
export interface UnifiedTimelineEvent {
  // Vehicle info
  vehicle_id: string | null;
  vehicle_registration: string;
  fleet: 'Stevemacs' | 'Great Southern Fuels';
  depot: string | null;

  // Event info
  source: 'guardian' | 'lytx' | 'mtdata';
  event_id: string;
  occurred_at: string;
  event_type: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';

  // Driver info
  driver_name: string | null;
  driver_id: string | null;

  // Location and metrics
  latitude: number | null;
  longitude: number | null;
  speed_kph: number | null;
  duration_seconds: number | null;

  // Status
  verified: boolean;
  confirmation: string | null;

  // Source-specific data (varies by source)
  source_data: Record<string, any>;
}

/**
 * Driver Timeline Event (extends unified event with correlation info)
 */
export interface DriverTimelineEvent extends UnifiedTimelineEvent {
  // Driver details
  drivers_license: string | null;
  employee_id: string | null;

  // Correlation metadata (for Guardian events)
  correlation_method: 'direct_guardian' | 'direct_lytx' | 'direct_mtdata' | 'lytx_hourly' | 'mtdata_trip' | 'lytx_daily' | null;
  correlation_confidence: number;
}

/**
 * Driver Correlation
 * Shows how a Guardian event was matched to a driver
 */
export interface DriverCorrelation {
  guardian_event_id: string;
  driver_id: string;
  driver_name: string;
  correlation_method: 'direct_guardian' | 'lytx_hourly' | 'mtdata_trip' | 'lytx_daily';
  confidence: number;
  time_difference: string | null; // PostgreSQL interval
}

/**
 * Filters for unified timeline queries
 */
export interface TimelineFilters {
  source?: 'guardian' | 'lytx' | 'mtdata' | ('guardian' | 'lytx' | 'mtdata')[];
  fleet?: 'Stevemacs' | 'Great Southern Fuels';
  depot?: string;
  date_from?: string;
  date_to?: string;
  severity?: ('Low' | 'Medium' | 'High' | 'Critical')[];
  verified?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Hook to fetch unified timeline for a vehicle
 * Returns ALL events (Guardian, LYTX, MTData) for the specified vehicle
 *
 * @param vehicleId - The vehicle ID to fetch events for
 * @param filters - Optional filters
 * @param options - React Query options
 *
 * @example
 * ```tsx
 * const { data: events } = useVehicleTimeline(vehicleId, {
 *   date_from: '2025-01-01',
 *   source: ['guardian', 'lytx'], // Only safety events
 *   severity: ['Critical', 'High']
 * });
 * ```
 */
export function useVehicleTimeline(
  vehicleId: string | undefined,
  filters?: TimelineFilters,
  options?: Omit<UseQueryOptions<UnifiedTimelineEvent[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<UnifiedTimelineEvent[]>({
    queryKey: ['vehicle-timeline', vehicleId, filters],
    queryFn: async () => {
      if (!vehicleId) return [];

      let query = supabase
        .from('vehicle_unified_timeline')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('occurred_at', { ascending: false });

      // Apply filters
      if (filters?.source) {
        if (Array.isArray(filters.source)) {
          query = query.in('source', filters.source);
        } else {
          query = query.eq('source', filters.source);
        }
      }

      if (filters?.fleet) {
        query = query.eq('fleet', filters.fleet);
      }

      if (filters?.depot) {
        query = query.eq('depot', filters.depot);
      }

      if (filters?.date_from) {
        query = query.gte('occurred_at', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('occurred_at', filters.date_to);
      }

      if (filters?.severity) {
        query = query.in('severity', filters.severity);
      }

      if (filters?.verified !== undefined) {
        query = query.eq('verified', filters.verified);
      }

      // Pagination
      const limit = filters?.limit || 100;
      const offset = filters?.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch vehicle timeline: ${error.message}`);
      }

      return data || [];
    },
    enabled: !!vehicleId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to fetch unified timeline for a driver
 * Returns ALL events (Guardian, LYTX, MTData) for the specified driver
 *
 * @param driverId - The driver ID to fetch events for
 * @param filters - Optional filters
 * @param options - React Query options
 *
 * @example
 * ```tsx
 * const { data: events } = useDriverTimeline(driverId, {
 *   date_from: '2025-01-01',
 *   source: 'guardian', // Only Guardian events
 *   severity: ['Critical', 'High']
 * });
 * ```
 */
export function useDriverTimeline(
  driverId: string | undefined,
  filters?: TimelineFilters,
  options?: Omit<UseQueryOptions<DriverTimelineEvent[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<DriverTimelineEvent[]>({
    queryKey: ['driver-timeline', driverId, filters],
    queryFn: async () => {
      if (!driverId) return [];

      let query = supabase
        .from('driver_unified_timeline')
        .select('*')
        .eq('driver_id', driverId)
        .order('occurred_at', { ascending: false });

      // Apply filters
      if (filters?.source) {
        if (Array.isArray(filters.source)) {
          query = query.in('source', filters.source);
        } else {
          query = query.eq('source', filters.source);
        }
      }

      if (filters?.fleet) {
        query = query.eq('fleet', filters.fleet);
      }

      if (filters?.depot) {
        query = query.eq('depot', filters.depot);
      }

      if (filters?.date_from) {
        query = query.gte('occurred_at', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('occurred_at', filters.date_to);
      }

      if (filters?.severity) {
        query = query.in('severity', filters.severity);
      }

      if (filters?.verified !== undefined) {
        query = query.eq('verified', filters.verified);
      }

      // Pagination
      const limit = filters?.limit || 100;
      const offset = filters?.offset || 0;
      query = query.range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch driver timeline: ${error.message}`);
      }

      return data || [];
    },
    enabled: !!driverId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to fetch driver correlations
 * Shows how Guardian events were matched to drivers
 *
 * @param filters - Optional filters
 * @param options - React Query options
 *
 * @example
 * ```tsx
 * // Get correlations for review (low confidence)
 * const { data } = useDriverCorrelations({
 *   min_confidence: 0,
 *   max_confidence: 0.7,
 *   method: 'lytx_hourly'
 * });
 * ```
 */
export function useDriverCorrelations(
  filters?: {
    driver_id?: string;
    method?: 'direct_guardian' | 'lytx_hourly' | 'mtdata_trip' | 'lytx_daily';
    min_confidence?: number;
    max_confidence?: number;
    limit?: number;
  },
  options?: Omit<UseQueryOptions<DriverCorrelation[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<DriverCorrelation[]>({
    queryKey: ['driver-correlations', filters],
    queryFn: async () => {
      let query = supabase
        .from('driver_event_correlation')
        .select('*')
        .order('confidence', { ascending: false });

      if (filters?.driver_id) {
        query = query.eq('driver_id', filters.driver_id);
      }

      if (filters?.method) {
        query = query.eq('correlation_method', filters.method);
      }

      if (filters?.min_confidence !== undefined) {
        query = query.gte('confidence', filters.min_confidence);
      }

      if (filters?.max_confidence !== undefined) {
        query = query.lte('confidence', filters.max_confidence);
      }

      const limit = filters?.limit || 100;
      query = query.limit(limit);

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch driver correlations: ${error.message}`);
      }

      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

/**
 * Hook to fetch correlation statistics
 * Shows breakdown of correlation methods and confidence levels
 *
 * @example
 * ```tsx
 * const { data: stats } = useCorrelationStats();
 * // Returns: [
 * //   { method: 'direct_guardian', count: 1234, avg_confidence: 1.0 },
 * //   { method: 'lytx_hourly', count: 456, avg_confidence: 0.8 },
 * //   ...
 * // ]
 * ```
 */
export function useCorrelationStats(
  options?: Omit<UseQueryOptions<any[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<any[]>({
    queryKey: ['correlation-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('driver_event_correlation')
        .select('correlation_method, confidence');

      if (error) {
        throw new Error(`Failed to fetch correlation stats: ${error.message}`);
      }

      // Aggregate stats
      const stats = (data || []).reduce((acc, row) => {
        const method = row.correlation_method;
        if (!acc[method]) {
          acc[method] = {
            method,
            count: 0,
            total_confidence: 0,
          };
        }
        acc[method].count++;
        acc[method].total_confidence += row.confidence;
        return acc;
      }, {} as Record<string, any>);

      // Calculate averages
      return Object.values(stats).map((s: any) => ({
        method: s.method,
        count: s.count,
        avg_confidence: s.total_confidence / s.count,
      })).sort((a, b) => b.count - a.count);
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

/**
 * Hook to fetch recent events across all sources
 * Useful for dashboard "Recent Activity" widgets
 *
 * @param limit - Number of events to fetch (default: 50)
 * @param filters - Optional filters
 *
 * @example
 * ```tsx
 * // Recent high-severity events
 * const { data } = useRecentEvents(20, {
 *   severity: ['Critical', 'High'],
 *   source: ['guardian', 'lytx']
 * });
 * ```
 */
export function useRecentEvents(
  limit: number = 50,
  filters?: Omit<TimelineFilters, 'limit' | 'offset'>,
  options?: Omit<UseQueryOptions<UnifiedTimelineEvent[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<UnifiedTimelineEvent[]>({
    queryKey: ['recent-events', limit, filters],
    queryFn: async () => {
      let query = supabase
        .from('vehicle_unified_timeline')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(limit);

      // Apply filters
      if (filters?.source) {
        if (Array.isArray(filters.source)) {
          query = query.in('source', filters.source);
        } else {
          query = query.eq('source', filters.source);
        }
      }

      if (filters?.fleet) {
        query = query.eq('fleet', filters.fleet);
      }

      if (filters?.severity) {
        query = query.in('severity', filters.severity);
      }

      if (filters?.date_from) {
        query = query.gte('occurred_at', filters.date_from);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch recent events: ${error.message}`);
      }

      return data || [];
    },
    staleTime: 1 * 60 * 1000, // 1 minute (fresher for recent events)
    ...options,
  });
}
