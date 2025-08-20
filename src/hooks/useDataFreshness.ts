import { useState, useEffect, useCallback } from 'react';
import { 
  getDataFreshnessDashboard, 
  refreshDataFreshness,
  getFreshnessSummary,
  DataFreshnessDashboard,
  FreshnessStatus
} from '@/api/dataFreshness';

interface UseDataFreshnessReturn {
  // Data
  sources: DataFreshnessDashboard[];
  summary: {
    total_sources: number;
    fresh_sources: number;
    stale_sources: number;
    critical_sources: number;
    last_refresh: string;
  } | null;
  
  // State
  isLoading: boolean;
  error: string | null;
  isRefreshing: boolean;
  refreshingSources: Set<string>;
  
  // Actions
  refreshAll: () => Promise<void>;
  refreshSource: (sourceKey: string) => Promise<void>;
  reload: () => Promise<void>;
}

interface UseDataFreshnessOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
  onError?: (error: string) => void;
}

export function useDataFreshness(options: UseDataFreshnessOptions = {}): UseDataFreshnessReturn {
  const {
    autoRefresh = true,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    onError
  } = options;

  // State
  const [sources, setSources] = useState<DataFreshnessDashboard[]>([]);
  const [summary, setSummary] = useState<UseDataFreshnessReturn['summary']>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingSources, setRefreshingSources] = useState<Set<string>>(new Set());

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load dashboard data and summary in parallel
      const [dashboardResult, summaryResult] = await Promise.all([
        getDataFreshnessDashboard(),
        getFreshnessSummary()
      ]);

      if (dashboardResult.error) {
        throw new Error('Failed to load dashboard data: ' + dashboardResult.error.message);
      }

      if (summaryResult.error) {
        console.warn('Failed to load summary data:', summaryResult.error);
      }

      setSources(dashboardResult.data || []);
      setSummary(summaryResult.data);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [onError]);

  // Refresh all data sources
  const refreshAll = useCallback(async () => {
    try {
      setIsRefreshing(true);
      setError(null);

      // Refresh freshness data
      const refreshResult = await refreshDataFreshness();
      
      if (refreshResult.error) {
        throw new Error('Failed to refresh data: ' + refreshResult.error.message);
      }

      // Reload the dashboard
      await loadData();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh data';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadData, onError]);

  // Refresh specific source
  const refreshSource = useCallback(async (sourceKey: string) => {
    try {
      setRefreshingSources(prev => new Set(prev).add(sourceKey));
      setError(null);

      // For now, we refresh all data since our function refreshes everything
      // In a real implementation, you might have source-specific refresh endpoints
      const refreshResult = await refreshDataFreshness();
      
      if (refreshResult.error) {
        throw new Error(`Failed to refresh ${sourceKey}: ` + refreshResult.error.message);
      }

      // Reload only the dashboard data
      const dashboardResult = await getDataFreshnessDashboard();
      
      if (dashboardResult.error) {
        throw new Error('Failed to reload dashboard data: ' + dashboardResult.error.message);
      }

      setSources(dashboardResult.data || []);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to refresh ${sourceKey}`;
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setRefreshingSources(prev => {
        const newSet = new Set(prev);
        newSet.delete(sourceKey);
        return newSet;
      });
    }
  }, [onError]);

  // Reload data (same as loadData but callable from outside)
  const reload = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh timer
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;

    const interval = setInterval(() => {
      // Only auto-refresh if not currently loading or refreshing
      if (!isLoading && !isRefreshing && refreshingSources.size === 0) {
        loadData();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, isLoading, isRefreshing, refreshingSources.size, loadData]);

  return {
    // Data
    sources,
    summary,
    
    // State
    isLoading,
    error,
    isRefreshing,
    refreshingSources,
    
    // Actions
    refreshAll,
    refreshSource,
    reload
  };
}

// Helper hook for a specific source
export function useSourceFreshness(sourceKey: string) {
  const { sources, refreshSource, refreshingSources } = useDataFreshness();
  
  const source = sources.find(s => s.source_key === sourceKey);
  const isRefreshing = refreshingSources.has(sourceKey);
  
  const refresh = useCallback(() => {
    return refreshSource(sourceKey);
  }, [refreshSource, sourceKey]);

  return {
    source,
    isRefreshing,
    refresh
  };
}

// Helper to get freshness status color
export function getFreshnessColor(status?: FreshnessStatus): string {
  switch (status) {
    case 'fresh':
      return 'text-green-600 bg-green-100 border-green-200';
    case 'stale':
      return 'text-yellow-600 bg-yellow-100 border-yellow-200';
    case 'very_stale':
      return 'text-orange-600 bg-orange-100 border-orange-200';
    case 'critical':
      return 'text-red-600 bg-red-100 border-red-200';
    default:
      return 'text-gray-600 bg-gray-100 border-gray-200';
  }
}

// Helper to format freshness percentage as color
export function getFreshnessProgressColor(percentage?: number): string {
  if (!percentage) return 'bg-gray-300';
  
  if (percentage >= 80) return 'bg-green-500';
  if (percentage >= 60) return 'bg-yellow-500';
  if (percentage >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}