/**
 * MULTI-LAYER CACHING ARCHITECTURE
 * 
 * Implements a sophisticated multi-layer caching system with:
 * - L1: In-memory cache (fastest)
 * - L2: Vercel KV cache (fast, persistent)
 * - L3: Database cache (slowest, most persistent)
 * 
 * Features:
 * - Automatic cache promotion/demotion
 * - Intelligent TTL management
 * - Cache warming strategies
 * - Performance monitoring
 * - Fallback mechanisms
 */

import { 
  cacheGet as kvGet, 
  cacheSet as kvSet, 
  cacheDel as kvDel,
  CACHE_CONFIG,
  CACHE_KEYS,
  calculateSmartTTL
} from '@/lib/vercel-kv-cache';

// L1 Cache: In-memory cache
class InMemoryCache {
  private cache = new Map<string, { value: any; expires: number; hits: number; lastAccess: number }>();
  private maxSize = 1000; // Maximum number of entries
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };

  set(key: string, value: any, ttlMs: number = 5 * 60 * 1000): void {
    // Clean up expired entries if cache is getting full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const expires = Date.now() + ttlMs;
    this.cache.set(key, {
      value,
      expires,
      hits: 0,
      lastAccess: Date.now()
    });
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    entry.lastAccess = Date.now();
    this.stats.hits++;
    return entry.value;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
        : 0
    };
  }

  // Get hot keys (frequently accessed)
  getHotKeys(limit: number = 10): Array<{ key: string; hits: number; lastAccess: number }> {
    return Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, hits: entry.hits, lastAccess: entry.lastAccess }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
  }
}

// Cache layer configuration
interface CacheLayerConfig {
  l1: {
    enabled: boolean;
    ttlMs: number;
    maxSize: number;
  };
  l2: {
    enabled: boolean;
    ttlSeconds: number;
  };
  l3: {
    enabled: boolean;
    ttlSeconds: number;
  };
}

// Default configuration
const DEFAULT_CONFIG: CacheLayerConfig = {
  l1: {
    enabled: true,
    ttlMs: 5 * 60 * 1000, // 5 minutes
    maxSize: 1000
  },
  l2: {
    enabled: true,
    ttlSeconds: 30 * 60 // 30 minutes
  },
  l3: {
    enabled: true,
    ttlSeconds: 2 * 60 * 60 // 2 hours
  }
};

// Cache strategy enum
export enum CacheStrategy {
  WRITE_THROUGH = 'write_through',     // Write to all layers simultaneously
  WRITE_BEHIND = 'write_behind',       // Write to L1 first, then async to others
  WRITE_AROUND = 'write_around',       // Skip L1, write to L2/L3
  READ_THROUGH = 'read_through',       // Check L1 -> L2 -> L3 -> Source
  CACHE_ASIDE = 'cache_aside'          // Manual cache management
}

// Performance metrics
interface CacheMetrics {
  l1: { hits: number; misses: number; hitRate: number; size: number };
  l2: { hits: number; misses: number; hitRate: number };
  l3: { hits: number; misses: number; hitRate: number };
  overall: { hits: number; misses: number; hitRate: number };
  promotions: number; // L2 -> L1
  demotions: number;  // L1 -> L2
}

/**
 * Multi-Layer Cache Manager
 */
export class MultiLayerCache {
  private l1Cache: InMemoryCache;
  private config: CacheLayerConfig;
  private metrics: CacheMetrics;
  private warmingQueue = new Set<string>();

  constructor(config: Partial<CacheLayerConfig> = {}) {
    this.l1Cache = new InMemoryCache();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.metrics = {
      l1: { hits: 0, misses: 0, hitRate: 0, size: 0 },
      l2: { hits: 0, misses: 0, hitRate: 0 },
      l3: { hits: 0, misses: 0, hitRate: 0 },
      overall: { hits: 0, misses: 0, hitRate: 0 },
      promotions: 0,
      demotions: 0
    };

    // Periodic cleanup and stats update
    setInterval(() => {
      this.updateMetrics();
      this.performMaintenance();
    }, 60 * 1000); // Every minute
  }

  /**
   * Get value with multi-layer fallback
   */
  async get(key: string, strategy: CacheStrategy = CacheStrategy.READ_THROUGH): Promise<any | null> {
    let value: any = null;
    let foundIn: 'l1' | 'l2' | 'l3' | null = null;

    // L1 Cache (In-memory)
    if (this.config.l1.enabled) {
      value = this.l1Cache.get(key);
      if (value !== null) {
        foundIn = 'l1';
        this.metrics.l1.hits++;
        this.metrics.overall.hits++;
        return value;
      }
      this.metrics.l1.misses++;
    }

    // L2 Cache (Vercel KV)
    if (this.config.l2.enabled) {
      try {
        value = await kvGet(key);
        if (value !== null) {
          foundIn = 'l2';
          this.metrics.l2.hits++;
          this.metrics.overall.hits++;

          // Promote to L1 if it's a hot key
          if (this.config.l1.enabled && strategy === CacheStrategy.READ_THROUGH) {
            this.l1Cache.set(key, value, this.config.l1.ttlMs);
            this.metrics.promotions++;
          }

          return value;
        }
        this.metrics.l2.misses++;
      } catch (error) {
        console.warn('L2 cache read failed:', error);
        this.metrics.l2.misses++;
      }
    }

    // L3 Cache (Database/Persistent storage) - not implemented in this example
    // This would typically query a database cache table
    this.metrics.l3.misses++;
    this.metrics.overall.misses++;

    return null;
  }

  /**
   * Set value across cache layers
   */
  async set(
    key: string, 
    value: any, 
    ttlSeconds?: number, 
    strategy: CacheStrategy = CacheStrategy.WRITE_THROUGH
  ): Promise<void> {
    const actualTTL = ttlSeconds || calculateSmartTTL('QUERY_RESULTS', 'medium');

    switch (strategy) {
      case CacheStrategy.WRITE_THROUGH:
        // Write to all layers simultaneously
        await this.writeToAllLayers(key, value, actualTTL);
        break;

      case CacheStrategy.WRITE_BEHIND:
        // Write to L1 immediately, then async to others
        if (this.config.l1.enabled) {
          this.l1Cache.set(key, value, actualTTL * 1000);
        }
        // Async write to L2/L3
        setTimeout(() => this.writeToLowerLayers(key, value, actualTTL), 0);
        break;

      case CacheStrategy.WRITE_AROUND:
        // Skip L1, write to L2/L3
        await this.writeToLowerLayers(key, value, actualTTL);
        break;

      default:
        await this.writeToAllLayers(key, value, actualTTL);
    }
  }

  /**
   * Delete from all cache layers
   */
  async delete(key: string): Promise<void> {
    if (this.config.l1.enabled) {
      this.l1Cache.delete(key);
    }

    if (this.config.l2.enabled) {
      try {
        await kvDel(key);
      } catch (error) {
        console.warn('L2 cache delete failed:', error);
      }
    }

    // L3 delete would go here
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(
    entries: Array<{ key: string; fetcher: () => Promise<any>; ttl?: number }>
  ): Promise<void> {
    const promises = entries.map(async ({ key, fetcher, ttl }) => {
      if (this.warmingQueue.has(key)) return; // Already warming
      
      this.warmingQueue.add(key);
      
      try {
        // Check if already cached
        const cached = await this.get(key);
        if (cached !== null) {
          this.warmingQueue.delete(key);
          return;
        }

        // Fetch and cache
        const value = await fetcher();
        await this.set(key, value, ttl, CacheStrategy.WRITE_THROUGH);
      } catch (error) {
        console.warn(`Cache warming failed for key ${key}:`, error);
      } finally {
        this.warmingQueue.delete(key);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Get cache statistics
   */
  getMetrics(): CacheMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get hot keys from L1 cache
   */
  getHotKeys(limit: number = 10): Array<{ key: string; hits: number; lastAccess: number }> {
    return this.l1Cache.getHotKeys(limit);
  }

  /**
   * Clear all cache layers
   */
  async clearAll(): Promise<void> {
    if (this.config.l1.enabled) {
      this.l1Cache.clear();
    }

    // Note: For L2, we'd need pattern deletion which requires additional implementation
    console.log('L2 and L3 cache clearing would require pattern-based deletion');
  }

  /**
   * Configure cache behavior
   */
  updateConfig(newConfig: Partial<CacheLayerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Private helper methods
   */
  private async writeToAllLayers(key: string, value: any, ttlSeconds: number): Promise<void> {
    const promises: Promise<void>[] = [];

    // L1
    if (this.config.l1.enabled) {
      promises.push(Promise.resolve(this.l1Cache.set(key, value, ttlSeconds * 1000)));
    }

    // L2
    if (this.config.l2.enabled) {
      promises.push(kvSet(key, value, ttlSeconds));
    }

    // L3 would go here

    await Promise.allSettled(promises);
  }

  private async writeToLowerLayers(key: string, value: any, ttlSeconds: number): Promise<void> {
    const promises: Promise<void>[] = [];

    // L2
    if (this.config.l2.enabled) {
      promises.push(kvSet(key, value, ttlSeconds));
    }

    // L3 would go here

    await Promise.allSettled(promises);
  }

  private updateMetrics(): void {
    const l1Stats = this.l1Cache.getStats();
    this.metrics.l1 = {
      hits: l1Stats.hits,
      misses: l1Stats.misses,
      hitRate: l1Stats.hitRate,
      size: l1Stats.size
    };

    // Calculate overall metrics
    const totalHits = this.metrics.l1.hits + this.metrics.l2.hits + this.metrics.l3.hits;
    const totalMisses = this.metrics.l1.misses + this.metrics.l2.misses + this.metrics.l3.misses;
    
    this.metrics.overall = {
      hits: totalHits,
      misses: totalMisses,
      hitRate: totalHits + totalMisses > 0 ? (totalHits / (totalHits + totalMisses)) * 100 : 0
    };
  }

  private performMaintenance(): void {
    // This could include:
    // - Demoting cold keys from L1 to L2
    // - Promoting hot keys from L2 to L1
    // - Cleaning up expired entries
    // - Rebalancing cache sizes
    
    const hotKeys = this.getHotKeys(50);
    console.log(`Cache maintenance: ${hotKeys.length} hot keys identified`);
  }
}

/**
 * Cache-aware data fetcher with multi-layer support
 */
export async function fetchWithMultiLayerCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number;
    strategy?: CacheStrategy;
    cacheInstance?: MultiLayerCache;
  } = {}
): Promise<T> {
  const cache = options.cacheInstance || globalCache;
  const strategy = options.strategy || CacheStrategy.READ_THROUGH;

  // Try to get from cache first
  const cached = await cache.get(key, strategy);
  if (cached !== null) {
    return cached;
  }

  // Cache miss - fetch from source
  const value = await fetcher();
  
  // Cache the result
  await cache.set(key, value, options.ttl, strategy);
  
  return value;
}

/**
 * Higher-order function for automatic caching
 */
export function withMultiLayerCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    keyGenerator: (...args: Parameters<T>) => string;
    ttl?: number;
    strategy?: CacheStrategy;
    cacheInstance?: MultiLayerCache;
  }
): T {
  return (async (...args: Parameters<T>) => {
    const key = options.keyGenerator(...args);
    return await fetchWithMultiLayerCache(
      key,
      () => fn(...args),
      options
    );
  }) as T;
}

/**
 * Smart cache warming based on access patterns
 */
export class SmartCacheWarmer {
  private accessPatterns = new Map<string, { count: number; lastAccess: number; avgFrequency: number }>();
  private cache: MultiLayerCache;

  constructor(cache: MultiLayerCache) {
    this.cache = cache;
    
    // Analyze patterns every 5 minutes
    setInterval(() => {
      this.analyzeAndWarm();
    }, 5 * 60 * 1000);
  }

  recordAccess(key: string): void {
    const now = Date.now();
    const pattern = this.accessPatterns.get(key);
    
    if (pattern) {
      const timeSinceLastAccess = now - pattern.lastAccess;
      pattern.count++;
      pattern.lastAccess = now;
      pattern.avgFrequency = (pattern.avgFrequency + timeSinceLastAccess) / 2;
    } else {
      this.accessPatterns.set(key, {
        count: 1,
        lastAccess: now,
        avgFrequency: 0
      });
    }
  }

  async warmPredictedKeys(): Promise<void> {
    const predictions = this.predictHotKeys();
    
    const warmingEntries = await Promise.all(
      predictions.map(async (key) => {
        // This would need to be customized based on your data sources
        return {
          key,
          fetcher: () => this.fetchDataForKey(key),
          ttl: calculateSmartTTL('QUERY_RESULTS', 'high')
        };
      })
    );

    await this.cache.warmCache(warmingEntries);
  }

  private predictHotKeys(): string[] {
    const now = Date.now();
    const predictions: Array<{ key: string; score: number }> = [];

    for (const [key, pattern] of this.accessPatterns.entries()) {
      const timeSinceLastAccess = now - pattern.lastAccess;
      const frequency = pattern.count;
      const recentness = Math.max(0, 1 - (timeSinceLastAccess / (24 * 60 * 60 * 1000))); // Decay over 24 hours
      
      const score = frequency * recentness;
      predictions.push({ key, score });
    }

    return predictions
      .sort((a, b) => b.score - a.score)
      .slice(0, 20) // Top 20 predictions
      .map(p => p.key);
  }

  private async analyzeAndWarm(): Promise<void> {
    await this.warmPredictedKeys();
  }

  private async fetchDataForKey(key: string): Promise<any> {
    // This would be implemented based on your specific data sources
    // For example, it might route to different APIs based on key patterns
    console.log(`Fetching data for predicted hot key: ${key}`);
    return null;
  }
}

// Global cache instance
export const globalCache = new MultiLayerCache();

// Global smart warmer
export const smartWarmer = new SmartCacheWarmer(globalCache);

// Export cache strategies
export { CacheStrategy };

// Utility functions for common cache patterns
export const CacheUtils = {
  /**
   * Generate cache key for user-specific data
   */
  userKey: (userId: string, type: string, id?: string): string => {
    return `${CACHE_KEYS.USER_SESSION}${userId}:${type}${id ? `:${id}` : ''}`;
  },

  /**
   * Generate cache key for API responses
   */
  apiKey: (endpoint: string, params?: Record<string, any>): string => {
    const paramString = params ? `:${JSON.stringify(params)}` : '';
    return `${CACHE_KEYS.QUERY_CACHE}api:${endpoint}${paramString}`;
  },

  /**
   * Generate cache key for SmartFill data
   */
  smartFillKey: (type: 'tanks' | 'customers' | 'sync', id: string): string => {
    const keyMap = {
      tanks: CACHE_KEYS.SMARTFILL_TANKS,
      customers: CACHE_KEYS.SMARTFILL_CUSTOMERS,
      sync: CACHE_KEYS.SMARTFILL_SYNC
    };
    return `${keyMap[type]}${id}`;
  },

  /**
   * Generate cache key for AgBot data
   */
  agbotKey: (type: 'locations' | 'assets' | 'health', id: string): string => {
    const keyMap = {
      locations: CACHE_KEYS.AGBOT_LOCATIONS,
      assets: CACHE_KEYS.AGBOT_ASSETS,
      health: CACHE_KEYS.AGBOT_HEALTH
    };
    return `${keyMap[type]}${id}`;
  }
};