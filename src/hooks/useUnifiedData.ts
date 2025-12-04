/**
 * UNIFIED DATA HOOKS
 * 
 * React hooks for accessing unified data across SmartFill, AgBot,
 * and Captive Payments systems with advanced caching and correlation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import {
  UnifiedLocation,
  UnifiedCustomer,
  UnifiedDelivery
} from '@/lib/unified-data-integration';
import { supabase } from '@/lib/supabase';

// Interface for unified data hooks
interface UnifiedDataOptions {
  includeSystems?: string[];
  includeHistory?: boolean;
  timeRange?: {
    startDate: string;
    endDate: string;
  };
  refreshInterval?: number;
  enabled?: boolean;
}

interface CrossSystemFilters {
  customerId?: string;
  locationId?: string;
  fuelType?: string;
  carrier?: string;
}

/**
 * Hook for unified location data
 */
export function useUnifiedLocation(
  locationId: string,
  options: UnifiedDataOptions = {}
) {
  const {
    includeSystems = ['smartfill', 'agbot', 'captive_payments'],
    includeHistory = false,
    timeRange,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    enabled = true
  } = options;

  return useQuery({
    queryKey: ['unified', 'location', locationId, includeSystems, includeHistory, timeRange],
    queryFn: async () => {
      const response = await fetch('/api/unified-location-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          includeSystems,
          includeHistory,
          timeRange
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch unified location data');
      }
      
      const data = await response.json();
      return data.data;
    },
    enabled: enabled && !!locationId,
    refetchInterval: refreshInterval,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
}

/**
 * Hook for multiple unified locations - FIXED: Single batch query instead of N+1
 */
export function useUnifiedLocations(
  locationIds: string[],
  options: UnifiedDataOptions = {}
) {
  const {
    refreshInterval = 5 * 60 * 1000,
    enabled = true
  } = options;

  const query = useQuery({
    queryKey: ['unified-locations-batch', locationIds],
    queryFn: async () => {
      if (!locationIds.length) return [];

      // Single batch query using .in() filter
      const { data, error } = await supabase
        .from('ta_tank_full_status')
        .select('*')
        .in('id', locationIds);

      if (error) {
        throw new Error(error.message || 'Failed to fetch unified locations');
      }

      return data || [];
    },
    enabled: enabled && locationIds.length > 0,
    refetchInterval: refreshInterval,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });

  return {
    locations: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  };
}

/**
 * Hook for cross-system analytics
 */
export function useCrossSystemAnalytics(
  dateRange: { startDate: string; endDate: string },
  systems: string[] = ['smartfill', 'agbot', 'captive_payments'],
  filters: CrossSystemFilters = {},
  aggregation: 'daily' | 'weekly' | 'monthly' = 'daily'
) {
  return useQuery({
    queryKey: ['cross-system', 'analytics', dateRange, systems, filters, aggregation],
    queryFn: async () => {
      const response = await fetch('/api/cross-system-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analytics',
          systems,
          dateRange,
          filters,
          aggregation
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch cross-system analytics');
      }
      
      const data = await response.json();
      return data.data;
    },
    enabled: !!dateRange.startDate && !!dateRange.endDate,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 15 * 60 * 1000 // 15 minutes
  });
}

/**
 * Hook for correlated delivery data
 */
export function useCorrelatedDeliveries(
  dateRange: { startDate: string; endDate: string },
  filters: CrossSystemFilters = {}
) {
  return useQuery({
    queryKey: ['cross-system', 'deliveries', dateRange, filters],
    queryFn: async () => {
      const response = await fetch('/api/cross-system-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deliveries',
          dateRange,
          filters
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch correlated deliveries');
      }
      
      const data = await response.json();
      return data.data;
    },
    enabled: !!dateRange.startDate && !!dateRange.endDate,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}

/**
 * Hook for data correlation analysis
 */
export function useDataCorrelation(
  dateRange: { startDate: string; endDate: string },
  systems: string[] = ['smartfill', 'agbot', 'captive_payments'],
  filters: CrossSystemFilters = {}
) {
  return useQuery({
    queryKey: ['cross-system', 'correlation', dateRange, systems, filters],
    queryFn: async () => {
      const response = await fetch('/api/cross-system-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'correlation',
          systems,
          dateRange,
          filters
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch correlation analysis');
      }
      
      const data = await response.json();
      return data.data;
    },
    enabled: !!dateRange.startDate && !!dateRange.endDate,
    staleTime: 30 * 60 * 1000 // 30 minutes
  });
}

/**
 * Hook for system health monitoring
 */
export function useSystemHealth(
  systems: string[] = ['smartfill', 'agbot', 'captive_payments']
) {
  return useQuery({
    queryKey: ['cross-system', 'health', systems],
    queryFn: async () => {
      const response = await fetch('/api/cross-system-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'health',
          systems
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch system health');
      }
      
      const data = await response.json();
      return data.data;
    },
    refetchInterval: 30 * 1000, // Every 30 seconds
    staleTime: 15 * 1000 // 15 seconds
  });
}

/**
 * Hook for unified customer data (combines all customer-related info)
 */
export function useUnifiedCustomer(
  customerId: string,
  options: UnifiedDataOptions = {}
) {
  const {
    timeRange,
    enabled = true
  } = options;

  // Get customer locations
  const locationsQuery = useQuery({
    queryKey: ['unified', 'customer-locations', customerId],
    queryFn: async () => {
      // This would fetch all locations for a customer
      const response = await fetch('/api/customer-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch customer locations');
      }
      
      return response.json();
    },
    enabled: enabled && !!customerId
  });

  // Get customer deliveries
  const deliveriesQuery = useCorrelatedDeliveries(
    timeRange || {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    },
    { customerId }
  );

  // Get cross-system analytics for this customer
  const analyticsQuery = useCrossSystemAnalytics(
    timeRange || {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    },
    ['smartfill', 'agbot', 'captive_payments'],
    { customerId }
  );

  return {
    customer: {
      id: customerId,
      locations: locationsQuery.data?.locations || [],
      deliveries: deliveriesQuery.data?.deliveries || [],
      analytics: analyticsQuery.data,
      summary: deliveriesQuery.data?.summary
    },
    isLoading: locationsQuery.isLoading || deliveriesQuery.isLoading || analyticsQuery.isLoading,
    error: locationsQuery.error || deliveriesQuery.error || analyticsQuery.error,
    refetch: () => {
      locationsQuery.refetch();
      deliveriesQuery.refetch();
      analyticsQuery.refetch();
    }
  };
}

/**
 * Hook for unified dashboard data (combines multiple data sources)
 */
export function useUnifiedDashboard(
  timeRange?: { startDate: string; endDate: string },
  systems: string[] = ['smartfill', 'agbot', 'captive_payments']
) {
  const defaultTimeRange = {
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  };

  const dateRange = timeRange || defaultTimeRange;

  // Get cross-system analytics
  const analytics = useCrossSystemAnalytics(dateRange, systems);
  
  // Get system health
  const health = useSystemHealth(systems);
  
  // Get recent deliveries
  const deliveries = useCorrelatedDeliveries(dateRange);
  
  // Get correlation analysis
  const correlation = useDataCorrelation(dateRange, systems);

  return {
    // Core data
    analytics: analytics.data,
    health: health.data,
    deliveries: deliveries.data,
    correlation: correlation.data,

    // Loading states
    isLoading: analytics.isLoading || health.isLoading || deliveries.isLoading,
    
    // Error handling
    errors: {
      analytics: analytics.error,
      health: health.error,
      deliveries: deliveries.error,
      correlation: correlation.error
    },
    
    // Actions
    refresh: () => {
      analytics.refetch();
      health.refetch();
      deliveries.refetch();
      correlation.refetch();
    },
    
    // Computed values
    isHealthy: health.data?.overall === 'healthy',
    systemCount: systems.length,
    hasData: !!(analytics.data || deliveries.data),
    
    // Summary metrics
    summary: {
      totalLocations: analytics.data?.summary?.totalLocations || 0,
      totalTanks: analytics.data?.summary?.totalTanks || 0,
      totalDeliveries: deliveries.data?.summary?.totalDeliveries || 0,
      correlationScore: analytics.data?.summary?.correlationScore || 0,
      systemsOperational: health.data ? 
        Object.values(health.data.systems).filter((s: any) => s.available).length : 0
    }
  };
}

/**
 * Hook for real-time unified data updates
 */
export function useUnifiedDataUpdates(
  subscriptions: Array<{
    type: 'location' | 'customer' | 'system';
    id: string;
    systems?: string[];
  }>
) {
  const [updates, setUpdates] = useState<Array<{
    timestamp: string;
    type: string;
    id: string;
    data: any;
  }>>([]);
  
  const queryClient = useQueryClient();

  // In a real implementation, this would use WebSocket or Server-Sent Events
  // For now, it's a polling-based approach
  const { data: latestUpdates } = useQuery({
    queryKey: ['unified', 'updates', subscriptions],
    queryFn: async () => {
      // This would poll for updates
      return updates;
    },
    refetchInterval: 30 * 1000, // Every 30 seconds
    enabled: subscriptions.length > 0
  });

  const processUpdate = (update: any) => {
    setUpdates(prev => [update, ...prev.slice(0, 99)]); // Keep last 100 updates
    
    // Invalidate relevant queries
    subscriptions.forEach(sub => {
      if (sub.type === update.type && sub.id === update.id) {
        queryClient.invalidateQueries({ 
          queryKey: ['unified', sub.type, sub.id] 
        });
      }
    });
  };

  return {
    updates,
    latestUpdate: updates[0],
    updateCount: updates.length,
    clearUpdates: () => setUpdates([])
  };
}

/**
 * Hook for data quality monitoring
 */
export function useDataQualityMonitoring(
  systems: string[] = ['smartfill', 'agbot', 'captive_payments']
) {
  const [qualityIssues, setQualityIssues] = useState<Array<{
    system: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: string;
  }>>([]);

  const { toast } = useToast();

  return useQuery({
    queryKey: ['unified', 'data-quality', systems],
    queryFn: async () => {
      // This would analyze data quality across systems
      const quality = {
        overall: 0.92,
        systems: systems.map(system => ({
          name: system,
          score: 0.85 + Math.random() * 0.15,
          issues: Math.floor(Math.random() * 3),
          lastUpdate: new Date().toISOString()
        })),
        trends: {
          improving: true,
          averageScore: 0.89
        }
      };

      // Check for new quality issues
      quality.systems.forEach(system => {
        if (system.score < 0.8 && !qualityIssues.find(issue => 
          issue.system === system.name && 
          new Date(issue.timestamp).getTime() > Date.now() - 60000
        )) {
          const newIssue = {
            system: system.name,
            issue: 'Data quality below threshold',
            severity: system.score < 0.6 ? 'high' as const : 'medium' as const,
            timestamp: new Date().toISOString()
          };
          
          setQualityIssues(prev => [newIssue, ...prev.slice(0, 49)]);
          
          toast({
            title: 'Data Quality Alert',
            description: `${system.name} data quality is ${Math.round(system.score * 100)}%`,
            variant: system.score < 0.6 ? 'destructive' : 'default'
          });
        }
      });

      return quality;
    },
    refetchInterval: 2 * 60 * 1000, // Every 2 minutes
    staleTime: 60 * 1000 // 1 minute
  });
}

/**
 * Utility hook for unified data mutations
 */
export function useUnifiedDataMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (data: {
      action: 'refresh' | 'sync' | 'correlate';
      target: 'location' | 'customer' | 'system';
      id: string;
      systems?: string[];
    }) => {
      const response = await fetch('/api/unified-data-mutation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Mutation failed');
      }
      
      return response.json();
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ 
        queryKey: ['unified', variables.target, variables.id] 
      });
      
      toast({
        title: 'Data updated successfully',
        description: `${variables.action} completed for ${variables.target} ${variables.id}`
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Data update failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  return {
    mutate: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error
  };
}