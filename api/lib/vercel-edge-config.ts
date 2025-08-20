/**
 * SERVER-SIDE VERCEL EDGE CONFIG
 */

export const CONFIG_KEYS = {
  FEATURE_FLAGS: {
    ANALYTICS_ENABLED: 'analytics_enabled',
    CROSS_SYSTEM_DATA: 'cross_system_data',
    BLOB_UPLOADS: 'blob_uploads'
  },
  FEATURES: {
    ADVANCED_ANALYTICS: 'analytics_enabled' // Alias for compatibility
  },
  LIMITS: {
    MAX_UPLOAD_SIZE: 'max_upload_size',
    MAX_API_CALLS: 'max_api_calls'
  }
} as const;

export async function isFeatureEnabled(key: string): Promise<boolean> {
  // Simple feature flag implementation for server-side
  const defaultFlags: Record<string, boolean> = {
    [CONFIG_KEYS.FEATURE_FLAGS.ANALYTICS_ENABLED]: true,
    [CONFIG_KEYS.FEATURE_FLAGS.CROSS_SYSTEM_DATA]: true,
    [CONFIG_KEYS.FEATURE_FLAGS.BLOB_UPLOADS]: true
  };
  
  return defaultFlags[key] ?? false;
}

export async function getConfigValue(key: string): Promise<any> {
  const defaultValues: Record<string, any> = {
    [CONFIG_KEYS.LIMITS.MAX_UPLOAD_SIZE]: 100 * 1024 * 1024, // 100MB
    [CONFIG_KEYS.LIMITS.MAX_API_CALLS]: 1000
  };
  
  return defaultValues[key] ?? null;
}