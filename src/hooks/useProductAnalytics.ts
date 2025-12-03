import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export interface ProductAnalytics {
  product_id: string;
  product_name: string;
  product_code: string;

  // Tank Counts
  total_tanks: number;
  unique_groups: number;
  unique_locations: number;
  tanks_critical: number;
  tanks_low: number;
  tanks_normal: number;

  // Percentages
  percent_critical: number;
  percent_low: number;
  percent_normal: number;

  // Capacity Metrics
  total_capacity_liters: number;
  total_current_level_liters: number;
  total_usable_capacity_liters: number;
  avg_fill_percent: number;

  // Consumption Metrics
  avg_daily_consumption_per_tank_liters: number;
  total_daily_consumption_liters: number;
  total_consumption_7_days_liters: number;
  total_consumption_30_days_liters: number;
  avg_consumption_7_days_per_tank_liters: number;
  avg_consumption_30_days_per_tank_liters: number;
  max_peak_daily_consumption_liters: number;
  avg_peak_daily_consumption_liters: number;

  // Days Until Empty
  avg_days_until_empty: number;
  min_days_until_empty: number;
  avg_days_until_min_level: number;
  min_days_until_min_level: number;

  // Refill Metrics
  tanks_with_refill_data: number;
  avg_refill_volume_liters: number;
  avg_refill_interval_days: number;

  // Trends
  tanks_trend_increasing: number;
  tanks_trend_decreasing: number;
  tanks_trend_stable: number;
  avg_trend_percent_change: number;
  dominant_trend: 'increasing' | 'decreasing' | 'stable';

  // Efficiency
  tanks_efficiency_improving: number;
  tanks_efficiency_degrading: number;
  tanks_efficiency_stable: number;

  // Data Quality
  tanks_data_fresh: number;
  tanks_data_stale: number;
  tanks_data_outdated: number;
  avg_days_since_last_dip: number;

  // Anomalies & Alerts
  tanks_with_anomalies: number;
  tanks_order_now: number;
  tanks_order_soon: number;

  // Predictability
  tanks_predictability_high: number;
  tanks_predictability_medium: number;
  tanks_predictability_low: number;
  avg_consumption_stddev: number;

  // Efficiency Score
  efficiency_score: number;

  // Metadata
  calculated_at: string;
}

export interface ProductAnalyticsSummary {
  totalProducts: number;
  totalTanks: number;
  totalCriticalTanks: number;
  totalDailyConsumptionLiters: number;
  totalCapacityLiters: number;
  totalCurrentLevelLiters: number;
  networkFillPercent: number;
  mostConsumedProduct: ProductAnalytics | null;
  leastEfficientProduct: ProductAnalytics | null;
  highestEfficiencyProduct: ProductAnalytics | null;
}

export interface ProductComparison {
  product1: ProductAnalytics;
  product2: ProductAnalytics;
  comparison: {
    consumption_difference_liters: number;
    consumption_difference_percent: number;
    efficiency_difference: number;
    avg_days_difference: number;
    tanks_difference: number;
  };
}

/**
 * Hook to fetch product-level analytics from ta_product_analytics materialized view
 * Returns aggregated consumption, capacity, and efficiency metrics by product type
 */
export const useProductAnalytics = () => {
  const queryClient = useQueryClient();

  const productAnalyticsQuery = useQuery({
    queryKey: ['product-analytics'],
    queryFn: async () => {
      // Check authentication
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        return [];
      }

      const { data, error } = await supabase
        .from('ta_product_analytics')
        .select('*')
        .order('total_tanks', { ascending: false });

      if (error) {
        logger.error('[PRODUCT_ANALYTICS] Error fetching product analytics:', error);
        throw error;
      }

      return (data || []) as ProductAnalytics[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (matches tank analytics)
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('No authenticated user')) {
        return false;
      }
      return failureCount < 3;
    }
  });

  const products = productAnalyticsQuery.data || [];

  return {
    products,
    data: products,
    isLoading: productAnalyticsQuery.isLoading,
    error: productAnalyticsQuery.error,
    refetch: productAnalyticsQuery.refetch,

    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ['product-analytics'] });
    },

    // Helper: Get specific product by ID
    getProductById: (productId: string): ProductAnalytics | undefined => {
      return products.find(p => p.product_id === productId);
    },

    // Helper: Get specific product by name
    getProductByName: (productName: string): ProductAnalytics | undefined => {
      return products.find(p => p.product_name.toLowerCase() === productName.toLowerCase());
    },

    // Helper: Get summary statistics
    getSummary: (): ProductAnalyticsSummary | null => {
      if (!products.length) return null;

      const totalTanks = products.reduce((sum, p) => sum + p.total_tanks, 0);
      const totalCritical = products.reduce((sum, p) => sum + p.tanks_critical, 0);
      const totalDailyConsumption = products.reduce((sum, p) => sum + p.total_daily_consumption_liters, 0);
      const totalCapacity = products.reduce((sum, p) => sum + p.total_capacity_liters, 0);
      const totalCurrentLevel = products.reduce((sum, p) => sum + p.total_current_level_liters, 0);

      return {
        totalProducts: products.length,
        totalTanks,
        totalCriticalTanks: totalCritical,
        totalDailyConsumptionLiters: totalDailyConsumption,
        totalCapacityLiters: totalCapacity,
        totalCurrentLevelLiters: totalCurrentLevel,
        networkFillPercent: totalCapacity > 0 ? (totalCurrentLevel / totalCapacity) * 100 : 0,
        mostConsumedProduct: products.reduce((max, p) =>
          p.total_daily_consumption_liters > (max?.total_daily_consumption_liters || 0) ? p : max
        , products[0] || null),
        leastEfficientProduct: products.reduce((min, p) =>
          p.efficiency_score < (min?.efficiency_score || 100) ? p : min
        , products[0] || null),
        highestEfficiencyProduct: products.reduce((max, p) =>
          p.efficiency_score > (max?.efficiency_score || 0) ? p : max
        , products[0] || null)
      };
    },

    // Helper: Compare two products
    compareProducts: (productId1: string, productId2: string): ProductComparison | null => {
      const p1 = products.find(p => p.product_id === productId1);
      const p2 = products.find(p => p.product_id === productId2);

      if (!p1 || !p2) return null;

      return {
        product1: p1,
        product2: p2,
        comparison: {
          consumption_difference_liters: p1.total_daily_consumption_liters - p2.total_daily_consumption_liters,
          consumption_difference_percent: p2.total_daily_consumption_liters > 0
            ? ((p1.total_daily_consumption_liters - p2.total_daily_consumption_liters) / p2.total_daily_consumption_liters) * 100
            : 0,
          efficiency_difference: p1.efficiency_score - p2.efficiency_score,
          avg_days_difference: p1.avg_days_until_empty - p2.avg_days_until_empty,
          tanks_difference: p1.total_tanks - p2.total_tanks
        }
      };
    }
  };
};

export default useProductAnalytics;
