/**
 * System Configuration Helper
 * Provides typed access to runtime configuration stored in database
 * Part of Phase 2: Configuration System
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/supabase.js';

// Configuration value types
export type ConfigValue = string | number | boolean | object;

// Configuration categories
export type ConfigCategory = 'email' | 'alerts' | 'branding' | 'performance' | 'features';

// Configuration data types
export type ConfigDataType = 'string' | 'number' | 'boolean' | 'json';

// Configuration item interface
export interface ConfigItem {
  key: string;
  value: string;
  data_type: ConfigDataType;
  category: ConfigCategory;
  description: string | null;
  is_secret: boolean;
  updated_at: string;
  created_at: string;
}

// In-memory cache for config values (60-second TTL)
const configCache = new Map<string, { value: ConfigValue; expiresAt: number }>();
const CACHE_TTL_MS = 60000; // 60 seconds

/**
 * Get a configuration value from database with type conversion
 * Supports caching to reduce database queries
 */
export async function getConfig<T extends ConfigValue>(
  supabase: SupabaseClient<Database>,
  key: string,
  defaultValue?: T
): Promise<T> {
  // Check cache first
  const cached = configCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('value, data_type')
      .eq('key', key)
      .single();

    if (error || !data) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Config key "${key}" not found and no default provided`);
    }

    // Convert value based on data type
    const converted = convertConfigValue(data.value, data.data_type);

    // Cache the result
    configCache.set(key, {
      value: converted,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    return converted as T;
  } catch (error) {
    console.error(`[CONFIG] Error fetching config key "${key}":`, error);
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw error;
  }
}

/**
 * Get multiple configuration values at once
 * More efficient than calling getConfig multiple times
 */
export async function getConfigBatch(
  supabase: SupabaseClient<Database>,
  keys: string[]
): Promise<Record<string, ConfigValue>> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('key, value, data_type')
      .in('key', keys);

    if (error) {
      throw new Error(`Failed to fetch config batch: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {};
    }

    const result: Record<string, ConfigValue> = {};
    for (const item of data) {
      const converted = convertConfigValue(item.value, item.data_type);
      result[item.key] = converted;

      // Cache each value
      configCache.set(item.key, {
        value: converted,
        expiresAt: Date.now() + CACHE_TTL_MS
      });
    }

    return result;
  } catch (error) {
    console.error('[CONFIG] Error fetching config batch:', error);
    return {};
  }
}

/**
 * Get all configuration values for a specific category
 */
export async function getConfigByCategory(
  supabase: SupabaseClient<Database>,
  category: ConfigCategory
): Promise<Record<string, ConfigValue>> {
  try {
    const { data, error } = await supabase
      .from('system_config')
      .select('key, value, data_type')
      .eq('category', category);

    if (error) {
      throw new Error(`Failed to fetch config for category "${category}": ${error.message}`);
    }

    if (!data || data.length === 0) {
      return {};
    }

    const result: Record<string, ConfigValue> = {};
    for (const item of data) {
      result[item.key] = convertConfigValue(item.value, item.data_type);
    }

    return result;
  } catch (error) {
    console.error(`[CONFIG] Error fetching config for category "${category}":`, error);
    return {};
  }
}

/**
 * Update a configuration value
 * Only admins should call this (enforced by RLS)
 */
export async function setConfig(
  supabase: SupabaseClient<Database>,
  key: string,
  value: ConfigValue,
  updatedBy?: string
): Promise<boolean> {
  try {
    // Convert value to string for storage
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    const updateData: any = {
      value: stringValue,
      updated_at: new Date().toISOString()
    };

    if (updatedBy) {
      updateData.updated_by = updatedBy;
    }

    const { error } = await supabase
      .from('system_config')
      .update(updateData)
      .eq('key', key);

    if (error) {
      throw new Error(`Failed to update config "${key}": ${error.message}`);
    }

    // Clear cache for this key
    configCache.delete(key);

    console.log(`[CONFIG] Updated config key "${key}" to "${stringValue}"`);
    return true;
  } catch (error) {
    console.error(`[CONFIG] Error updating config key "${key}":`, error);
    return false;
  }
}

/**
 * Clear the configuration cache
 * Useful after bulk updates or for testing
 */
export function clearConfigCache(): void {
  configCache.clear();
  console.log('[CONFIG] Cache cleared');
}

/**
 * Convert string value from database to appropriate type
 */
function convertConfigValue(value: string, dataType: string): ConfigValue {
  switch (dataType) {
    case 'number':
      return Number(value);
    case 'boolean':
      return value === 'true';
    case 'json':
      try {
        return JSON.parse(value);
      } catch {
        console.warn(`[CONFIG] Failed to parse JSON value: ${value}`);
        return value;
      }
    case 'string':
    default:
      return value;
  }
}

/**
 * Helper functions for common config access patterns
 */

// Email configuration
export async function getEmailConfig(supabase: SupabaseClient<Database>) {
  const config = await getConfigByCategory(supabase, 'email');
  return {
    batchSize: (config['email.batch_size'] as number) || 50,
    batchDelayMs: (config['email.batch_delay_ms'] as number) || 2000,
    useEnhancedTemplate: (config['email.use_enhanced_template'] as boolean) ?? true,
    fromEmail: (config['email.from_email'] as string) || 'alert@tankalert.greatsouthernfuels.com.au',
    fromName: (config['email.from_name'] as string) || 'Tank Alert',
    replyTo: (config['email.reply_to'] as string) || 'hayden@stevemacs.com.au',
    supportEmail: (config['email.support_email'] as string) || 'support@greatsouthernfuel.com.au',
    retryMaxAttempts: (config['email.retry_max_attempts'] as number) || 3,
    retryBaseDelayMs: (config['email.retry_base_delay_ms'] as number) || 1000
  };
}

// Alert thresholds
export async function getAlertThresholds(supabase: SupabaseClient<Database>) {
  const config = await getConfigByCategory(supabase, 'alerts');
  return {
    lowFuelPct: (config['thresholds.low_fuel_pct'] as number) || 30,
    criticalPct: (config['thresholds.critical_pct'] as number) || 15,
    daysRemainingCritical: (config['thresholds.days_remaining_critical'] as number) || 3
  };
}

// Branding configuration
export async function getBrandingConfig(supabase: SupabaseClient<Database>) {
  const config = await getConfigByCategory(supabase, 'branding');
  return {
    logoUrl: (config['branding.logo_url'] as string) || 'https://www.greatsouthernfuels.com.au/wp-content/uploads/2024/08/9d8131_1317ed20e5274adc9fd15fe2196d2cb8mv2.webp',
    primaryColor: (config['branding.primary_color'] as string) || '#059669',
    companyName: (config['branding.company_name'] as string) || 'Great Southern Fuel Supplies'
  };
}

// Feature flags
export async function getFeatureFlags(supabase: SupabaseClient<Database>) {
  const config = await getConfigByCategory(supabase, 'features');
  return {
    enableAnalytics: (config['features.enable_analytics'] as boolean) ?? true,
    enableCharts: (config['features.enable_charts'] as boolean) ?? true,
    enableWeeklyReports: (config['features.enable_weekly_reports'] as boolean) ?? true,
    enableMonthlyReports: (config['features.enable_monthly_reports'] as boolean) ?? true
  };
}

// Performance settings
export async function getPerformanceConfig(supabase: SupabaseClient<Database>) {
  const config = await getConfigByCategory(supabase, 'performance');
  return {
    maxLocationsPerEmail: (config['performance.max_locations_per_email'] as number) || 100,
    analyticsCacheTtlMinutes: (config['performance.analytics_cache_ttl_minutes'] as number) || 60
  };
}
