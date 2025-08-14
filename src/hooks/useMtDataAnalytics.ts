/**
 * MtData Analytics React Query Hooks
 * Custom hooks for fetching MtData analytics with caching and error handling
 */

import { useQuery } from '@tanstack/react-query';
import {
  getMtDataOverview,
  getDailyTripMetrics,
  getVehicleUtilization,
  getDriverPerformance,
  getRouteAnalysis,
  getDepotMetrics,
  type MtDataOverview,
  type DailyTripMetrics,
  type VehicleUtilization,
  type DriverPerformance,
  type RouteAnalysis,
  type DepotMetrics
} from '@/services/mtDataAnalyticsService';

export interface MtDataAnalyticsFilters {
  fleet?: 'Stevemacs' | 'GSF';
  dateRange?: number; // days
}

/**
 * Hook for fetching MtData overview analytics
 */
export function useMtDataOverview(filters?: MtDataAnalyticsFilters) {
  return useQuery<MtDataOverview, Error>({
    queryKey: ['mtdata-overview', filters?.fleet],
    queryFn: () => getMtDataOverview(filters?.fleet),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook for fetching daily trip trends
 */
export function useMtDataTrends(filters?: MtDataAnalyticsFilters) {
  const days = filters?.dateRange || 30;
  
  return useQuery<DailyTripMetrics[], Error>({
    queryKey: ['mtdata-trends', filters?.fleet, days],
    queryFn: () => getDailyTripMetrics(filters?.fleet, days),
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook for fetching vehicle utilization data
 */
export function useMtDataVehicleUtilization(filters?: MtDataAnalyticsFilters) {
  return useQuery<VehicleUtilization[], Error>({
    queryKey: ['mtdata-vehicle-utilization', filters?.fleet],
    queryFn: () => getVehicleUtilization(filters?.fleet),
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook for fetching driver performance analytics
 */
export function useMtDataDriverPerformance(filters?: MtDataAnalyticsFilters) {
  return useQuery<DriverPerformance[], Error>({
    queryKey: ['mtdata-driver-performance', filters?.fleet],
    queryFn: () => getDriverPerformance(filters?.fleet),
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook for fetching route analysis data
 */
export function useMtDataRouteAnalysis(filters?: MtDataAnalyticsFilters) {
  return useQuery<RouteAnalysis[], Error>({
    queryKey: ['mtdata-route-analysis', filters?.fleet],
    queryFn: () => getRouteAnalysis(filters?.fleet),
    staleTime: 30 * 60 * 1000, // 30 minutes (route data changes less frequently)
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Hook for fetching depot-level metrics (GSF specific)
 */
export function useMtDataDepotMetrics() {
  return useQuery<DepotMetrics[], Error>({
    queryKey: ['mtdata-depot-metrics'],
    queryFn: () => getDepotMetrics(),
    staleTime: 20 * 60 * 1000, // 20 minutes
    retry: 2,
    retryDelay: 1000,
  });
}

/**
 * Combined hook for fetching all MtData analytics
 * Useful for dashboard pages that need multiple data sources
 */
export function useMtDataDashboard(filters?: MtDataAnalyticsFilters) {
  const overview = useMtDataOverview(filters);
  const trends = useMtDataTrends(filters);
  const vehicleUtilization = useMtDataVehicleUtilization(filters);
  const driverPerformance = useMtDataDriverPerformance(filters);
  const routeAnalysis = useMtDataRouteAnalysis(filters);
  
  // Only fetch depot metrics if no fleet filter or GSF fleet
  const depotMetrics = useMtDataDepotMetrics();

  return {
    overview,
    trends,
    vehicleUtilization,
    driverPerformance,
    routeAnalysis,
    depotMetrics: filters?.fleet === 'Stevemacs' ? null : depotMetrics,
    isLoading: overview.isLoading || trends.isLoading || vehicleUtilization.isLoading,
    isError: overview.isError || trends.isError || vehicleUtilization.isError,
    error: overview.error || trends.error || vehicleUtilization.error
  };
}

/**
 * Hook for real-time analytics updates
 * Polls data more frequently for live dashboards
 */
export function useMtDataRealtime(filters?: MtDataAnalyticsFilters, enabled: boolean = false) {
  return useQuery<MtDataOverview, Error>({
    queryKey: ['mtdata-realtime', filters?.fleet],
    queryFn: () => getMtDataOverview(filters?.fleet),
    enabled,
    refetchInterval: enabled ? 30 * 1000 : false, // 30 seconds when enabled
    staleTime: 0, // Always consider stale for real-time updates
    retry: 1,
    retryDelay: 2000,
  });
}

/**
 * Export all types for easy importing
 */
export type {
  MtDataOverview,
  DailyTripMetrics,
  VehicleUtilization,
  DriverPerformance,
  RouteAnalysis,
  DepotMetrics,
  MtDataAnalyticsFilters
};