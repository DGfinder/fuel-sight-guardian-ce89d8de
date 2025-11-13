import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRoutePatterns,
  getRouteOptimizationOpportunities,
  updateRoutePatterns,
  getRoutePatternStats,
  importMtDataTrips,
  getTripCount,
  getUniqueRoutes,
  getTripDateRange,
  type RoutePatternFilters
} from '@/api/routePatterns';
import type { MtDataTripRow } from '@/utils/mtdataExcelParser';
import { toast } from 'sonner';

/**
 * Query route patterns from database
 */
export function useRoutePatterns(filters?: RoutePatternFilters) {
  return useQuery({
    queryKey: ['routePatterns', filters],
    queryFn: () => getRoutePatterns(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Query route optimization opportunities
 */
export function useRouteOptimizationOpportunities(minTripCount: number = 10) {
  return useQuery({
    queryKey: ['routeOptimizationOpportunities', minTripCount],
    queryFn: () => getRouteOptimizationOpportunities(minTripCount),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Query route pattern statistics
 */
export function useRoutePatternStats() {
  return useQuery({
    queryKey: ['routePatternStats'],
    queryFn: getRoutePatternStats,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Query trip count
 */
export function useTripCount(filters?: Parameters<typeof getTripCount>[0]) {
  return useQuery({
    queryKey: ['tripCount', filters],
    queryFn: () => getTripCount(filters),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Query unique routes
 */
export function useUniqueRoutes() {
  return useQuery({
    queryKey: ['uniqueRoutes'],
    queryFn: getUniqueRoutes,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Query trip date range
 */
export function useTripDateRange() {
  return useQuery({
    queryKey: ['tripDateRange'],
    queryFn: getTripDateRange,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Mutation to update route patterns
 */
export function useUpdateRoutePatterns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRoutePatterns,
    onSuccess: () => {
      // Invalidate all route pattern queries
      queryClient.invalidateQueries({ queryKey: ['routePatterns'] });
      queryClient.invalidateQueries({ queryKey: ['routeOptimizationOpportunities'] });
      queryClient.invalidateQueries({ queryKey: ['routePatternStats'] });
      queryClient.invalidateQueries({ queryKey: ['uniqueRoutes'] });

      toast.success('Route patterns updated successfully', {
        description: 'All route analytics have been regenerated from trip history.'
      });
    },
    onError: (error) => {
      console.error('Error updating route patterns:', error);
      toast.error('Failed to update route patterns', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });
}

/**
 * Mutation to import MtData trips
 */
export function useImportMtDataTrips() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (trips: MtDataTripRow[]) => importMtDataTrips(trips),
    onSuccess: (data) => {
      // Invalidate trip-related queries
      queryClient.invalidateQueries({ queryKey: ['tripCount'] });
      queryClient.invalidateQueries({ queryKey: ['uniqueRoutes'] });
      queryClient.invalidateQueries({ queryKey: ['tripDateRange'] });

      toast.success(`Successfully imported ${data.length} trips`, {
        description: 'Trips have been added to the database. Consider regenerating route patterns.'
      });
    },
    onError: (error) => {
      console.error('Error importing trips:', error);
      toast.error('Failed to import trips to database', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });
}

/**
 * Combined hook for route analysis dashboard
 */
export function useRouteAnalysisDashboard(filters?: RoutePatternFilters) {
  const patterns = useRoutePatterns(filters);
  const stats = useRoutePatternStats();
  const tripCount = useTripCount();
  const dateRange = useTripDateRange();

  return {
    patterns: patterns.data || [],
    stats: stats.data,
    tripCount: tripCount.data || 0,
    dateRange: dateRange.data,
    isLoading: patterns.isLoading || stats.isLoading || tripCount.isLoading || dateRange.isLoading,
    error: patterns.error || stats.error || tripCount.error || dateRange.error,
    refetch: () => {
      patterns.refetch();
      stats.refetch();
      tripCount.refetch();
      dateRange.refetch();
    }
  };
}
