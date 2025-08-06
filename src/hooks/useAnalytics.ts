/**
 * ANALYTICS DATA HOOK
 * 
 * React hook for accessing aggregated analytics data from
 * Vercel Postgres analytics warehouse
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { 
  dashboardCache, 
  queryCache, 
  unifiedDataCache,
  withAdvancedCache,
  ADVANCED_CACHE_KEYS,
  ADVANCED_CACHE_CONFIG 
} from '@/lib/advanced-cache';

// Analytics interfaces
export interface FuelAnalytics {
  date: string;
  total_locations: number;
  total_tanks: number;
  avg_fill_percentage: number;
  low_fuel_count: number;
  total_capacity: number;
  total_volume: number;
  consumption_rate: number;
  system_efficiency: number;
}

export interface DeliveryAnalytics {
  date: string;
  total_deliveries: number;
  total_volume: number;
  avg_delivery_size: number;
  unique_customers: number;
  unique_terminals: number;
  carrier_breakdown: Record<string, number>;
}

export interface DashboardSummary {
  totalLocations: number;
  totalTanks: number;
  avgFillPercentage: number;
  lowFuelAlerts: number;
  dailyConsumption: number;
  totalDeliveries: number;
  systemEfficiency: number;
  lastUpdated: string;
}

export interface AnalyticsHealth {
  connected: boolean;
  recordCount: number;
  lastUpdate: string | null;
  error?: string;
}

/**
 * Hook for dashboard summary data (real-time optimized with advanced caching)
 */
export function useDashboardSummary(userId?: string) {
  return useQuery({
    queryKey: ['analytics', 'dashboard-summary', userId],
    queryFn: async () => {
      // Try advanced cache first
      const cached = await dashboardCache.getDashboardSummary(userId);
      if (cached) {
        return cached as DashboardSummary;
      }

      // Fetch fresh data
      const response = await fetch('/api/analytics-aggregation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summary', userId })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch dashboard summary');
      }
      
      const data = await response.json();
      const summary = data.data as DashboardSummary;
      
      // Cache the result
      await dashboardCache.setDashboardSummary(summary, userId);
      
      return summary;
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000, // Consider stale after 2 minutes
    retry: 2
  });
}

/**
 * Hook for analytics health monitoring
 */
export function useAnalyticsHealth() {
  return useQuery({
    queryKey: ['analytics', 'health'],
    queryFn: async () => {
      const response = await fetch('/api/analytics-aggregation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health' })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check analytics health');
      }
      
      const data = await response.json();
      return data.data as AnalyticsHealth;
    },
    refetchInterval: 30 * 1000, // Check every 30 seconds
    retry: 1
  });
}

/**
 * Hook for triggering data aggregation
 */
export function useDataAggregation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAggregating, setIsAggregating] = useState(false);

  const aggregateMutation = useMutation({
    mutationFn: async ({ 
      date, 
      forceRefresh = false, 
      systems = ['smartfill', 'agbot', 'captive_payments'] 
    }: { 
      date?: string; 
      forceRefresh?: boolean; 
      systems?: string[]; 
    }) => {
      const response = await fetch('/api/analytics-aggregation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'aggregate',
          date: date || new Date().toISOString().split('T')[0],
          forceRefresh,
          systems
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Aggregation failed');
      }
      
      return response.json();
    },
    onMutate: () => {
      setIsAggregating(true);
    },
    onSuccess: (data) => {
      setIsAggregating(false);
      
      // Invalidate and refetch analytics data
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
      
      const hasErrors = data.data?.errors?.length > 0;
      toast({
        title: hasErrors ? 'Aggregation completed with warnings' : 'Data aggregated successfully',
        description: hasErrors 
          ? `Completed with ${data.data.errors.length} warnings` 
          : 'All systems data aggregated',
        variant: hasErrors ? 'default' : 'default'
      });
    },
    onError: (error: Error) => {
      setIsAggregating(false);
      toast({
        title: 'Aggregation failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  return {
    aggregate: aggregateMutation.mutate,
    isAggregating: isAggregating || aggregateMutation.isPending,
    error: aggregateMutation.error
  };
}

/**
 * Hook for historical fuel analytics with advanced caching
 */
export function useFuelAnalytics(
  startDate: string, 
  endDate: string, 
  systems: string[] = ['smartfill', 'agbot']
) {
  return useQuery({
    queryKey: ['analytics', 'fuel', startDate, endDate, systems],
    queryFn: async () => {
      const timeRange = `${startDate}_${endDate}`;
      
      // Try advanced cache first
      const cached = await dashboardCache.getFuelChart(timeRange, systems);
      if (cached) {
        return cached as FuelAnalytics[];
      }

      // Fetch fresh data
      const response = await fetch('/api/analytics-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'fuel',
          startDate,
          endDate,
          systems
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch fuel analytics');
      }
      
      const data = await response.json();
      const fuelData = data.data as FuelAnalytics[];
      
      // Cache the result
      await dashboardCache.setFuelChart(fuelData, timeRange, systems);
      
      return fuelData;
    },
    enabled: !!startDate && !!endDate,
    staleTime: 10 * 60 * 1000 // 10 minutes
  });
}

/**
 * Hook for historical delivery analytics
 */
export function useDeliveryAnalytics(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ['analytics', 'delivery', startDate, endDate],
    queryFn: async () => {
      const response = await fetch('/api/analytics-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'delivery',
          startDate,
          endDate
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch delivery analytics');
      }
      
      const data = await response.json();
      return data.data as DeliveryAnalytics[];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 10 * 60 * 1000 // 10 minutes
  });
}

/**
 * Combined analytics hook for dashboard
 */
export function useDashboardAnalytics() {
  const summary = useDashboardSummary();
  const health = useAnalyticsHealth();
  const aggregation = useDataAggregation();

  // Get date range for recent trends (last 30 days)
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  const fuelTrends = useFuelAnalytics(startDate, endDate);
  const deliveryTrends = useDeliveryAnalytics(startDate, endDate);

  return {
    // Real-time data
    summary: summary.data,
    summaryLoading: summary.isLoading,
    summaryError: summary.error,

    // System health
    health: health.data,
    healthLoading: health.isLoading,
    healthError: health.error,

    // Historical trends
    fuelTrends: fuelTrends.data || [],
    deliveryTrends: deliveryTrends.data || [],
    trendsLoading: fuelTrends.isLoading || deliveryTrends.isLoading,

    // Actions
    refreshData: () => {
      summary.refetch();
      fuelTrends.refetch();
      deliveryTrends.refetch();
    },
    aggregateData: aggregation.aggregate,
    isAggregating: aggregation.isAggregating,

    // Computed status
    isHealthy: health.data?.connected && !health.data?.error,
    isUpToDate: summary.data ? 
      (Date.now() - new Date(summary.data.lastUpdated).getTime()) < 60 * 60 * 1000 : false, // Less than 1 hour old
    hasRecentData: (fuelTrends.data?.length || 0) > 0 || (deliveryTrends.data?.length || 0) > 0
  };
}

/**
 * Hook for performance metrics
 */
export function usePerformanceMetrics(metricName?: string, days: number = 7) {
  const endDate = new Date().toISOString();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  return useQuery({
    queryKey: ['analytics', 'performance', metricName, days],
    queryFn: async () => {
      const response = await fetch('/api/analytics-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'performance',
          metricName,
          startDate,
          endDate,
          limit: 100
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch performance metrics');
      }
      
      const data = await response.json();
      return data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000 // 10 minutes
  });
}

/**
 * Hook for initializing analytics system
 */
export function useAnalyticsInitialization() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/analytics-aggregation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init' })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Initialization failed');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Analytics system initialized',
        description: 'Database tables and indexes created successfully'
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Initialization failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });
}

/**
 * Hook for cross-system data queries with advanced caching
 */
export function useCrossSystemData(
  systems: string[],
  dateRange: string,
  filters: Record<string, any> = {}
) {
  return useQuery({
    queryKey: ['analytics', 'cross-system', systems, dateRange, filters],
    queryFn: async () => {
      // Use advanced query cache
      return await withAdvancedCache(
        ADVANCED_CACHE_KEYS.QUERIES.CROSS_SYSTEM(systems, dateRange, filters),
        async () => {
          const response = await fetch('/api/cross-system-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systems,
              dateRange,
              filters
            })
          });
          
          if (!response.ok) {
            throw new Error('Failed to fetch cross-system data');
          }
          
          const data = await response.json();
          return data.data;
        },
        ADVANCED_CACHE_CONFIG.UNIFIED_DATA
      );
    },
    enabled: systems.length > 0 && !!dateRange,
    staleTime: 15 * 60 * 1000 // 15 minutes
  });
}

/**
 * Hook for unified location data from multiple systems
 */
export function useUnifiedLocationData(
  locationId: string,
  includeSystems: string[] = ['smartfill', 'agbot', 'captive_payments']
) {
  return useQuery({
    queryKey: ['unified', 'location', locationId, includeSystems],
    queryFn: async () => {
      const cached = await unifiedDataCache.getLocationData(locationId, includeSystems);
      if (cached) {
        return cached;
      }

      const response = await fetch('/api/unified-location-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          includeSystems
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch unified location data');
      }
      
      const data = await response.json();
      
      // Cache the result
      await unifiedDataCache.setLocationData(data.data, locationId, includeSystems);
      
      return data.data;
    },
    enabled: !!locationId,
    staleTime: 10 * 60 * 1000 // 10 minutes
  });
}

/**
 * Hook for complex analytics queries with intelligent caching
 */
export function useComplexAnalyticsQuery(
  queryType: string,
  params: Record<string, any>
) {
  // Generate a hash for the query to create a consistent cache key
  const queryHash = btoa(JSON.stringify({ queryType, ...params })).slice(0, 16);

  return useQuery({
    queryKey: ['analytics', 'complex', queryType, params],
    queryFn: async () => {
      const cached = await queryCache.getComplexQuery(queryHash, params);
      if (cached) {
        return cached;
      }

      const response = await fetch('/api/complex-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryType,
          params
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to execute ${queryType} query`);
      }
      
      const data = await response.json();
      
      // Cache the result
      await queryCache.setComplexQuery(data.data, queryHash, params);
      
      return data.data;
    },
    enabled: !!queryType,
    staleTime: 20 * 60 * 1000 // 20 minutes for complex queries
  });
}

/**
 * Hook for system status with unified data caching
 */
export function useSystemStatus(systems: string[] = ['smartfill', 'agbot', 'captive_payments']) {
  return useQuery({
    queryKey: ['unified', 'system-status', systems],
    queryFn: async () => {
      const cached = await unifiedDataCache.getSystemStatus(systems);
      if (cached) {
        return cached;
      }

      const response = await fetch('/api/system-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systems })
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch system status');
      }
      
      const data = await response.json();
      
      // Cache the result
      await unifiedDataCache.setSystemStatus(data.data, systems);
      
      return data.data;
    },
    refetchInterval: 30 * 1000, // Every 30 seconds for status
    staleTime: 15 * 1000 // Consider stale after 15 seconds
  });
}