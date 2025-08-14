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
  attention: (fleet?: string) => [...driverProfileKeys.all, 'attention', fleet] as const,
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
 * Hook to get drivers requiring attention (high risk, unresolved events)
 */
export function useDriversRequiringAttention(
  fleet?: string,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  }
) {
  return useQuery({
    queryKey: driverProfileKeys.attention(fleet),
    queryFn: () => DriverProfileService.getDriversRequiringAttention(fleet),
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

  const invalidateDriversAttention = (fleet?: string) => {
    queryClient.invalidateQueries({
      queryKey: driverProfileKeys.attention(fleet),
    });
  };

  return {
    invalidateDriverProfile,
    invalidateDriverSearch,
    invalidateDriversAttention,
  };
}

/**
 * Combined hook for driver management dashboard
 */
export function useDriverManagementData(fleet?: string) {
  const driversAttention = useDriversRequiringAttention(fleet, {
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

  return {
    driversRequiringAttention: driversAttention.data || [],
    isLoadingAttention: driversAttention.isLoading,
    errorAttention: driversAttention.error,
    refetchAttention: driversAttention.refetch,
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
 */
export function useDriverAlerts(fleet?: string) {
  const driversAttention = useDriversRequiringAttention(fleet, {
    refetchInterval: 2 * 60 * 1000, // Check every 2 minutes for alerts
  });

  const alerts = React.useMemo(() => {
    if (!driversAttention.data) return [];

    return driversAttention.data
      .filter(driver => 
        driver.high_risk_events_30d > 3 || 
        driver.guardian_risk_level === 'Critical' ||
        driver.overall_safety_score < 50
      )
      .map(driver => ({
        id: driver.id,
        driverName: driver.full_name,
        severity: driver.guardian_risk_level === 'Critical' ? 'critical' as const :
                 driver.high_risk_events_30d > 5 ? 'high' as const : 'medium' as const,
        message: `${driver.full_name} has ${driver.high_risk_events_30d} high-risk events`,
        fleet: driver.fleet,
        depot: driver.depot,
        timestamp: new Date().toISOString(),
      }));
  }, [driversAttention.data]);

  return {
    alerts,
    alertCount: alerts.length,
    criticalCount: alerts.filter(a => a.severity === 'critical').length,
    isLoading: driversAttention.isLoading,
    error: driversAttention.error,
  };
}

export default {
  useDriverProfile,
  useDriverSearch,
  useDriversRequiringAttention,
  usePrefetchDriverProfile,
  useInvalidateDriverProfile,
  useDriverManagementData,
  useOptimizedDriverProfile,
  useDriverAlerts,
};