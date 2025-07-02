import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { DipReading } from '@/types/fuel';

interface HistoryDipReading {
  id: string;
  tank_id: string;
  value: number;
  created_at: string;
  recorded_by: string;
  notes: string;
  updated_at: string;
}

interface UseTankHistoryParams {
  tankId: string;
  enabled?: boolean;
  days?: number;
}

export function useTankHistory({ tankId, enabled = true, days = 30 }: UseTankHistoryParams) {
  return useQuery({
    queryKey: ['tank-history', tankId, days],
    queryFn: async () => {
      console.log(`Fetching ${days} days of history for tank ${tankId}`);
      
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      
      const { data, error } = await supabase
        .from('dip_readings')
        .select('*')
        .eq('tank_id', tankId)
        .gte('created_at', fromDate.toISOString())
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching tank history:', error);
        throw error;
      }
      
      console.log(`Fetched ${data?.length || 0} dip readings for tank ${tankId}`);
      
      return (data || []).map((reading: DipReading) => ({
        ...reading,
        id: reading.id,
        tank_id: reading.tank_id,
        value: reading.value,
        created_at: reading.created_at,
        recorded_by: reading.recorded_by,
      }));
    },
    enabled: enabled && !!tankId,
  });
}
