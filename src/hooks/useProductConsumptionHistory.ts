import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface ProductConsumptionSnapshot {
  id: string;
  product_id: string;
  snapshot_date: string;
  total_tanks: number;
  tanks_critical: number;
  tanks_low: number;
  tanks_normal: number;
  total_daily_consumption_liters: number;
  avg_daily_consumption_per_tank_liters: number;
  total_consumption_7_days_liters: number;
  total_consumption_30_days_liters: number;
  total_capacity_liters: number;
  total_current_level_liters: number;
  avg_fill_percent: number;
  efficiency_score: number;
  avg_days_until_empty: number;
  min_days_until_empty: number;
  dominant_trend: string;
  created_at: string;
}

export interface ChartDataPoint {
  date: string;
  consumption: number;
  tanks: number;
  fillPercent: number;
  efficiencyScore: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Hook to fetch historical product consumption snapshots
 * Supports filtering by product and date range for trend charts
 */
export const useProductConsumptionHistory = (
  productId?: string,
  dateRange?: DateRange
) => {
  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ['product-consumption-history', productId, dateRange?.from, dateRange?.to],
    queryFn: async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        return [];
      }

      let query = supabase
        .from('ta_product_consumption_snapshots')
        .select('*')
        .order('snapshot_date', { ascending: true });

      // Filter by product if specified
      if (productId) {
        query = query.eq('product_id', productId);
      }

      // Filter by date range if specified
      if (dateRange) {
        query = query
          .gte('snapshot_date', dateRange.from.toISOString().split('T')[0])
          .lte('snapshot_date', dateRange.to.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('[PRODUCT_HISTORY] Error fetching consumption history:', error);
        throw error;
      }

      return (data || []) as ProductConsumptionSnapshot[];
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

  const history = historyQuery.data || [];

  return {
    history,
    data: history,
    isLoading: historyQuery.isLoading,
    error: historyQuery.error,
    refetch: historyQuery.refetch,

    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ['product-consumption-history'] });
    },

    // Helper: Format data for Recharts line/bar charts
    getChartData: (): ChartDataPoint[] => {
      return history.map(snapshot => ({
        date: snapshot.snapshot_date,
        consumption: snapshot.total_daily_consumption_liters,
        tanks: snapshot.total_tanks,
        fillPercent: Number(snapshot.avg_fill_percent),
        efficiencyScore: snapshot.efficiency_score
      }));
    },

    // Helper: Get data for specific product
    getProductHistory: (prodId: string): ProductConsumptionSnapshot[] => {
      return history.filter(h => h.product_id === prodId);
    },

    // Helper: Get latest snapshot
    getLatestSnapshot: (): ProductConsumptionSnapshot | null => {
      return history.length > 0 ? history[history.length - 1] : null;
    },

    // Helper: Calculate consumption trend (% change from first to last)
    getConsumptionTrend: (): number | null => {
      if (history.length < 2) return null;

      const first = history[0];
      const last = history[history.length - 1];

      if (first.total_daily_consumption_liters === 0) return null;

      return ((last.total_daily_consumption_liters - first.total_daily_consumption_liters) /
        first.total_daily_consumption_liters) * 100;
    },

    // Helper: Get average consumption over period
    getAverageConsumption: (): number => {
      if (history.length === 0) return 0;

      const total = history.reduce((sum, h) => sum + h.total_daily_consumption_liters, 0);
      return Math.round(total / history.length);
    },

    // Helper: Get data grouped by product (for multi-line charts)
    getGroupedByProduct: (): Record<string, ChartDataPoint[]> => {
      const grouped: Record<string, ChartDataPoint[]> = {};

      history.forEach(snapshot => {
        if (!grouped[snapshot.product_id]) {
          grouped[snapshot.product_id] = [];
        }

        grouped[snapshot.product_id].push({
          date: snapshot.snapshot_date,
          consumption: snapshot.total_daily_consumption_liters,
          tanks: snapshot.total_tanks,
          fillPercent: Number(snapshot.avg_fill_percent),
          efficiencyScore: snapshot.efficiency_score
        });
      });

      return grouped;
    }
  };
};

export default useProductConsumptionHistory;
