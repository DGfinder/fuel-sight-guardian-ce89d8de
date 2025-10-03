import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DVTDRelationship {
  trip_id: string;
  trip_external_id?: string;
  trip_date: string;
  vehicle_id?: string;
  vehicle_registration?: string;
  vehicle_fleet?: string;
  vehicle_depot?: string;
  driver_id?: string;
  driver_name?: string;
  employee_id?: string;
  start_time: string;
  end_time?: string;
  distance_km?: number;
  travel_time_hours?: number;
  start_location?: string;
  end_location?: string;
  delivery_key?: string;
  bill_of_lading?: string;
  customer_name?: string;
  terminal_name?: string;
  carrier?: string;
  delivery_volume_litres?: number;
  correlation_confidence?: number;
  correlation_method?: string;
  lytx_event_count: number;
  guardian_event_count: number;
  total_event_count: number;
  avg_lytx_safety_score?: number;
  correlation_quality: string;
}

interface UseDVTDRelationshipsOptions {
  days?: number;
  correlationQuality?: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
  driverId?: string;
  vehicleId?: string;
  limit?: number;
}

export function useDVTDRelationships(options: UseDVTDRelationshipsOptions = {}) {
  const { days = 30, correlationQuality, driverId, vehicleId, limit = 100 } = options;

  return useQuery({
    queryKey: ['dvtd-relationships', days, correlationQuality, driverId, vehicleId, limit],
    queryFn: async (): Promise<DVTDRelationship[]> => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      let query = supabase
        .from('dvtd_relationships')
        .select('*')
        .gte('trip_date', cutoffDate.toISOString().split('T')[0])
        .order('trip_date', { ascending: false })
        .limit(limit);

      // Apply filters
      if (correlationQuality) {
        query = query.eq('correlation_quality', correlationQuality);
      }

      if (driverId) {
        query = query.eq('driver_id', driverId);
      }

      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching DVTD relationships:', error);
        throw error;
      }

      return (data || []) as DVTDRelationship[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });
}
