/**
 * VERCEL EDGE CONFIG UTILITIES
 * 
 * Manages system configuration, feature flags, API keys,
 * and settings using Vercel's Edge Config for ultra-low latency access
 */

// Conditional import for Edge Config
let edgeConfig: any = null;

async function getEdgeConfig() {
  if (edgeConfig === null && typeof window === 'undefined') {
    try {
      const { get, getAll, has } = await import('@vercel/edge-config');
      edgeConfig = { get, getAll, has };
    } catch (error) {
      console.warn('[EDGE_CONFIG] @vercel/edge-config not available, using defaults');
      edgeConfig = false; // Mark as unavailable
    }
  }
  return edgeConfig || null;
}

// Configuration keys
export const CONFIG_KEYS = {
  // Feature flags
  FEATURES: {
    SMARTFILL_CACHING: 'features.smartfill_caching',
    AGBOT_CACHING: 'features.agbot_caching',
    CSV_SERVERLESS: 'features.csv_serverless_processing',
    ANALYTICS_WAREHOUSE: 'features.analytics_warehouse',
    RATE_LIMITING: 'features.rate_limiting',
    WEBHOOK_PROCESSING: 'features.webhook_processing',
    ADVANCED_ANALYTICS: 'features.advanced_analytics',
    MOBILE_OPTIMIZATION: 'features.mobile_optimization'
  },
  
  // System limits
  LIMITS: {
    MAX_FILE_SIZE: 'limits.max_file_size',
    MAX_API_CALLS_PER_HOUR: 'limits.max_api_calls_per_hour',
    MAX_CONCURRENT_UPLOADS: 'limits.max_concurrent_uploads',
    MAX_ANALYTICS_QUERY_TIME: 'limits.max_analytics_query_time',
    MAX_CACHE_SIZE: 'limits.max_cache_size'
  },
  
  // API configuration
  API: {
    SMARTFILL_TIMEOUT: 'api.smartfill_timeout',
    AGBOT_TIMEOUT: 'api.agbot_timeout',
    RETRY_ATTEMPTS: 'api.retry_attempts',
    CACHE_TTL: 'api.cache_ttl',
    RATE_LIMIT_WINDOW: 'api.rate_limit_window'
  },
  
  // UI configuration
  UI: {
    DASHBOARD_REFRESH_INTERVAL: 'ui.dashboard_refresh_interval',
    NOTIFICATION_TIMEOUT: 'ui.notification_timeout',
    TABLE_PAGE_SIZE: 'ui.table_page_size',
    MAP_UPDATE_INTERVAL: 'ui.map_update_interval',
    THEME_CONFIG: 'ui.theme_config'
  },
  
  // Alert thresholds
  ALERTS: {
    LOW_FUEL_THRESHOLD: 'alerts.low_fuel_threshold',
    HIGH_CONSUMPTION_THRESHOLD: 'alerts.high_consumption_threshold',
    API_ERROR_THRESHOLD: 'alerts.api_error_threshold',
    SYSTEM_HEALTH_THRESHOLD: 'alerts.system_health_threshold'
  },
  
  // Maintenance mode
  MAINTENANCE: {
    ENABLED: 'maintenance.enabled',
    MESSAGE: 'maintenance.message',
    SCHEDULED_START: 'maintenance.scheduled_start',
    SCHEDULED_END: 'maintenance.scheduled_end',
    AFFECTED_FEATURES: 'maintenance.affected_features'
  }
} as const;

// Default configuration values
export const DEFAULT_CONFIG = {
  // Feature flags (all enabled by default)
  [CONFIG_KEYS.FEATURES.SMARTFILL_CACHING]: true,
  [CONFIG_KEYS.FEATURES.AGBOT_CACHING]: true,
  [CONFIG_KEYS.FEATURES.CSV_SERVERLESS]: true,
  [CONFIG_KEYS.FEATURES.ANALYTICS_WAREHOUSE]: true,
  [CONFIG_KEYS.FEATURES.RATE_LIMITING]: true,
  [CONFIG_KEYS.FEATURES.WEBHOOK_PROCESSING]: true,
  [CONFIG_KEYS.FEATURES.ADVANCED_ANALYTICS]: true,
  [CONFIG_KEYS.FEATURES.MOBILE_OPTIMIZATION]: false,
  
  // System limits
  [CONFIG_KEYS.LIMITS.MAX_FILE_SIZE]: 500 * 1024 * 1024, // 500MB
  [CONFIG_KEYS.LIMITS.MAX_API_CALLS_PER_HOUR]: 1000,
  [CONFIG_KEYS.LIMITS.MAX_CONCURRENT_UPLOADS]: 5,
  [CONFIG_KEYS.LIMITS.MAX_ANALYTICS_QUERY_TIME]: 30000, // 30 seconds
  [CONFIG_KEYS.LIMITS.MAX_CACHE_SIZE]: 1000,
  
  // API configuration
  [CONFIG_KEYS.API.SMARTFILL_TIMEOUT]: 30000, // 30 seconds
  [CONFIG_KEYS.API.AGBOT_TIMEOUT]: 30000, // 30 seconds
  [CONFIG_KEYS.API.RETRY_ATTEMPTS]: 3,
  [CONFIG_KEYS.API.CACHE_TTL]: 300, // 5 minutes
  [CONFIG_KEYS.API.RATE_LIMIT_WINDOW]: 3600, // 1 hour
  
  // UI configuration
  [CONFIG_KEYS.UI.DASHBOARD_REFRESH_INTERVAL]: 300000, // 5 minutes
  [CONFIG_KEYS.UI.NOTIFICATION_TIMEOUT]: 5000, // 5 seconds
  [CONFIG_KEYS.UI.TABLE_PAGE_SIZE]: 50,
  [CONFIG_KEYS.UI.MAP_UPDATE_INTERVAL]: 60000, // 1 minute
  [CONFIG_KEYS.UI.THEME_CONFIG]: {
    defaultTheme: 'light',
    allowUserToggle: true,
    systemThemeDetection: true
  },
  
  // Alert thresholds
  [CONFIG_KEYS.ALERTS.LOW_FUEL_THRESHOLD]: 20, // 20%
  [CONFIG_KEYS.ALERTS.HIGH_CONSUMPTION_THRESHOLD]: 150, // 150% of normal
  [CONFIG_KEYS.ALERTS.API_ERROR_THRESHOLD]: 5, // 5 consecutive errors
  [CONFIG_KEYS.ALERTS.SYSTEM_HEALTH_THRESHOLD]: 85, // 85% health score
  
  // Maintenance mode
  [CONFIG_KEYS.MAINTENANCE.ENABLED]: false,
  [CONFIG_KEYS.MAINTENANCE.MESSAGE]: 'System maintenance in progress. Please try again later.',
  [CONFIG_KEYS.MAINTENANCE.SCHEDULED_START]: null,
  [CONFIG_KEYS.MAINTENANCE.SCHEDULED_END]: null,
  [CONFIG_KEYS.MAINTENANCE.AFFECTED_FEATURES]: []
} as const;

/**
 * Get a configuration value from Edge Config or fallback to default
 */
export async function getConfig<T = any>(key: string, fallback?: T): Promise<T> {
  const config = await getEdgeConfig();
  
  if (!config) {
    // If Edge Config is not available, use defaults
    const defaultValue = DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG] as T;
    return fallback !== undefined ? fallback : defaultValue;
  }

  try {
    const value = await config.get(key);
    
    if (value !== undefined) {
      return value as T;
    }
    
    // Fallback to default if key doesn't exist
    const defaultValue = DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG] as T;
    return fallback !== undefined ? fallback : defaultValue;
    
  } catch (error) {
    console.warn(`[EDGE_CONFIG] Failed to get config for key: ${key}`, error);
    const defaultValue = DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG] as T;
    return fallback !== undefined ? fallback : defaultValue;
  }
}

/**
 * Get multiple configuration values at once
 */
export async function getMultipleConfig(keys: string[]): Promise<Record<string, any>> {
  const config = await getEdgeConfig();
  
  if (!config) {
    // Return defaults for all keys
    const result: Record<string, any> = {};
    keys.forEach(key => {
      result[key] = DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG];
    });
    return result;
  }

  try {
    const allConfig = await config.getAll();
    const result: Record<string, any> = {};
    
    keys.forEach(key => {
      if (allConfig && key in allConfig) {
        result[key] = allConfig[key];
      } else {
        result[key] = DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG];
      }
    });
    
    return result;
  } catch (error) {
    console.warn('[EDGE_CONFIG] Failed to get multiple configs', error);
    // Return defaults
    const result: Record<string, any> = {};
    keys.forEach(key => {
      result[key] = DEFAULT_CONFIG[key as keyof typeof DEFAULT_CONFIG];
    });
    return result;
  }
}

/**
 * Check if a feature flag is enabled
 */
export async function isFeatureEnabled(featureKey: string): Promise<boolean> {
  return await getConfig<boolean>(featureKey, false);
}

/**
 * Get all feature flags
 */
export async function getFeatureFlags(): Promise<Record<string, boolean>> {
  const featureKeys = Object.values(CONFIG_KEYS.FEATURES);
  const flags = await getMultipleConfig(featureKeys);
  return flags;
}

/**
 * Get system limits configuration
 */
export async function getSystemLimits(): Promise<{
  maxFileSize: number;
  maxApiCallsPerHour: number;
  maxConcurrentUploads: number;
  maxAnalyticsQueryTime: number;
  maxCacheSize: number;
}> {
  const limits = await getMultipleConfig(Object.values(CONFIG_KEYS.LIMITS));
  
  return {
    maxFileSize: limits[CONFIG_KEYS.LIMITS.MAX_FILE_SIZE],
    maxApiCallsPerHour: limits[CONFIG_KEYS.LIMITS.MAX_API_CALLS_PER_HOUR],
    maxConcurrentUploads: limits[CONFIG_KEYS.LIMITS.MAX_CONCURRENT_UPLOADS],
    maxAnalyticsQueryTime: limits[CONFIG_KEYS.LIMITS.MAX_ANALYTICS_QUERY_TIME],
    maxCacheSize: limits[CONFIG_KEYS.LIMITS.MAX_CACHE_SIZE]
  };
}

/**
 * Get API configuration
 */
export async function getAPIConfig(): Promise<{
  smartfillTimeout: number;
  agbotTimeout: number;
  retryAttempts: number;
  cacheTTL: number;
  rateLimitWindow: number;
}> {
  const apiConfig = await getMultipleConfig(Object.values(CONFIG_KEYS.API));
  
  return {
    smartfillTimeout: apiConfig[CONFIG_KEYS.API.SMARTFILL_TIMEOUT],
    agbotTimeout: apiConfig[CONFIG_KEYS.API.AGBOT_TIMEOUT],
    retryAttempts: apiConfig[CONFIG_KEYS.API.RETRY_ATTEMPTS],
    cacheTTL: apiConfig[CONFIG_KEYS.API.CACHE_TTL],
    rateLimitWindow: apiConfig[CONFIG_KEYS.API.RATE_LIMIT_WINDOW]
  };
}

/**
 * Get UI configuration
 */
export async function getUIConfig(): Promise<{
  dashboardRefreshInterval: number;
  notificationTimeout: number;
  tablePageSize: number;
  mapUpdateInterval: number;
  themeConfig: any;
}> {
  const uiConfig = await getMultipleConfig(Object.values(CONFIG_KEYS.UI));
  
  return {
    dashboardRefreshInterval: uiConfig[CONFIG_KEYS.UI.DASHBOARD_REFRESH_INTERVAL],
    notificationTimeout: uiConfig[CONFIG_KEYS.UI.NOTIFICATION_TIMEOUT],
    tablePageSize: uiConfig[CONFIG_KEYS.UI.TABLE_PAGE_SIZE],
    mapUpdateInterval: uiConfig[CONFIG_KEYS.UI.MAP_UPDATE_INTERVAL],
    themeConfig: uiConfig[CONFIG_KEYS.UI.THEME_CONFIG]
  };
}

/**
 * Get alert thresholds
 */
export async function getAlertThresholds(): Promise<{
  lowFuelThreshold: number;
  highConsumptionThreshold: number;
  apiErrorThreshold: number;
  systemHealthThreshold: number;
}> {
  const alertConfig = await getMultipleConfig(Object.values(CONFIG_KEYS.ALERTS));
  
  return {
    lowFuelThreshold: alertConfig[CONFIG_KEYS.ALERTS.LOW_FUEL_THRESHOLD],
    highConsumptionThreshold: alertConfig[CONFIG_KEYS.ALERTS.HIGH_CONSUMPTION_THRESHOLD],
    apiErrorThreshold: alertConfig[CONFIG_KEYS.ALERTS.API_ERROR_THRESHOLD],
    systemHealthThreshold: alertConfig[CONFIG_KEYS.ALERTS.SYSTEM_HEALTH_THRESHOLD]
  };
}

/**
 * Check if system is in maintenance mode
 */
export async function isMaintenanceMode(): Promise<{
  enabled: boolean;
  message?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  affectedFeatures?: string[];
}> {
  const maintenanceConfig = await getMultipleConfig(Object.values(CONFIG_KEYS.MAINTENANCE));
  
  return {
    enabled: maintenanceConfig[CONFIG_KEYS.MAINTENANCE.ENABLED],
    message: maintenanceConfig[CONFIG_KEYS.MAINTENANCE.MESSAGE],
    scheduledStart: maintenanceConfig[CONFIG_KEYS.MAINTENANCE.SCHEDULED_START],
    scheduledEnd: maintenanceConfig[CONFIG_KEYS.MAINTENANCE.SCHEDULED_END],
    affectedFeatures: maintenanceConfig[CONFIG_KEYS.MAINTENANCE.AFFECTED_FEATURES]
  };
}

/**
 * Check if Edge Config is available
 */
export async function checkEdgeConfigHealth(): Promise<{
  available: boolean;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();
  const config = await getEdgeConfig();
  
  if (!config) {
    return {
      available: false,
      error: 'Edge Config client not available'
    };
  }

  try {
    // Test with a simple config read
    await config.has(CONFIG_KEYS.FEATURES.SMARTFILL_CACHING);
    const latency = Date.now() - startTime;
    
    return {
      available: true,
      latency
    };
  } catch (error) {
    return {
      available: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get all configuration for debugging/admin purposes
 */
export async function getAllConfig(): Promise<{
  features: Record<string, boolean>;
  limits: Record<string, number>;
  api: Record<string, any>;
  ui: Record<string, any>;
  alerts: Record<string, number>;
  maintenance: Record<string, any>;
  health: {
    available: boolean;
    latency?: number;
    error?: string;
  };
}> {
  const [features, limits, api, ui, alerts, maintenance, health] = await Promise.all([
    getFeatureFlags(),
    getSystemLimits(),
    getAPIConfig(),
    getUIConfig(),
    getAlertThresholds(),
    isMaintenanceMode(),
    checkEdgeConfigHealth()
  ]);

  return {
    features,
    limits: limits as Record<string, number>,
    api,
    ui,
    alerts: alerts as Record<string, number>,
    maintenance,
    health
  };
}

/**
 * Utility function to conditionally execute code based on feature flags
 */
export async function withFeatureFlag<T>(
  featureKey: string,
  enabledCallback: () => T | Promise<T>,
  disabledCallback?: () => T | Promise<T>
): Promise<T | null> {
  const isEnabled = await isFeatureEnabled(featureKey);
  
  if (isEnabled) {
    return await enabledCallback();
  } else if (disabledCallback) {
    return await disabledCallback();
  }
  
  return null;
}