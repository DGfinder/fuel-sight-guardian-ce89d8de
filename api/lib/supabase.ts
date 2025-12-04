/**
 * Server-Side Supabase Client - Feature Flag Wrapper
 *
 * Conditionally exports either:
 * - Tenant-aware client (with createTenantClient helper) when VITE_USE_TENANT_SCHEMA=true
 * - Legacy client (public schema only) when VITE_USE_TENANT_SCHEMA=false
 *
 * API routes should use createTenantClient() for automatic tenant routing.
 *
 * Usage:
 *   import { createTenantClient } from './lib/supabase';
 *
 *   const { client, tenant } = await createTenantClient(authToken);
 *   const { data } = await client.from('ta_tanks').select('*');
 */

const USE_TENANT_SCHEMA = process.env.VITE_USE_TENANT_SCHEMA === 'true';

// Import both implementations
import {
  supabase as tenantSupabase,
  getSupabaseClient as getTenantClient,
  markTankServiced as markTankServicedTenant,
  unmarkTankServiced as unmarkTankServicedTenant,
  createTenantClient as createTenantClientImpl,
  createTenantClientFromRequest as createTenantClientFromRequestImpl,
} from './supabase-tenant';

import {
  supabase as legacySupabase,
  getSupabaseClient as getLegacyClient,
  markTankServiced as markTankServicedLegacy,
  unmarkTankServiced as unmarkTankServicedLegacy,
} from './supabase-legacy';

// Export based on feature flag (ternary operator - valid ES module syntax)
export const supabase = USE_TENANT_SCHEMA ? tenantSupabase : legacySupabase;
export const getSupabaseClient = USE_TENANT_SCHEMA ? getTenantClient : getLegacyClient;
export const markTankServiced = USE_TENANT_SCHEMA ? markTankServicedTenant : markTankServicedLegacy;
export const unmarkTankServiced = USE_TENANT_SCHEMA ? unmarkTankServicedTenant : unmarkTankServicedLegacy;

// Tenant client functions (use real implementation if enabled, stub if disabled)
export const createTenantClient = USE_TENANT_SCHEMA
  ? createTenantClientImpl
  : async (authToken?: string) => {
      return {
        client: legacySupabase,
        tenant: null,
        userId: null,
      };
    };

export const createTenantClientFromRequest = USE_TENANT_SCHEMA
  ? createTenantClientFromRequestImpl
  : async (req: any) => {
      return {
        client: legacySupabase,
        tenant: null,
        userId: null,
      };
    };

// Log which mode is active
if (USE_TENANT_SCHEMA) {
  console.log('✅ API Multi-tenant mode ENABLED - Using tenant-aware client');
} else {
  console.log('ℹ️ API Legacy mode - Using standard Supabase client');
}