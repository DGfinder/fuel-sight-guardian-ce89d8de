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
  dateFrom?: Date;
  dateTo?: Date;
  searchQuery?: string;
  recordedBy?: string;
  minValue?: number;
  maxValue?: number;
  sortBy?: 'created_at' | 'value' | 'recorded_by';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export function useTankHistory({ 
  tankId, 
  enabled = true, 
  days,
  dateFrom,
  dateTo,
  searchQuery,
  recordedBy,
  minValue,
  maxValue,
  sortBy = 'created_at',
  sortOrder = 'desc',
  limit = 1000,
  offset = 0
}: UseTankHistoryParams) {
  return useQuery({
    queryKey: [
      'tank-history', 
      tankId, 
      days, 
      dateFrom?.toISOString(), 
      dateTo?.toISOString(),
      searchQuery,
      recordedBy,
      minValue,
      maxValue,
      sortBy,
      sortOrder,
      limit,
      offset
    ],
    queryFn: async () => {
      console.log(`Fetching tank history for tank ${tankId} with filters`);
      
      let query = supabase
        .from('dip_readings')
        .select('*', { count: 'exact' })
        .eq('tank_id', tankId);

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

      // Text search in notes and recorded_by
      if (searchQuery) {
        query = query.or(`notes.ilike.%${searchQuery}%,recorded_by.ilike.%${searchQuery}%`);
      }

      // Filter by recorded_by
      if (recordedBy) {
        query = query.eq('recorded_by', recordedBy);
      }

      // Value range filtering
      if (minValue !== undefined) {
        query = query.gte('value', minValue);
      }
      if (maxValue !== undefined) {
        query = query.lte('value', maxValue);
      }

      // Sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Pagination
      if (limit) {
        query = query.range(offset, offset + limit - 1);
      }
      
      const { data, error, count } = await query;
      
      if (error) {
        console.error('Error fetching tank history:', error);
        throw error;
      }
      
      console.log(`Fetched ${data?.length || 0} dip readings for tank ${tankId} (total: ${count})`);
      
      const readings = (data || []).map((reading: HistoryDipReading): DipReading => ({
        id: reading.id,
        tank_id: reading.tank_id,
        value: reading.value,
        created_at: reading.created_at,
        recorded_by: reading.recorded_by,
        notes: reading.notes,
      }));

      return {
        readings,
        totalCount: count || 0,
        hasMore: (count || 0) > offset + (data?.length || 0)
      };
    },
    enabled: enabled && !!tankId,
  });
}

// Hook for getting unique recorded_by values for filter dropdown
export function useTankRecorders(tankId: string) {
  return useQuery({
    queryKey: ['tank-recorders', tankId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dip_readings')
        .select('recorded_by')
        .eq('tank_id', tankId)
        .not('recorded_by', 'is', null);
      
      if (error) throw error;
      
      // Get unique values
      const uniqueRecorders = [...new Set(data.map(r => r.recorded_by))].filter(Boolean);
      return uniqueRecorders.sort();
    },
    enabled: !!tankId,
  });
}

// Hook for getting reading statistics
export function useTankReadingStats(tankId: string, dateFrom?: Date, dateTo?: Date) {
  return useQuery({
    queryKey: ['tank-reading-stats', tankId, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('dip_readings')
        .select('value, created_at')
        .eq('tank_id', tankId);

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
          oldest: null
        };
      }

      const values = data.map(r => r.value).filter(v => v !== null);
      const sortedByDate = data.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      return {
        count: values.length,
        min: Math.min(...values),
        max: Math.max(...values),
        average: values.reduce((sum, val) => sum + val, 0) / values.length,
        latest: sortedByDate[sortedByDate.length - 1],
        oldest: sortedByDate[0]
      };
    },
    enabled: !!tankId,
  });
}
