/**
 * VERCEL KV (REDIS) CACHE UTILITIES
 * 
 * Provides high-performance caching for API responses, user sessions,
 * and rate limiting using Vercel's serverless Redis infrastructure
 */

import { kv } from '@vercel/kv';

// Cache configuration constants
export const CACHE_CONFIG = {
  // API Response Caching (in seconds)
  SMARTFILL_API: 300, // 5 minutes - fuel data updates every ~10-15 minutes
  AGBOT_API: 600, // 10 minutes - device data updates less frequently
  CAPTIVE_PAYMENTS: 1800, // 30 minutes - financial data updates daily
  USER_SESSIONS: 86400, // 24 hours
  QUERY_RESULTS: 600, // 10 minutes for dashboard analytics
  RATE_LIMITING: 3600, // 1 hour for rate limit counters
  UNIFIED_DATA: 900, // 15 minutes for unified location data
  
  // Deduplication windows
  REQUEST_DEDUP: 30, // 30 seconds to prevent concurrent identical requests
  
  // System settings
  SYSTEM_CONFIG: 300, // 5 minutes for feature flags and configs
} as const;

// Cache key prefixes for organization
export const CACHE_KEYS = {
  SMARTFILL_TANKS: 'smartfill:tanks:',
  SMARTFILL_CUSTOMERS: 'smartfill:customers:',
  SMARTFILL_SYNC: 'smartfill:sync:',
  
  AGBOT_LOCATIONS: 'agbot:locations:',
  AGBOT_ASSETS: 'agbot:assets:',
  AGBOT_HEALTH: 'agbot:health:',
  
  CAPTIVE_ANALYTICS: 'captive:analytics:',
  CAPTIVE_DELIVERIES: 'captive:deliveries:',
  
  USER_SESSION: 'user:session:',
  USER_PREFS: 'user:prefs:',
  
  RATE_LIMIT: 'rate:',
  REQUEST_DEDUP: 'dedup:',
  
  QUERY_CACHE: 'query:',
  SYSTEM_CONFIG: 'config:',
} as const;

/**
 * Generic cache interface for type safety
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Tags for cache invalidation
  compress?: boolean; // Compress large responses
}

/**
 * Cache a value with automatic expiration
 */
export async function cacheSet<T>(
  key: string, 
  value: T, 
  ttl: number = CACHE_CONFIG.QUERY_RESULTS
): Promise<void> {
  try {
    await kv.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.warn(`[CACHE] Failed to set cache for key: ${key}`, error);
  }
}

/**
 * Retrieve a cached value
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const cached = await kv.get<string>(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
    return null;
  } catch (error) {
    console.warn(`[CACHE] Failed to get cache for key: ${key}`, error);
    return null;
  }
}

/**
 * Check if a key exists in cache
 */
export async function cacheExists(key: string): Promise<boolean> {
  try {
    const exists = await kv.exists(key);
    return exists === 1;
  } catch (error) {
    console.warn(`[CACHE] Failed to check existence for key: ${key}`, error);
    return false;
  }
}

/**
 * Delete a cached value
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    await kv.del(key);
  } catch (error) {
    console.warn(`[CACHE] Failed to delete cache for key: ${key}`, error);
  }
}

/**
 * Delete multiple cached values by pattern
 */
export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    // Get all keys matching the pattern
    const keys = await kv.keys(pattern);
    if (keys.length > 0) {
      await kv.del(...keys);
    }
  } catch (error) {
    console.warn(`[CACHE] Failed to delete cache pattern: ${pattern}`, error);
  }
}

/**
 * Increment a counter (useful for rate limiting)
 */
export async function cacheIncr(key: string, ttl?: number): Promise<number> {
  try {
    const count = await kv.incr(key);
    if (ttl && count === 1) {
      // Set expiration only for the first increment
      await kv.expire(key, ttl);
    }
    return count;
  } catch (error) {
    console.warn(`[CACHE] Failed to increment counter for key: ${key}`, error);
    return 0;
  }
}

/**
 * Get or set cached value with a fallback function
 */
export async function cacheGetOrSet<T>(
  key: string,
  fallback: () => Promise<T>,
  ttl: number = CACHE_CONFIG.QUERY_RESULTS
): Promise<T> {
  try {
    // Try to get cached value first
    const cached = await cacheGet<T>(key);
    if (cached !== null) {
      return cached;
    }

    // If not cached, execute fallback and cache result
    const result = await fallback();
    await cacheSet(key, result, ttl);
    return result;
  } catch (error) {
    console.warn(`[CACHE] Failed to get/set cache for key: ${key}`, error);
    // Fallback to direct execution if cache fails
    return await fallback();
  }
}

/**
 * API Response Caching Wrapper
 */
export async function cacheApiResponse<T>(
  cacheKey: string,
  apiCall: () => Promise<T>,
  ttl: number = CACHE_CONFIG.SMARTFILL_API
): Promise<T> {
  return await cacheGetOrSet(cacheKey, apiCall, ttl);
}

/**
 * Request deduplication - prevents multiple identical requests
 */
export async function withRequestDeduplication<T>(
  requestKey: string,
  apiCall: () => Promise<T>,
  windowSeconds: number = CACHE_CONFIG.REQUEST_DEDUP
): Promise<T> {
  const dedupKey = `${CACHE_KEYS.REQUEST_DEDUP}${requestKey}`;
  
  try {
    // Check if request is already in progress
    const inProgress = await cacheExists(dedupKey);
    if (inProgress) {
      // Wait for a short time and try to get cached result
      await new Promise(resolve => setTimeout(resolve, 1000));
      const cached = await cacheGet<T>(dedupKey);
      if (cached) {
        return cached;
      }
    }

    // Mark request as in progress
    await cacheSet(dedupKey, 'in_progress', windowSeconds);

    // Execute the API call
    const result = await apiCall();

    // Cache the result
    await cacheSet(dedupKey, result, windowSeconds);

    return result;
  } catch (error) {
    // Clean up the deduplication lock on error
    await cacheDel(dedupKey);
    throw error;
  }
}

/**
 * Rate limiting functionality
 */
export interface RateLimitResult {
  allowed: boolean;
  count: number;
  resetTime: number;
}

export async function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowSeconds: number = CACHE_CONFIG.RATE_LIMITING
): Promise<RateLimitResult> {
  const rateLimitKey = `${CACHE_KEYS.RATE_LIMIT}${identifier}`;
  
  try {
    const count = await cacheIncr(rateLimitKey, windowSeconds);
    const resetTime = Date.now() + (windowSeconds * 1000);
    
    return {
      allowed: count <= limit,
      count,
      resetTime
    };
  } catch (error) {
    console.warn(`[RATE_LIMIT] Failed to check rate limit for: ${identifier}`, error);
    // On error, allow the request
    return {
      allowed: true,
      count: 1,
      resetTime: Date.now() + (windowSeconds * 1000)
    };
  }
}

/**
 * Cache warming functionality - preload important data
 */
export async function warmCache(warmers: Array<{
  key: string;
  loader: () => Promise<any>;
  ttl?: number;
}>): Promise<void> {
  const promises = warmers.map(async ({ key, loader, ttl = CACHE_CONFIG.QUERY_RESULTS }) => {
    try {
      // Only warm if not already cached
      const exists = await cacheExists(key);
      if (!exists) {
        const data = await loader();
        await cacheSet(key, data, ttl);
      }
    } catch (error) {
      console.warn(`[CACHE_WARM] Failed to warm cache for key: ${key}`, error);
    }
  });
  
  await Promise.allSettled(promises);
}

/**
 * Cache statistics for monitoring
 */
export async function getCacheStats(): Promise<{
  info: any;
  keyCount: number;
  memoryUsage: string;
}> {
  try {
    // Note: kv.info() may not be available in current version
    const info = await kv.exists('health-check') || {};
    const keyCount = await kv.dbsize();
    
    return {
      info,
      keyCount,
      memoryUsage: 'unknown' // KV info not available
    };
  } catch (error) {
    console.warn('[CACHE_STATS] Failed to get cache statistics', error);
    return {
      info: {},
      keyCount: 0,
      memoryUsage: 'unknown'
    };
  }
}

/**
 * Health check for cache system
 */
export async function cacheHealthCheck(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const start = Date.now();
  const testKey = 'health_check_test';
  const testValue = { timestamp: start };
  
  try {
    // Test write
    await cacheSet(testKey, testValue, 10);
    
    // Test read
    const retrieved = await cacheGet<typeof testValue>(testKey);
    
    // Test delete
    await cacheDel(testKey);
    
    const latency = Date.now() - start;
    
    return {
      healthy: retrieved?.timestamp === start,
      latency
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}