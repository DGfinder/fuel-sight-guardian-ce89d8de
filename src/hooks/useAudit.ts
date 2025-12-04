/**
 * React hooks for audit logging functionality
 */

import { useQuery } from '@tanstack/react-query';
import { AuditService, type AuditTrailEntry, type AuditActivity, type AuditSummary } from '@/lib/audit';

/**
 * Hook to get audit trail for a specific record
 */
export function useAuditTrail(tableName: string, recordId: string, limit = 50) {
  return useQuery({
    queryKey: ['auditTrail', tableName, recordId, limit],
    queryFn: async () => {
      const { data, error } = await AuditService.getAuditTrail(tableName, recordId, limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tableName && !!recordId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

/**
 * Hook to get recent audit activity
 */
export function useRecentAuditActivity(hours = 24, limit = 100) {
  return useQuery({
    queryKey: ['recentAuditActivity', hours, limit],
    queryFn: async () => {
      const { data, error } = await AuditService.getRecentActivity(hours, limit);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1 * 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    retry: 2,
  });
}

/**
 * Hook to get audit summary
 */
export function useAuditSummary(limit = 100) {
  return useQuery({
    queryKey: ['auditSummary', limit],
    queryFn: async () => {
      const { data, error } = await AuditService.getAuditSummary(limit);
      if (error) throw error;
      return data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
    retry: 2,
  });
}

/**
 * Hook to get audit logs for a specific table
 */
export function useTableAuditLogs(tableName: string, limit = 50) {
  return useQuery({
    queryKey: ['tableAuditLogs', tableName, limit],
    queryFn: async () => {
      const { data, error } = await AuditService.getTableAuditLogs(tableName, limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tableName,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

/**
 * Hook to get audit logs for a specific user
 */
export function useUserAuditLogs(userId: string, limit = 50) {
  return useQuery({
    queryKey: ['userAuditLogs', userId, limit],
    queryFn: async () => {
      const { data, error } = await AuditService.getUserAuditLogs(userId, limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}