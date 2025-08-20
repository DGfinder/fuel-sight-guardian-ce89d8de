/**
 * React Query hooks for Driver Profile data
 * Provides optimized data fetching with caching for driver analytics
 */

import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import DriverProfileService, { 
  type UnifiedDriverProfile, 
  type DriverProfileSummary 
} from '@/services/driverProfileService';

// Query keys for consistent caching
export const driverProfileKeys = {
  all: ['driverProfile'] as const,
  profile: (driverId: string, timeframe: string) => [...driverProfileKeys.all, 'profile', driverId, timeframe] as const,
  search: (searchTerm: string, fleet?: string) => [...driverProfileKeys.all, 'search', searchTerm, fleet] as const,
  summaries: (fleet?: string, limit?: number) => [...driverProfileKeys.all, 'summaries', fleet, limit] as const,
};

/**
 * Hook to fetch comprehensive driver profile
 */
export function useDriverProfile(
  driverId: string, 
  timeframe: '30d' | '90d' | '1y' = '30d',
  options?: {
    enabled?: boolean;
    staleTime?: number;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: driverProfileKeys.profile(driverId, timeframe),
    queryFn: () => DriverProfileService.getDriverProfile(driverId, timeframe),
    enabled: options?.enabled ?? !!driverId,
    staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
    refetchInterval: options?.refetchInterval ?? false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

/**
 * Hook to search drivers with autocomplete
 */
export function useDriverSearch(
  searchTerm: string,
  fleet?: string,
  options?: {
    enabled?: boolean;
    debounceMs?: number;
  }
) {
  return useQuery({
    queryKey: driverProfileKeys.search(searchTerm, fleet),
    queryFn: () => DriverProfileService.searchDrivers(searchTerm, fleet, 10),
    enabled: (options?.enabled ?? true) && searchTerm.length >= 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });
}

/**
 * Hook to get all driver summaries with performance metrics
 */
export function useDriverSummaries(
  fleet?: string,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
    limit?: number;
  }
) {
  return useQuery({
    queryKey: [...driverProfileKeys.all, 'summaries', fleet, options?.limit],
    queryFn: () => DriverProfileService.getDriverSummaries(fleet, options?.limit),
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: options?.refetchInterval ?? 5 * 60 * 1000, // Refresh every 5 minutes
    retry: 2,
  });
}

/**
 * Hook for prefetching driver profile data
 */
export function usePrefetchDriverProfile() {
  const queryClient = useQueryClient();

  const prefetchDriverProfile = async (
    driverId: string, 
    timeframe: '30d' | '90d' | '1y' = '30d'
  ) => {
    await queryClient.prefetchQuery({
      queryKey: driverProfileKeys.profile(driverId, timeframe),
      queryFn: () => DriverProfileService.getDriverProfile(driverId, timeframe),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  return { prefetchDriverProfile };
}

/**
 * Utility hook for invalidating driver profile cache
 */
export function useInvalidateDriverProfile() {
  const queryClient = useQueryClient();

  const invalidateDriverProfile = (driverId?: string) => {
    if (driverId) {
      // Invalidate specific driver's data
      queryClient.invalidateQueries({
        queryKey: [...driverProfileKeys.all, 'profile', driverId],
      });
    } else {
      // Invalidate all driver profile data
      queryClient.invalidateQueries({
        queryKey: driverProfileKeys.all,
      });
    }
  };

  const invalidateDriverSearch = () => {
    queryClient.invalidateQueries({
      queryKey: [...driverProfileKeys.all, 'search'],
    });
  };

  const invalidateDriverSummaries = (fleet?: string) => {
    queryClient.invalidateQueries({
      queryKey: [...driverProfileKeys.all, 'summaries', fleet],
    });
  };

  return {
    invalidateDriverProfile,
    invalidateDriverSearch,
    invalidateDriverSummaries,
  };
}

/**
 * Combined hook for driver management dashboard
 */
export function useDriverManagementData(fleet?: string) {
  const driverSummaries = useDriverSummaries(fleet, {
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

  return {
    drivers: driverSummaries.data || [],
    isLoading: driverSummaries.isLoading,
    error: driverSummaries.error,
    refetch: driverSummaries.refetch,
  };
}

/**
 * Hook for optimized driver profile with background refresh
 */
export function useOptimizedDriverProfile(
  driverId: string,
  timeframe: '30d' | '90d' | '1y' = '30d'
) {
  const profile = useDriverProfile(driverId, timeframe, {
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 15 * 60 * 1000, // Background refresh every 15 minutes
  });

  // Prefetch related timeframes for smooth navigation
  const { prefetchDriverProfile } = usePrefetchDriverProfile();

  // Prefetch other timeframes when data loads
  React.useEffect(() => {
    if (profile.data && driverId) {
      const timeframes: Array<'30d' | '90d' | '1y'> = ['30d', '90d', '1y'];
      timeframes.forEach(tf => {
        if (tf !== timeframe) {
          prefetchDriverProfile(driverId, tf).catch(console.error);
        }
      });
    }
  }, [profile.data, driverId, timeframe, prefetchDriverProfile]);

  return profile;
}

/**
 * Hook for real-time driver alerts and notifications
 * Uses actual driver data to identify drivers requiring attention
 */
export function useDriverAlerts(fleet?: string) {
  const driverSummaries = useDriverSummaries(fleet, {
    refetchInterval: 2 * 60 * 1000, // Check every 2 minutes for alerts
  });

  const alerts = React.useMemo(() => {
    if (!driverSummaries.data) return [];

    return driverSummaries.data
      .filter(driver => {
        // Define conditions that require attention based on actual metrics
        const hasHighLytxEvents = (driver.lytxEvents?.total || 0) > 5;
        const hasHighGuardianEvents = (driver.guardianEvents?.total || 0) > 3;
        const hasExcessiveHours = (driver.totalHours || 0) > 60; // Weekly limit
        const hasLowSafetyScore = (driver.safetyScore || 100) < 70;
        
        return hasHighLytxEvents || hasHighGuardianEvents || hasExcessiveHours || hasLowSafetyScore;
      })
      .map(driver => {
        // Determine severity based on multiple factors
        const lytxCount = driver.lytxEvents?.total || 0;
        const guardianCount = driver.guardianEvents?.total || 0;
        const safetyScore = driver.safetyScore || 100;
        
        let severity: 'critical' | 'high' | 'medium' = 'medium';
        let message = '';
        
        if (lytxCount > 10 || guardianCount > 5 || safetyScore < 50) {
          severity = 'critical';
          message = `${driver.name} requires immediate attention: ${lytxCount} LYTX events, ${guardianCount} Guardian events`;
        } else if (lytxCount > 5 || guardianCount > 3 || safetyScore < 70) {
          severity = 'high';
          message = `${driver.name} has elevated risk: ${lytxCount} LYTX events, ${guardianCount} Guardian events`;
        } else {
          message = `${driver.name} needs monitoring: Performance outside normal ranges`;
        }

        return {
          id: driver.id,
          driverName: driver.name,
          severity,
          message,
          fleet: driver.fleet || fleet || 'Unknown',
          depot: driver.depot || 'Unknown',
          timestamp: new Date().toISOString(),
          metrics: {
            lytxEvents: lytxCount,
            guardianEvents: guardianCount,
            safetyScore,
            totalKm: driver.totalKm,
            totalHours: driver.totalHours,
          }
        };
      });
  }, [driverSummaries.data, fleet]);

  return {
    alerts,
    alertCount: alerts.length,
    criticalCount: alerts.filter(a => a.severity === 'critical').length,
    isLoading: driverSummaries.isLoading,
    error: driverSummaries.error,
  };
}

export default {
  useDriverProfile,
  useDriverSearch,
  useDriverSummaries,
  usePrefetchDriverProfile,
  useInvalidateDriverProfile,
  useDriverManagementData,
  useOptimizedDriverProfile,
  useDriverAlerts,
};