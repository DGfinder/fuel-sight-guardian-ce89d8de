/**
 * React Query hooks for activity logging
 */

import { useQuery } from '@tanstack/react-query';
import {
  getActivityLogs,
  getActivitySummary,
  type ActivityLogEntry,
  type ActivityLogFilters,
  type ActivitySummary
} from '@/lib/activityLogger';

/**
 * Hook to fetch activity logs with filters
 */
export function useActivityLogs(filters: ActivityLogFilters = {}) {
  return useQuery<ActivityLogEntry[]>({
    queryKey: ['activity-logs', filters],
    queryFn: () => getActivityLogs(filters),
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });
}

/**
 * Hook to fetch recent activity (last 24 hours by default)
 */
export function useRecentActivity(hours: number = 24, limit: number = 50) {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() - hours);

  return useActivityLogs({
    start_date: startDate,
    limit
  });
}

/**
 * Hook to fetch activity for a specific user
 */
export function useUserActivity(userId: string, limit: number = 50) {
  return useActivityLogs({
    user_id: userId,
    limit
  });
}

/**
 * Hook to fetch activity for a specific category
 */
export function useCategoryActivity(
  category: 'auth' | 'customer' | 'tank' | 'delivery' | 'settings',
  limit: number = 50
) {
  return useActivityLogs({
    category,
    limit
  });
}

/**
 * Hook to fetch activity summary statistics
 */
export function useActivitySummary(hours: number = 24) {
  return useQuery<ActivitySummary[]>({
    queryKey: ['activity-summary', hours],
    queryFn: () => getActivitySummary(hours),
    staleTime: 1000 * 60, // 1 minute
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });
}

/**
 * Hook to fetch auth-related activity
 */
export function useAuthActivity(limit: number = 20) {
  return useCategoryActivity('auth', limit);
}

/**
 * Hook to fetch delivery-related activity
 */
export function useDeliveryActivity(limit: number = 20) {
  return useCategoryActivity('delivery', limit);
}

/**
 * Hook to fetch customer account activity
 */
export function useCustomerAccountActivity(limit: number = 20) {
  return useCategoryActivity('customer', limit);
}
