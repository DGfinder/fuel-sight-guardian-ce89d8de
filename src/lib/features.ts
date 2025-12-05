/**
 * Feature Flags for Fuel Sight Guardian
 *
 * Controls gradual rollout of multi-tenant architecture
 */

export const FEATURES = {
  /**
   * USE_TENANT_SCHEMA - Enable schema-per-tenant architecture
   *
   * When true:
   * - Queries automatically route to tenant schemas via search_path
   * - User's default tenant determined on authentication
   * - Unqualified table names resolve to tenant schema (e.g., great_southern_fuels.ta_tanks)
   *
   * When false (legacy mode):
   * - All queries use public schema
   * - Original behavior maintained
   *
   * Rollout plan:
   * - Week 1: false (default, legacy mode)
   * - Week 2-6: Development and testing with true
   * - Week 7: 10% of users (canary)
   * - Week 8: 50% of users
   * - Week 9: 100% of users (full cutover)
   */
  USE_TENANT_SCHEMA: import.meta.env.VITE_USE_TENANT_SCHEMA === 'true',

  /**
   * DEBUG_TENANT_ROUTING - Enable verbose tenant routing logs
   *
   * Logs tenant detection, schema selection, and search_path changes
   * Useful for debugging tenant isolation issues
   */
  DEBUG_TENANT_ROUTING: import.meta.env.VITE_DEBUG_TENANT_ROUTING === 'true',

  /**
   * TENANT_INIT_TIMEOUT_MS - Timeout for tenant initialization
   *
   * How long to wait for tenant context initialization before showing error.
   * Default: 10000ms (10 seconds)
   *
   * Can be configured via VITE_TENANT_INIT_TIMEOUT_MS environment variable.
   * Increase for slow networks, decrease for faster debugging.
   */
  TENANT_INIT_TIMEOUT_MS: parseInt(
    import.meta.env.VITE_TENANT_INIT_TIMEOUT_MS || '10000',
    10
  ),
} as const;

/**
 * Get feature flag value
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature];
}

/**
 * Log tenant routing debug information
 */
export function debugTenantRouting(message: string, data?: any) {
  if (FEATURES.DEBUG_TENANT_ROUTING) {
    console.log(`[Tenant Routing] ${message}`, data || '');
  }
}
