import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UnifiedEvent {
  source: 'lytx' | 'guardian';
  event_id: string;
  occurred_at: string;
  driver_id?: string;
  driver_name?: string;
  vehicle_id?: string;
  vehicle_registration?: string;
  severity_score: number;
  mtdata_trip_id?: string;
  description: string;
  status?: string;
  metadata: Record<string, any>;
}

interface UseUnifiedEventTimelineOptions {
  days?: number;
  source?: 'all' | 'lytx' | 'guardian';
  minSeverity?: number;
  driverId?: string;
  vehicleId?: string;
}

export function useUnifiedEventTimeline(options: UseUnifiedEventTimelineOptions = {}) {
  const { days = 30, source = 'all', minSeverity, driverId, vehicleId } = options;

  return useQuery({
    queryKey: ['unified-event-timeline', days, source, minSeverity, driverId, vehicleId],
    queryFn: async (): Promise<UnifiedEvent[]> => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      let query = supabase
        .from('unified_event_timeline')
        .select('*')
        .gte('occurred_at', cutoffDate.toISOString())
        .order('occurred_at', { ascending: false })
        .limit(500);

      // Apply filters
      if (source !== 'all') {
        query = query.eq('source', source);
      }

      if (minSeverity !== undefined) {
        query = query.gte('severity_score', minSeverity);
      }

      if (driverId) {
        query = query.eq('driver_id', driverId);
      }

      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching unified event timeline:', error);
        throw error;
      }

      return (data || []).map(event => ({
        source: event.source as 'lytx' | 'guardian',
        event_id: event.event_id,
        occurred_at: event.occurred_at,
        driver_id: event.driver_id,
        driver_name: event.driver_name,
        vehicle_id: event.vehicle_id,
        vehicle_registration: event.vehicle_registration,
        severity_score: event.severity_score,
        mtdata_trip_id: event.mtdata_trip_id,
        description: event.description,
        status: event.status,
        metadata: event.metadata || {},
      }));
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}
