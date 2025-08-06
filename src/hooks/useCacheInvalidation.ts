/**
 * CACHE INVALIDATION HOOK
 * 
 * React hook for managing cache invalidation across the application
 * when data changes occur in different systems
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  advancedCacheManager, 
  CACHE_DEPENDENCIES 
} from '@/lib/advanced-cache';

export interface CacheInvalidationOptions {
  showToast?: boolean;
  invalidateQueries?: boolean;
  patterns?: string[];
}

/**
 * Hook for managing cache invalidation
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  /**
   * Invalidate cache when SmartFill data changes
   */
  const invalidateSmartFillData = useCallback(async (
    customerId?: string,
    options: CacheInvalidationOptions = {}
  ) => {
    const { showToast = false, invalidateQueries = true } = options;
    
    try {
      // Invalidate advanced cache patterns
      await advancedCacheManager.invalidateDataUpdate('SMARTFILL_UPDATE');
      
      // Optionally invalidate React Query cache
      if (invalidateQueries) {
        await queryClient.invalidateQueries({ 
          queryKey: ['analytics'] 
        });
        await queryClient.invalidateQueries({ 
          queryKey: ['unified'] 
        });
        await queryClient.invalidateQueries({ 
          queryKey: ['smartfill'] 
        });
      }

      if (showToast) {
        toast({
          title: 'SmartFill cache invalidated',
          description: 'Fresh data will be loaded on next request'
        });
      }
    } catch (error) {
      console.warn('[CACHE_INVALIDATION] SmartFill invalidation failed:', error);
      if (showToast) {
        toast({
          title: 'Cache invalidation warning',
          description: 'Some cached data may be stale',
          variant: 'destructive'
        });
      }
    }
  }, [queryClient, toast]);

  /**
   * Invalidate cache when AgBot data changes
   */
  const invalidateAgBotData = useCallback(async (
    locationId?: string,
    options: CacheInvalidationOptions = {}
  ) => {
    const { showToast = false, invalidateQueries = true } = options;
    
    try {
      // Invalidate advanced cache patterns
      await advancedCacheManager.invalidateDataUpdate('AGBOT_UPDATE');
      
      if (invalidateQueries) {
        await queryClient.invalidateQueries({ 
          queryKey: ['analytics'] 
        });
        await queryClient.invalidateQueries({ 
          queryKey: ['unified'] 
        });
        await queryClient.invalidateQueries({ 
          queryKey: ['agbot'] 
        });
      }

      if (showToast) {
        toast({
          title: 'AgBot cache invalidated',
          description: 'Fresh fuel monitoring data will be loaded'
        });
      }
    } catch (error) {
      console.warn('[CACHE_INVALIDATION] AgBot invalidation failed:', error);
      if (showToast) {
        toast({
          title: 'Cache invalidation warning',
          description: 'Some cached data may be stale',
          variant: 'destructive'
        });
      }
    }
  }, [queryClient, toast]);

  /**
   * Invalidate cache when Captive Payments data changes
   */
  const invalidateCaptivePaymentsData = useCallback(async (
    deliveryDate?: string,
    options: CacheInvalidationOptions = {}
  ) => {
    const { showToast = false, invalidateQueries = true } = options;
    
    try {
      // Invalidate advanced cache patterns
      await advancedCacheManager.invalidateDataUpdate('CAPTIVE_PAYMENTS_UPDATE');
      
      if (invalidateQueries) {
        await queryClient.invalidateQueries({ 
          queryKey: ['analytics'] 
        });
        await queryClient.invalidateQueries({ 
          queryKey: ['unified'] 
        });
        await queryClient.invalidateQueries({ 
          queryKey: ['captive-payments'] 
        });
      }

      if (showToast) {
        toast({
          title: 'Captive Payments cache invalidated',
          description: 'Fresh delivery data will be loaded'
        });
      }
    } catch (error) {
      console.warn('[CACHE_INVALIDATION] Captive Payments invalidation failed:', error);
      if (showToast) {
        toast({
          title: 'Cache invalidation warning',
          description: 'Some delivery data may be stale',
          variant: 'destructive'
        });
      }
    }
  }, [queryClient, toast]);

  /**
   * Invalidate cache when system configuration changes
   */
  const invalidateConfigurationData = useCallback(async (
    options: CacheInvalidationOptions = {}
  ) => {
    const { showToast = false, invalidateQueries = true } = options;
    
    try {
      // Invalidate advanced cache patterns
      await advancedCacheManager.invalidateDataUpdate('CONFIG_UPDATE');
      
      if (invalidateQueries) {
        await queryClient.invalidateQueries();
      }

      if (showToast) {
        toast({
          title: 'Configuration cache invalidated',
          description: 'All cached data cleared due to configuration changes'
        });
      }
    } catch (error) {
      console.warn('[CACHE_INVALIDATION] Configuration invalidation failed:', error);
      if (showToast) {
        toast({
          title: 'Cache invalidation warning',
          description: 'Configuration changes may not be reflected',
          variant: 'destructive'
        });
      }
    }
  }, [queryClient, toast]);

  /**
   * Invalidate specific cache patterns
   */
  const invalidatePatterns = useCallback(async (
    patterns: string[],
    options: CacheInvalidationOptions = {}
  ) => {
    const { showToast = false } = options;
    
    try {
      await Promise.all(
        patterns.map(pattern => advancedCacheManager.invalidatePattern(pattern))
      );

      if (showToast) {
        toast({
          title: 'Cache patterns invalidated',
          description: `${patterns.length} cache patterns cleared`
        });
      }
    } catch (error) {
      console.warn('[CACHE_INVALIDATION] Pattern invalidation failed:', error);
      if (showToast) {
        toast({
          title: 'Cache invalidation warning',
          description: 'Some cache patterns could not be cleared',
          variant: 'destructive'
        });
      }
    }
  }, [toast]);

  /**
   * Clear all caches (nuclear option)
   */
  const clearAllCaches = useCallback(async (
    options: CacheInvalidationOptions = {}
  ) => {
    const { showToast = false, invalidateQueries = true } = options;
    
    try {
      // Clear all advanced cache patterns
      await Promise.all([
        advancedCacheManager.invalidatePattern('dashboard:*'),
        advancedCacheManager.invalidatePattern('query:*'),
        advancedCacheManager.invalidatePattern('unified:*')
      ]);
      
      // Clear React Query cache
      if (invalidateQueries) {
        queryClient.clear();
      }

      if (showToast) {
        toast({
          title: 'All caches cleared',
          description: 'Fresh data will be loaded for all requests'
        });
      }
    } catch (error) {
      console.warn('[CACHE_INVALIDATION] Clear all failed:', error);
      if (showToast) {
        toast({
          title: 'Cache clearing failed',
          description: 'Some cached data could not be cleared',
          variant: 'destructive'
        });
      }
    }
  }, [queryClient, toast]);

  /**
   * Invalidate dashboard-specific caches
   */
  const invalidateDashboardData = useCallback(async (
    userId?: string,
    options: CacheInvalidationOptions = {}
  ) => {
    const { showToast = false, invalidateQueries = true } = options;
    
    try {
      const patterns = userId 
        ? [`dashboard:*:${userId}*`, 'dashboard:*']
        : ['dashboard:*'];
      
      await invalidatePatterns(patterns, { showToast: false });
      
      if (invalidateQueries) {
        await queryClient.invalidateQueries({ 
          queryKey: ['analytics'] 
        });
      }

      if (showToast) {
        toast({
          title: 'Dashboard cache invalidated',
          description: 'Dashboard will reload with fresh data'
        });
      }
    } catch (error) {
      console.warn('[CACHE_INVALIDATION] Dashboard invalidation failed:', error);
    }
  }, [invalidatePatterns, queryClient, toast]);

  /**
   * Invalidate location-specific caches
   */
  const invalidateLocationData = useCallback(async (
    locationId: string,
    systems: string[] = [],
    options: CacheInvalidationOptions = {}
  ) => {
    const { showToast = false, invalidateQueries = true } = options;
    
    try {
      const patterns = [
        `unified:location:${locationId}*`,
        'dashboard:locations*',
        'query:complex*'
      ];
      
      await invalidatePatterns(patterns, { showToast: false });
      
      if (invalidateQueries) {
        await queryClient.invalidateQueries({ 
          queryKey: ['unified', 'location', locationId] 
        });
      }

      if (showToast) {
        toast({
          title: 'Location cache invalidated',
          description: `Fresh data will be loaded for location ${locationId}`
        });
      }
    } catch (error) {
      console.warn('[CACHE_INVALIDATION] Location invalidation failed:', error);
    }
  }, [invalidatePatterns, queryClient, toast]);

  return {
    // System-specific invalidation
    invalidateSmartFillData,
    invalidateAgBotData,
    invalidateCaptivePaymentsData,
    invalidateConfigurationData,
    
    // Feature-specific invalidation
    invalidateDashboardData,
    invalidateLocationData,
    
    // General invalidation utilities
    invalidatePatterns,
    clearAllCaches,
    
    // Utility to invalidate all data for a specific date
    invalidateDataForDate: useCallback(async (date: string, options: CacheInvalidationOptions = {}) => {
      const patterns = [
        `*:${date}*`,
        'dashboard:*',
        'query:*'
      ];
      await invalidatePatterns(patterns, options);
    }, [invalidatePatterns]),
    
    // Utility to invalidate based on time range
    invalidateTimeRangeData: useCallback(async (startDate: string, endDate: string, options: CacheInvalidationOptions = {}) => {
      const timeRange = `${startDate}_${endDate}`;
      const patterns = [
        `*:${timeRange}*`,
        'dashboard:*chart*',
        'query:analytics*'
      ];
      await invalidatePatterns(patterns, options);
    }, [invalidatePatterns])
  };
}

/**
 * Hook for automatic cache invalidation based on data mutations
 */
export function useAutomaticCacheInvalidation() {
  const cacheInvalidation = useCacheInvalidation();

  /**
   * Register a data mutation callback that automatically invalidates relevant caches
   */
  const registerMutationCallback = useCallback((
    mutationType: 'smartfill' | 'agbot' | 'captive_payments' | 'config',
    callback: (data: any) => void
  ) => {
    return (data: any) => {
      // Execute the original callback
      callback(data);
      
      // Automatically invalidate relevant caches
      switch (mutationType) {
        case 'smartfill':
          cacheInvalidation.invalidateSmartFillData();
          break;
        case 'agbot':
          cacheInvalidation.invalidateAgBotData();
          break;
        case 'captive_payments':
          cacheInvalidation.invalidateCaptivePaymentsData();
          break;
        case 'config':
          cacheInvalidation.invalidateConfigurationData();
          break;
      }
    };
  }, [cacheInvalidation]);

  return {
    registerMutationCallback,
    ...cacheInvalidation
  };
}

/**
 * Utility hook for cache health monitoring
 */
export function useCacheHealthMonitoring() {
  const { toast } = useToast();

  const checkCacheHealth = useCallback(async () => {
    try {
      // This would integrate with your cache monitoring
      const health = await advancedCacheManager.get('cache:health:check', 30);
      return health;
    } catch (error) {
      console.warn('[CACHE_HEALTH] Health check failed:', error);
      return { healthy: false, error: error.message };
    }
  }, []);

  const notifyHealthIssue = useCallback((issue: string) => {
    toast({
      title: 'Cache health issue',
      description: issue,
      variant: 'destructive'
    });
  }, [toast]);

  return {
    checkCacheHealth,
    notifyHealthIssue
  };
}