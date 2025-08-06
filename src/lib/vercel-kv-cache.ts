/**
 * VERCEL KV CACHE IMPLEMENTATION
 * 
 * Full Vercel KV implementation with intelligent caching,
 * rate limiting, request deduplication, and error handling
 * 
 * Handles both client-side (stub) and server-side (KV) environments
 */

// Conditional KV import - only available on server side
const isServerSide = typeof window === 'undefined';
let kv: any = null;

if (isServerSide) {
  try {
    // Dynamic import to avoid bundling on client side
    const kvModule = require('@vercel/kv');
    kv = kvModule.kv;
  } catch (error) {
    console.warn('[KV CACHE] Vercel KV not available:', error);
    kv = null;
  }
}

// Configuration constants
export const CACHE_CONFIG = {
  SMARTFILL_API: 300,        // 5 minutes
  AGBOT_API: 600,            // 10 minutes  
  CAPTIVE_PAYMENTS: 1800,    // 30 minutes
  USER_SESSIONS: 86400,      // 24 hours
  QUERY_RESULTS: 600,        // 10 minutes
  RATE_LIMITING: 3600,       // 1 hour
  REQUEST_DEDUP: 30,         // 30 seconds
  SYSTEM_CONFIG: 300,        // 5 minutes
} as const;

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

// Request deduplication storage
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Enhanced cache API response with intelligent TTL
 */
export async function cacheApiResponse<T>(
  cacheKey: string,
  apiCall: () => Promise<T>,
  ttl: number = CACHE_CONFIG.QUERY_RESULTS
): Promise<T> {
  try {
    // Try to get from cache first
    const cached = await cacheGet<T>(cacheKey);
    if (cached !== null) {
      console.log(`[KV CACHE] Hit: ${cacheKey}`);
      return cached;
    }

    // Cache miss - execute API call
    console.log(`[KV CACHE] Miss: ${cacheKey} - executing API call`);
    const result = await apiCall();
    
    // Cache the result with TTL
    await cacheSet(cacheKey, result, ttl);
    
    return result;
  } catch (error) {
    console.error(`[KV CACHE] Error for ${cacheKey}:`, error);
    // Fallback to direct API call if cache fails
    return await apiCall();
  }
}

/**
 * Get value from KV cache with error handling
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!kv) {
    console.debug('[KV CACHE] KV not available - returning null');
    return null;
  }
  
  try {
    const value = await kv.get<T>(key);
    return value;
  } catch (error) {
    console.warn(`[KV CACHE] Get failed for ${key}:`, error);
    return null;
  }
}

/**
 * Set value in KV cache with TTL and error handling  
 */
export async function cacheSet<T>(key: string, value: T, ttl?: number): Promise<void> {
  if (!kv) {
    console.debug('[KV CACHE] KV not available - skipping set');
    return;
  }
  
  try {
    if (ttl) {
      await kv.setex(key, ttl, JSON.stringify(value));
    } else {
      await kv.set(key, JSON.stringify(value));
    }
    console.log(`[KV CACHE] Set: ${key} (TTL: ${ttl || 'none'}s)`);
  } catch (error) {
    console.warn(`[KV CACHE] Set failed for ${key}:`, error);
    // Don't throw - cache failures shouldn't break the app
  }
}

/**
 * Delete value from KV cache with pattern support
 */
export async function cacheDel(keyOrPattern: string): Promise<void> {
  if (!kv) {
    console.debug('[KV CACHE] KV not available - skipping delete');
    return;
  }
  
  try {
    if (keyOrPattern.includes('*')) {
      // Handle pattern deletion
      const keys = await kv.keys(keyOrPattern);
      if (keys.length > 0) {
        await kv.del(...keys);
        console.log(`[KV CACHE] Deleted ${keys.length} keys matching ${keyOrPattern}`);
      }
    } else {
      // Single key deletion
      await kv.del(keyOrPattern);
      console.log(`[KV CACHE] Deleted: ${keyOrPattern}`);
    }
  } catch (error) {
    console.warn(`[KV CACHE] Delete failed for ${keyOrPattern}:`, error);
  }
}

/**
 * KV health check with latency measurement
 */
export async function cacheHealthCheck(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  const startTime = Date.now();
  const testKey = 'health:check:' + Date.now();
  
  if (!kv) {
    return {
      healthy: false,
      latency: Date.now() - startTime,
      error: 'KV not available (client-side or missing dependency)'
    };
  }
  
  try {
    // Test write
    await kv.set(testKey, 'ping');
    
    // Test read
    const value = await kv.get(testKey);
    
    // Test delete
    await kv.del(testKey);
    
    const latency = Date.now() - startTime;
    
    return {
      healthy: value === 'ping',
      latency
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      healthy: false,
      latency,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Request deduplication to prevent duplicate API calls
 */
export async function withRequestDeduplication<T>(
  requestKey: string,
  apiCall: () => Promise<T>,
  windowSeconds: number = CACHE_CONFIG.REQUEST_DEDUP
): Promise<T> {
  // Check if request is already pending
  if (pendingRequests.has(requestKey)) {
    console.log(`[KV CACHE] Deduplicating request: ${requestKey}`);
    return await pendingRequests.get(requestKey)!;
  }

  // Execute the request and store the promise
  const promise = (async () => {
    try {
      const result = await apiCall();
      
      // Cache the result briefly to handle rapid successive requests
      const cacheKey = `${CACHE_KEYS.REQUEST_DEDUP}${requestKey}`;
      await cacheSet(cacheKey, result, windowSeconds);
      
      return result;
    } finally {
      // Remove from pending requests
      pendingRequests.delete(requestKey);
    }
  })();

  pendingRequests.set(requestKey, promise);
  return await promise;
}

/**
 * Enhanced rate limiting with sliding window
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowSeconds: number = CACHE_CONFIG.RATE_LIMITING
): Promise<{
  allowed: boolean;
  count: number;
  resetTime: number;
}> {
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);
  const rateLimitKey = `${CACHE_KEYS.RATE_LIMIT}${identifier}`;

  if (!kv) {
    // Without KV, allow all requests (fail open)
    console.debug('[KV CACHE] KV not available - allowing all rate limit requests');
    return {
      allowed: true,
      count: 1,
      resetTime: now + (windowSeconds * 1000)
    };
  }

  try {
    // Get current request timestamps
    const requests = await kv.get<number[]>(rateLimitKey) || [];
    
    // Filter out requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit is exceeded
    const allowed = validRequests.length < limit;
    
    if (allowed) {
      // Add current request timestamp
      validRequests.push(now);
      
      // Update the cache with new timestamp list
      await cacheSet(rateLimitKey, validRequests, windowSeconds);
    }

    return {
      allowed,
      count: validRequests.length,
      resetTime: validRequests.length > 0 
        ? Math.max(...validRequests) + (windowSeconds * 1000)
        : now + (windowSeconds * 1000)
    };
  } catch (error) {
    console.warn(`[KV CACHE] Rate limit check failed for ${identifier}:`, error);
    
    // Fail open - allow request if rate limiting fails
    return {
      allowed: true,
      count: 0,
      resetTime: now + (windowSeconds * 1000)
    };
  }
}

/**
 * Intelligent cache warming for critical data
 */
export async function warmCache(
  cacheKey: string,
  dataFetcher: () => Promise<any>,
  ttl?: number
): Promise<void> {
  try {
    console.log(`[KV CACHE] Warming cache: ${cacheKey}`);
    const data = await dataFetcher();
    await cacheSet(cacheKey, data, ttl);
    console.log(`[KV CACHE] Cache warmed: ${cacheKey}`);
  } catch (error) {
    console.warn(`[KV CACHE] Cache warming failed for ${cacheKey}:`, error);
  }
}

/**
 * Batch operations for efficient cache management
 */
export async function cacheSetBatch(items: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
  if (!kv) {
    console.debug('[KV CACHE] KV not available - skipping batch set');
    return;
  }
  
  try {
    const pipeline = kv.pipeline();
    
    for (const item of items) {
      if (item.ttl) {
        pipeline.setex(item.key, item.ttl, JSON.stringify(item.value));
      } else {
        pipeline.set(item.key, JSON.stringify(item.value));
      }
    }
    
    await pipeline.exec();
    console.log(`[KV CACHE] Batch set completed: ${items.length} items`);
  } catch (error) {
    console.warn(`[KV CACHE] Batch set failed:`, error);
  }
}

/**
 * Cache invalidation with pattern matching
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  if (!kv) {
    console.debug('[KV CACHE] KV not available - skipping pattern invalidation');
    return 0;
  }
  
  try {
    const keys = await kv.keys(pattern);
    if (keys.length > 0) {
      await kv.del(...keys);
      console.log(`[KV CACHE] Invalidated ${keys.length} keys matching ${pattern}`);
    }
    return keys.length;
  } catch (error) {
    console.warn(`[KV CACHE] Pattern invalidation failed for ${pattern}:`, error);
    return 0;
  }
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats(): Promise<{
  keys: number;
  memory: string;
  operations: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
  };
}> {
  if (!kv) {
    return {
      keys: 0,
      memory: 'N/A (KV unavailable)',
      operations: { hits: 0, misses: 0, sets: 0, deletes: 0 }
    };
  }
  
  try {
    const info = await kv.info();
    
    // Parse Redis INFO response (simplified)
    const keyspace = info.match(/db0:keys=(\d+)/);
    const memory = info.match(/used_memory_human:([^\r\n]+)/);
    
    return {
      keys: keyspace ? parseInt(keyspace[1]) : 0,
      memory: memory ? memory[1] : '0B',
      operations: {
        hits: 0,    // These would need to be tracked separately
        misses: 0,  // in a production monitoring setup
        sets: 0,
        deletes: 0
      }
    };
  } catch (error) {
    console.warn('[KV CACHE] Stats collection failed:', error);
    return {
      keys: 0,
      memory: '0B',
      operations: { hits: 0, misses: 0, sets: 0, deletes: 0 }
    };
  }
}

/**
 * Smart TTL calculation based on data type and access patterns
 */
export function calculateSmartTTL(dataType: keyof typeof CACHE_CONFIG, accessPattern?: 'high' | 'medium' | 'low'): number {
  const baseTTL = CACHE_CONFIG[dataType];
  
  if (!accessPattern) return baseTTL;
  
  const multipliers = {
    high: 0.5,    // Shorter TTL for frequently accessed data
    medium: 1.0,  // Default TTL
    low: 2.0      // Longer TTL for rarely accessed data
  };
  
  return Math.floor(baseTTL * multipliers[accessPattern]);
}

/**
 * Cache-aside pattern implementation
 */
export async function cacheAside<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // Try cache first
  let value = await cacheGet<T>(key);
  
  if (value !== null) {
    return value;
  }
  
  // Cache miss - fetch from source
  value = await fetcher();
  
  // Update cache
  await cacheSet(key, value, ttl);
  
  return value;
}