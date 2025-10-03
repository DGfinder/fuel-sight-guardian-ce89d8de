import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

/**
 * Guardian Event Enriched - Event with cross-source driver attribution
 */
export interface GuardianEventEnriched {
  // Core event fields
  id: string;
  external_event_id: string;
  vehicle_registration: string;
  detection_time: string;
  event_type: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  verified: boolean;
  status: string;
  fleet: 'Stevemacs' | 'Great Southern Fuels';
  depot: string | null;

  // Event details
  detected_event_type: string | null;
  confirmation: string | null;
  classification: string | null;
  duration_seconds: number | null;
  speed_kph: number | null;
  latitude: number | null;
  longitude: number | null;

  // Original driver data from Guardian CSV
  original_driver_name: string | null;
  original_driver_id: string | null;

  // Enriched driver data (from cross-source attribution)
  enriched_driver_id: string | null;
  enriched_driver_name: string | null;

  // Driver information (resolved)
  driver_id: string | null;
  driver_full_name: string | null;
  driver_phone: string | null;
  driver_email: string | null;
  drivers_license: string | null;

  // Vehicle information
  vehicle_id: string | null;
  fleet_number: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vin: string | null;

  // Attribution metadata
  attribution_method:
    | 'direct_csv'
    | 'direct_csv_unresolved'
    | 'vehicle_assignment'
    | 'lytx_hourly_correlation'
    | 'mtdata_trip_correlation'
    | 'lytx_daily_correlation'
    | 'unknown';
  attribution_confidence: number; // 0.0 to 1.0

  // Correlation metadata
  lytx_hourly_time_diff_hours: number | null;
  lytx_correlated_employee_id: string | null;
  mtdata_correlated_trip_id: string | null;
  mtdata_trip_start: string | null;
  mtdata_trip_end: string | null;
  lytx_daily_time_diff_hours: number | null;

  // Vehicle assignment metadata
  assignment_id: string | null;
  assignment_type: string | null;
  assignment_confidence: number | null;
  assignment_source: string | null;
  assignment_start: string | null;
  assignment_end: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

/**
 * Filters for Guardian enriched events
 */
export interface GuardianEnrichedFilters {
  fleet?: 'Stevemacs' | 'Great Southern Fuels';
  date_from?: string;
  date_to?: string;
  attribution_method?: GuardianEventEnriched['attribution_method'] | GuardianEventEnriched['attribution_method'][];
  min_confidence?: number; // Minimum attribution confidence (0.0-1.0)
  max_confidence?: number; // Maximum attribution confidence (0.0-1.0)
  driver_id?: string;
  vehicle_id?: string;
  severity?: GuardianEventEnriched['severity'] | GuardianEventEnriched['severity'][];
  event_type?: string;
  verified?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Paginated response for enriched events
 */
export interface GuardianEnrichedPaginatedResponse {
  data: GuardianEventEnriched[];
  count: number;
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

/**
 * Attribution statistics
 */
export interface AttributionStats {
  attribution_method: string;
  event_count: number;
  percentage: number;
  avg_confidence: number;
  min_confidence: number;
  max_confidence: number;
}

/**
 * Hook to fetch Guardian enriched events with cross-source driver attribution
 *
 * @param filters - Optional filters for the query
 * @param options - React Query options
 * @returns Query result with enriched Guardian events
 *
 * @example
 * ```tsx
 * // Get all events with high confidence attribution
 * const { data, isLoading } = useGuardianEventsEnriched({
 *   min_confidence: 0.7,
 *   date_from: '2025-01-01',
 *   fleet: 'Stevemacs'
 * });
 * ```
 *
 * @example
 * ```tsx
 * // Get only correlated events (from LYTX or MTData)
 * const { data } = useGuardianEventsEnriched({
 *   attribution_method: ['lytx_hourly_correlation', 'mtdata_trip_correlation']
 * });
 * ```
 */
export function useGuardianEventsEnriched(
  filters?: GuardianEnrichedFilters,
  options?: Omit<UseQueryOptions<GuardianEnrichedPaginatedResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery<GuardianEnrichedPaginatedResponse>({
    queryKey: ['guardian-events-enriched', filters],
    queryFn: async () => {
      let query = supabase
        .from('guardian_events_enriched')
        .select('*', { count: 'exact' })
        .order('detection_time', { ascending: false });

      // Apply filters
      if (filters?.fleet) {
        query = query.eq('fleet', filters.fleet);
      }

      if (filters?.date_from) {
        query = query.gte('detection_time', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('detection_time', filters.date_to);
      }

      if (filters?.attribution_method) {
        if (Array.isArray(filters.attribution_method)) {
          query = query.in('attribution_method', filters.attribution_method);
        } else {
          query = query.eq('attribution_method', filters.attribution_method);
        }
      }

      if (filters?.min_confidence !== undefined) {
        query = query.gte('attribution_confidence', filters.min_confidence);
      }

      if (filters?.max_confidence !== undefined) {
        query = query.lte('attribution_confidence', filters.max_confidence);
      }

      if (filters?.driver_id) {
        query = query.eq('enriched_driver_id', filters.driver_id);
      }

      if (filters?.vehicle_id) {
        query = query.eq('vehicle_id', filters.vehicle_id);
      }

      if (filters?.severity) {
        if (Array.isArray(filters.severity)) {
          query = query.in('severity', filters.severity);
        } else {
          query = query.eq('severity', filters.severity);
        }
      }

      if (filters?.event_type) {
        query = query.ilike('event_type', `%${filters.event_type}%`);
      }

      if (filters?.verified !== undefined) {
        query = query.eq('verified', filters.verified);
      }

      // Pagination
      const limit = filters?.limit || 100;
      const offset = filters?.offset || 0;

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Failed to fetch Guardian enriched events: ${error.message}`);
      }

      return {
        data: data || [],
        count: data?.length || 0,
        total: count || 0,
        page: Math.floor(offset / limit) + 1,
        per_page: limit,
        total_pages: Math.ceil((count || 0) / limit),
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to fetch attribution statistics for Guardian events
 * Shows breakdown of attribution methods and confidence levels
 *
 * @returns Query result with attribution statistics
 *
 * @example
 * ```tsx
 * const { data: stats } = useGuardianAttributionStats();
 * // stats will show percentage of events by attribution method
 * ```
 */
export function useGuardianAttributionStats(
  options?: Omit<UseQueryOptions<AttributionStats[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<AttributionStats[]>({
    queryKey: ['guardian-attribution-stats'],
    queryFn: async () => {
      // This query aggregates attribution methods
      const { data, error } = await supabase.rpc('get_guardian_attribution_stats');

      if (error) {
        // Fallback: manually aggregate from view if RPC doesn't exist
        const { data: events, error: viewError } = await supabase
          .from('guardian_events_enriched')
          .select('attribution_method, attribution_confidence');

        if (viewError) {
          throw new Error(`Failed to fetch attribution stats: ${viewError.message}`);
        }

        // Aggregate manually
        const methodCounts = events?.reduce((acc, event) => {
          const method = event.attribution_method || 'unknown';
          if (!acc[method]) {
            acc[method] = {
              count: 0,
              confidences: [],
            };
          }
          acc[method].count++;
          acc[method].confidences.push(event.attribution_confidence || 0);
          return acc;
        }, {} as Record<string, { count: number; confidences: number[] }>) || {};

        const totalEvents = events?.length || 1;

        const stats: AttributionStats[] = Object.entries(methodCounts).map(([method, data]) => ({
          attribution_method: method,
          event_count: data.count,
          percentage: (data.count / totalEvents) * 100,
          avg_confidence: data.confidences.reduce((sum, c) => sum + c, 0) / data.count,
          min_confidence: Math.min(...data.confidences),
          max_confidence: Math.max(...data.confidences),
        }));

        return stats.sort((a, b) => b.event_count - a.event_count);
      }

      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

/**
 * Hook to fetch Guardian events with unknown or low-confidence driver attribution
 * Useful for identifying events that need manual review
 *
 * @param confidenceThreshold - Events with confidence below this value (default: 0.5)
 * @returns Query result with low-confidence events
 *
 * @example
 * ```tsx
 * const { data: needsReview } = useGuardianEventsNeedingReview(0.6);
 * ```
 */
export function useGuardianEventsNeedingReview(
  confidenceThreshold: number = 0.5,
  options?: Omit<UseQueryOptions<GuardianEventEnriched[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<GuardianEventEnriched[]>({
    queryKey: ['guardian-events-needing-review', confidenceThreshold],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guardian_events_enriched')
        .select('*')
        .lt('attribution_confidence', confidenceThreshold)
        .gte('detection_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .order('detection_time', { ascending: false })
        .limit(200);

      if (error) {
        throw new Error(`Failed to fetch events needing review: ${error.message}`);
      }

      return data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}

/**
 * Hook to fetch a single Guardian enriched event by ID
 *
 * @param eventId - The event ID to fetch
 * @returns Query result with single event
 */
export function useGuardianEventEnriched(
  eventId: string | undefined,
  options?: Omit<UseQueryOptions<GuardianEventEnriched | null>, 'queryKey' | 'queryFn'>
) {
  return useQuery<GuardianEventEnriched | null>({
    queryKey: ['guardian-event-enriched', eventId],
    queryFn: async () => {
      if (!eventId) return null;

      const { data, error } = await supabase
        .from('guardian_events_enriched')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Failed to fetch Guardian event: ${error.message}`);
      }

      return data;
    },
    enabled: !!eventId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options,
  });
}

/**
 * Hook to fetch driver correlation audit data
 * Shows all possible driver matches for debugging
 *
 * @param eventId - Optional event ID to filter by
 * @returns Query result with correlation audit data
 */
export function useGuardianDriverCorrelations(
  eventId?: string,
  options?: Omit<UseQueryOptions<any[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<any[]>({
    queryKey: ['guardian-driver-correlations', eventId],
    queryFn: async () => {
      let query = supabase
        .from('guardian_driver_correlations')
        .select('*')
        .order('detection_time', { ascending: false })
        .limit(100);

      if (eventId) {
        query = query.eq('guardian_event_id', eventId);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch driver correlations: ${error.message}`);
      }

      return data || [];
    },
    enabled: true,
    staleTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  });
}
