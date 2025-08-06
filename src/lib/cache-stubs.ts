/**
 * CLIENT-SIDE CACHE STUBS
 * 
 * These are no-op implementations for client-side usage
 * Real caching happens on the server side with Vercel KV
 */

// Stub functions that do nothing on client side
export async function cacheApiResponse<T>(
  cacheKey: string,
  apiCall: () => Promise<T>,
  ttl?: number
): Promise<T> {
  // On client side, always execute the API call
  return await apiCall();
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  // No client-side caching
  return null;
}

export async function cacheSet<T>(key: string, value: T, ttl?: number): Promise<void> {
  // No-op on client side
}

export async function cacheDel(key: string): Promise<void> {
  // No-op on client side
}

export async function cacheHealthCheck(): Promise<{
  healthy: boolean;
  latency: number;
  error?: string;
}> {
  // Client side always returns healthy since no cache
  return {
    healthy: true,
    latency: 0
  };
}

export async function withRequestDeduplication<T>(
  requestKey: string,
  apiCall: () => Promise<T>,
  windowSeconds?: number
): Promise<T> {
  // On client side, always execute the API call
  return await apiCall();
}

export async function checkRateLimit(
  identifier: string,
  limit?: number,
  windowSeconds?: number
): Promise<{
  allowed: boolean;
  count: number;
  resetTime: number;
}> {
  // Client side always allows requests
  return {
    allowed: true,
    count: 1,
    resetTime: Date.now() + 3600000 // 1 hour from now
  };
}

// Export cache config for consistency
export const CACHE_CONFIG = {
  SMARTFILL_API: 300,
  AGBOT_API: 600,
  CAPTIVE_PAYMENTS: 1800,
  USER_SESSIONS: 86400,
  QUERY_RESULTS: 600,
  RATE_LIMITING: 3600,
  REQUEST_DEDUP: 30,
  SYSTEM_CONFIG: 300,
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