/**
 * Supabase Client - Feature Flag Wrapper
 *
 * Conditionally exports either:
 * - Tenant-aware client (schema-per-tenant) when VITE_USE_TENANT_SCHEMA=true
 * - Legacy client (public schema only) when VITE_USE_TENANT_SCHEMA=false
 *
 * This allows gradual rollout and instant rollback capability.
 *
 * Usage remains unchanged throughout the codebase:
 *   import { supabase } from '@/lib/supabase';
 *   const { data } = await supabase.from('ta_tanks').select('*');
 */

import { FEATURES } from './features';

// Import both implementations
import {
  supabase as tenantSupabase,
  getSupabaseClient as getTenantClient,
  markTankServiced as markTankServicedTenant,
  unmarkTankServiced as unmarkTankServicedTenant,
} from './supabase-tenant';

import {
  supabase as legacySupabase,
  getSupabaseClient as getLegacyClient,
  markTankServiced as markTankServicedLegacy,
  unmarkTankServiced as unmarkTankServicedLegacy,
} from './supabase-legacy';

// Export based on feature flag (ternary operator - valid ES module syntax)
export const supabase = FEATURES.USE_TENANT_SCHEMA ? tenantSupabase : legacySupabase;
export const getSupabaseClient = FEATURES.USE_TENANT_SCHEMA ? getTenantClient : getLegacyClient;
export const markTankServiced = FEATURES.USE_TENANT_SCHEMA ? markTankServicedTenant : markTankServicedLegacy;
export const unmarkTankServiced = FEATURES.USE_TENANT_SCHEMA ? unmarkTankServicedTenant : unmarkTankServicedLegacy;

// Log which mode is active
if (FEATURES.USE_TENANT_SCHEMA) {
  console.log('✅ Multi-tenant mode ENABLED - Using tenant-aware client');
} else {
  console.log('ℹ️ Legacy mode - Using standard Supabase client');
}