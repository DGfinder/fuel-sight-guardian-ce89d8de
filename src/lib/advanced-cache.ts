/**
 * ADVANCED CACHING STRATEGIES
 * 
 * Sophisticated caching layer for dashboard queries, analytics,
 * and cross-system data aggregation with intelligent invalidation
 */

import { 
  cacheGet, 
  cacheSet, 
  cacheDel, 
  cacheHealthCheck,
  CACHE_CONFIG,
  CACHE_KEYS 
} from '@/lib/vercel-kv';
import { getConfig, CONFIG_KEYS } from '@/lib/vercel-edge-config';

// Advanced cache configuration
export const ADVANCED_CACHE_CONFIG = {
  // Dashboard data caching
  DASHBOARD_SUMMARY: 60,        // 1 minute
  DASHBOARD_CHARTS: 300,        // 5 minutes
  DASHBOARD_TABLES: 180,        // 3 minutes
  
  // Query result caching
  COMPLEX_QUERIES: 600,         // 10 minutes
  AGGREGATION_QUERIES: 1800,    // 30 minutes
  ANALYTICS_QUERIES: 3600,      // 1 hour
  
  // Cross-system data
  UNIFIED_DATA: 900,            // 15 minutes
  CORRELATION_DATA: 1200,       // 20 minutes
  
  // Performance metrics
  PERFORMANCE_CACHE: 300,       // 5 minutes
  HEALTH_METRICS: 60,          // 1 minute
} as const;

// Cache key generators with intelligent namespacing
export const ADVANCED_CACHE_KEYS = {
  // Dashboard caching
  DASHBOARD: {
    SUMMARY: (userId?: string) => `dashboard:summary${userId ? `:${userId}` : ''}`,
    FUEL_CHART: (timeRange: string, systems: string[]) => 
      `dashboard:fuel_chart:${timeRange}:${systems.sort().join(',')}`,
    DELIVERY_CHART: (timeRange: string, filters: Record<string, any>) => 
      `dashboard:delivery_chart:${timeRange}:${JSON.stringify(filters)}`,
    LOCATION_TABLE: (page: number, filters: Record<string, any>) => 
      `dashboard:locations:${page}:${JSON.stringify(filters)}`,
    PERFORMANCE_METRICS: (system: string, timeRange: string) => 
      `dashboard:performance:${system}:${timeRange}`
  },
  
  // Query result caching
  QUERIES: {
    COMPLEX_AGGREGATION: (queryHash: string, params: Record<string, any>) =>
      `query:complex:${queryHash}:${JSON.stringify(params)}`,
    CROSS_SYSTEM: (systems: string[], dateRange: string, filters: any) =>
      `query:cross_system:${systems.sort().join(',')}:${dateRange}:${JSON.stringify(filters)}`,
    ANALYTICS_DRILL_DOWN: (dimension: string, metrics: string[], filters: any) =>
      `query:analytics:${dimension}:${metrics.sort().join(',')}:${JSON.stringify(filters)}`
  },
  
  // Unified data caching
  UNIFIED: {
    LOCATION_DATA: (locationId: string, includeSystems: string[]) =>
      `unified:location:${locationId}:${includeSystems.sort().join(',')}`,
    CUSTOMER_DATA: (customerId: string, timeRange: string) =>
      `unified:customer:${customerId}:${timeRange}`,
    SYSTEM_STATUS: (systems: string[]) =>
      `unified:status:${systems.sort().join(',')}`
  }
} as const;

/**
 * Cache invalidation patterns and dependencies
 */
export const CACHE_DEPENDENCIES = {
  // When SmartFill data changes, invalidate these patterns
  SMARTFILL_UPDATE: [
    'dashboard:summary*',
    'dashboard:fuel_chart*',
    'dashboard:locations*',
    'query:complex*',
    'query:cross_system*',
    'unified:location*',
    'unified:status*'
  ],
  
  // When AgBot data changes
  AGBOT_UPDATE: [
    'dashboard:summary*',
    'dashboard:fuel_chart*',
    'dashboard:locations*',
    'query:complex*',
    'query:cross_system*',
    'unified:location*',
    'unified:status*'
  ],
  
  // When Captive Payments data changes
  CAPTIVE_PAYMENTS_UPDATE: [
    'dashboard:summary*',
    'dashboard:delivery_chart*',
    'query:complex*',
    'query:cross_system*',
    'unified:customer*'
  ],
  
  // When system configuration changes
  CONFIG_UPDATE: [
    'dashboard:*',
    'query:*',
    'unified:*'
  ]
} as const;

/**
 * Advanced cache manager with intelligent invalidation
 */
export class AdvancedCacheManager {
  private static instance: AdvancedCacheManager;
  
  public static getInstance(): AdvancedCacheManager {
    if (!AdvancedCacheManager.instance) {
      AdvancedCacheManager.instance = new AdvancedCacheManager();
    }
    return AdvancedCacheManager.instance;
  }

  /**
   * Get cached data with automatic freshness validation
   */
  async get<T>(
    cacheKey: string, 
    maxAge?: number,
    validator?: (data: T) => boolean
  ): Promise<T | null> {
    try {
      const cached = await cacheGet<{
        data: T;
        timestamp: number;
        version: string;
      }>(cacheKey);
      
      if (!cached) return null;

      // Check if data is too old
      if (maxAge && (Date.now() - cached.timestamp) > (maxAge * 1000)) {
        await cacheDel(cacheKey);
        return null;
      }

      // Run custom validator if provided
      if (validator && !validator(cached.data)) {
        await cacheDel(cacheKey);
        return null;
      }

      return cached.data;
    } catch (error) {
      console.warn('[ADVANCED_CACHE] Get failed:', error);
      return null;
    }
  }

  /**
   * Set cached data with metadata
   */
  async set<T>(
    cacheKey: string,
    data: T,
    ttl: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const cachedData = {
        data,
        timestamp: Date.now(),
        version: '1.0',
        metadata: metadata || {}
      };
      
      await cacheSet(cacheKey, cachedData, ttl);
    } catch (error) {
      console.warn('[ADVANCED_CACHE] Set failed:', error);
    }
  }

  /**
   * Invalidate cache by pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      // Use wildcard deletion for pattern matching
      await cacheDel(pattern);
      console.log(`[ADVANCED_CACHE] Invalidated pattern: ${pattern}`);
    } catch (error) {
      console.warn(`[ADVANCED_CACHE] Invalidation failed for pattern ${pattern}:`, error);
    }
  }

  /**
   * Batch invalidation for data dependencies
   */
  async invalidateDataUpdate(updateType: keyof typeof CACHE_DEPENDENCIES): Promise<void> {
    const patterns = CACHE_DEPENDENCIES[updateType];
    
    try {
      await Promise.all(
        patterns.map(pattern => this.invalidatePattern(pattern))
      );
      console.log(`[ADVANCED_CACHE] Invalidated ${patterns.length} patterns for ${updateType}`);
    } catch (error) {
      console.warn(`[ADVANCED_CACHE] Batch invalidation failed for ${updateType}:`, error);
    }
  }

  /**
   * Get multiple cache entries with parallel fetching
   */
  async getMultiple<T>(keys: string[]): Promise<Record<string, T | null>> {
    const results: Record<string, T | null> = {};
    
    try {
      const promises = keys.map(async (key) => ({
        key,
        value: await this.get<T>(key)
      }));
      
      const resolved = await Promise.all(promises);
      
      for (const { key, value } of resolved) {
        results[key] = value;
      }
    } catch (error) {
      console.warn('[ADVANCED_CACHE] Multiple get failed:', error);
      // Return empty results for all keys on error
      keys.forEach(key => results[key] = null);
    }
    
    return results;
  }

  /**
   * Warming up cache with frequently accessed data
   */
  async warmupCache(warmupFunctions: Array<() => Promise<void>>): Promise<void> {
    try {
      console.log('[ADVANCED_CACHE] Starting cache warmup...');
      await Promise.allSettled(warmupFunctions.map(fn => fn()));
      console.log('[ADVANCED_CACHE] Cache warmup completed');
    } catch (error) {
      console.warn('[ADVANCED_CACHE] Cache warmup failed:', error);
    }
  }
}

/**
 * Dashboard-specific caching utilities
 */
export class DashboardCache {
  private cacheManager = AdvancedCacheManager.getInstance();

  async getDashboardSummary(userId?: string): Promise<any | null> {
    const cacheKey = ADVANCED_CACHE_KEYS.DASHBOARD.SUMMARY(userId);
    return await this.cacheManager.get(cacheKey, ADVANCED_CACHE_CONFIG.DASHBOARD_SUMMARY);
  }

  async setDashboardSummary(data: any, userId?: string): Promise<void> {
    const cacheKey = ADVANCED_CACHE_KEYS.DASHBOARD.SUMMARY(userId);
    await this.cacheManager.set(
      cacheKey, 
      data, 
      ADVANCED_CACHE_CONFIG.DASHBOARD_SUMMARY,
      { type: 'dashboard_summary', userId }
    );
  }

  async getFuelChart(timeRange: string, systems: string[]): Promise<any | null> {
    const cacheKey = ADVANCED_CACHE_KEYS.DASHBOARD.FUEL_CHART(timeRange, systems);
    return await this.cacheManager.get(cacheKey, ADVANCED_CACHE_CONFIG.DASHBOARD_CHARTS);
  }

  async setFuelChart(data: any, timeRange: string, systems: string[]): Promise<void> {
    const cacheKey = ADVANCED_CACHE_KEYS.DASHBOARD.FUEL_CHART(timeRange, systems);
    await this.cacheManager.set(
      cacheKey, 
      data, 
      ADVANCED_CACHE_CONFIG.DASHBOARD_CHARTS,
      { type: 'fuel_chart', timeRange, systems }
    );
  }

  async getLocationTable(page: number, filters: Record<string, any>): Promise<any | null> {
    const cacheKey = ADVANCED_CACHE_KEYS.DASHBOARD.LOCATION_TABLE(page, filters);
    return await this.cacheManager.get(cacheKey, ADVANCED_CACHE_CONFIG.DASHBOARD_TABLES);
  }

  async setLocationTable(data: any, page: number, filters: Record<string, any>): Promise<void> {
    const cacheKey = ADVANCED_CACHE_KEYS.DASHBOARD.LOCATION_TABLE(page, filters);
    await this.cacheManager.set(
      cacheKey, 
      data, 
      ADVANCED_CACHE_CONFIG.DASHBOARD_TABLES,
      { type: 'location_table', page, filters }
    );
  }
}

/**
 * Query result caching with parameter-based keys
 */
export class QueryCache {
  private cacheManager = AdvancedCacheManager.getInstance();

  async getComplexQuery(
    queryHash: string, 
    params: Record<string, any>
  ): Promise<any | null> {
    const cacheKey = ADVANCED_CACHE_KEYS.QUERIES.COMPLEX_AGGREGATION(queryHash, params);
    return await this.cacheManager.get(cacheKey, ADVANCED_CACHE_CONFIG.COMPLEX_QUERIES);
  }

  async setComplexQuery(
    data: any, 
    queryHash: string, 
    params: Record<string, any>
  ): Promise<void> {
    const cacheKey = ADVANCED_CACHE_KEYS.QUERIES.COMPLEX_AGGREGATION(queryHash, params);
    await this.cacheManager.set(
      cacheKey, 
      data, 
      ADVANCED_CACHE_CONFIG.COMPLEX_QUERIES,
      { type: 'complex_query', queryHash, params }
    );
  }

  async getCrossSystemQuery(
    systems: string[], 
    dateRange: string, 
    filters: any
  ): Promise<any | null> {
    const cacheKey = ADVANCED_CACHE_KEYS.QUERIES.CROSS_SYSTEM(systems, dateRange, filters);
    return await this.cacheManager.get(cacheKey, ADVANCED_CACHE_CONFIG.UNIFIED_DATA);
  }

  async setCrossSystemQuery(
    data: any, 
    systems: string[], 
    dateRange: string, 
    filters: any
  ): Promise<void> {
    const cacheKey = ADVANCED_CACHE_KEYS.QUERIES.CROSS_SYSTEM(systems, dateRange, filters);
    await this.cacheManager.set(
      cacheKey, 
      data, 
      ADVANCED_CACHE_CONFIG.UNIFIED_DATA,
      { type: 'cross_system_query', systems, dateRange, filters }
    );
  }
}

/**
 * Unified data caching across systems
 */
export class UnifiedDataCache {
  private cacheManager = AdvancedCacheManager.getInstance();

  async getLocationData(locationId: string, includeSystems: string[]): Promise<any | null> {
    const cacheKey = ADVANCED_CACHE_KEYS.UNIFIED.LOCATION_DATA(locationId, includeSystems);
    return await this.cacheManager.get(cacheKey, ADVANCED_CACHE_CONFIG.UNIFIED_DATA);
  }

  async setLocationData(
    data: any, 
    locationId: string, 
    includeSystems: string[]
  ): Promise<void> {
    const cacheKey = ADVANCED_CACHE_KEYS.UNIFIED.LOCATION_DATA(locationId, includeSystems);
    await this.cacheManager.set(
      cacheKey, 
      data, 
      ADVANCED_CACHE_CONFIG.UNIFIED_DATA,
      { type: 'unified_location', locationId, includeSystems }
    );
  }

  async getSystemStatus(systems: string[]): Promise<any | null> {
    const cacheKey = ADVANCED_CACHE_KEYS.UNIFIED.SYSTEM_STATUS(systems);
    return await this.cacheManager.get(cacheKey, ADVANCED_CACHE_CONFIG.HEALTH_METRICS);
  }

  async setSystemStatus(data: any, systems: string[]): Promise<void> {
    const cacheKey = ADVANCED_CACHE_KEYS.UNIFIED.SYSTEM_STATUS(systems);
    await this.cacheManager.set(
      cacheKey, 
      data, 
      ADVANCED_CACHE_CONFIG.HEALTH_METRICS,
      { type: 'system_status', systems }
    );
  }
}

/**
 * Utility functions for advanced caching
 */
export async function withAdvancedCache<T>(
  cacheKey: string,
  fetchFunction: () => Promise<T>,
  ttl: number,
  validator?: (data: T) => boolean
): Promise<T> {
  const cacheManager = AdvancedCacheManager.getInstance();
  
  // Try to get from cache first
  const cached = await cacheManager.get<T>(cacheKey, ttl, validator);
  if (cached !== null) {
    return cached;
  }
  
  // Fetch fresh data
  const freshData = await fetchFunction();
  
  // Cache the result
  await cacheManager.set(cacheKey, freshData, ttl);
  
  return freshData;
}

/**
 * Feature flag controlled caching
 */
export async function withFeatureCache<T>(
  featureKey: string,
  cacheKey: string,
  fetchFunction: () => Promise<T>,
  ttl: number
): Promise<T> {
  const cachingEnabled = await getConfig<boolean>(featureKey, true);
  
  if (!cachingEnabled) {
    return await fetchFunction();
  }
  
  return await withAdvancedCache(cacheKey, fetchFunction, ttl);
}

/**
 * Cache warmup functions for frequently accessed data
 */
export const CacheWarmupStrategies = {
  async warmupDashboardData(): Promise<void> {
    console.log('[CACHE_WARMUP] Warming up dashboard data...');
    // This would trigger fetches for common dashboard queries
    // Implementation depends on your specific dashboard needs
  },

  async warmupLocationData(): Promise<void> {
    console.log('[CACHE_WARMUP] Warming up location data...');
    // Pre-fetch common location queries
  },

  async warmupAnalytics(): Promise<void> {
    console.log('[CACHE_WARMUP] Warming up analytics data...');
    // Pre-compute common analytics queries
  }
};

// Export singleton instances
export const dashboardCache = new DashboardCache();
export const queryCache = new QueryCache();
export const unifiedDataCache = new UnifiedDataCache();
export const advancedCacheManager = AdvancedCacheManager.getInstance();

/**
 * Initialize advanced caching system
 */
export async function initializeAdvancedCaching(): Promise<{
  success: boolean;
  message: string;
  features: string[];
}> {
  try {
    // Check if advanced caching is enabled
    const advancedCachingEnabled = await getConfig<boolean>(
      CONFIG_KEYS.FEATURES.SMARTFILL_CACHING, 
      true
    );
    
    if (!advancedCachingEnabled) {
      return {
        success: false,
        message: 'Advanced caching disabled by feature flag',
        features: []
      };
    }

    // Test cache health
    const cacheHealth = await cacheHealthCheck();
    if (!cacheHealth.healthy) {
      return {
        success: false,
        message: `Cache health check failed: ${cacheHealth.error}`,
        features: []
      };
    }

    // Initialize cache warmup
    const cacheManager = AdvancedCacheManager.getInstance();
    await cacheManager.warmupCache([
      CacheWarmupStrategies.warmupDashboardData,
      CacheWarmupStrategies.warmupLocationData,
      CacheWarmupStrategies.warmupAnalytics
    ]);

    const features = [
      'Dashboard result caching',
      'Query result caching',
      'Cross-system data caching',
      'Intelligent cache invalidation',
      'Pattern-based cache management',
      'Feature flag controlled caching'
    ];

    return {
      success: true,
      message: 'Advanced caching system initialized successfully',
      features
    };

  } catch (error) {
    console.error('[ADVANCED_CACHE] Initialization failed:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown initialization error',
      features: []
    };
  }
}