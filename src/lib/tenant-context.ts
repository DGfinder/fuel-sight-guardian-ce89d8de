/**
 * Tenant Context Management
 *
 * Provides utilities for tenant detection, schema resolution, and context management
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { debugTenantRouting } from './features';

export interface TenantContext {
  tenantId: string;
  tenantKey: string;
  schemaName: string;
  companyName: string;
  userRole: string;
  isActive: boolean;
}

/**
 * Get authenticated user's tenant context
 *
 * Returns tenant information including schema name, role, and company details
 */
export async function getUserTenantContext(
  client: SupabaseClient
): Promise<TenantContext | null> {
  try {
    const { data: { user }, error: authError } = await client.auth.getUser();

    if (authError || !user) {
      debugTenantRouting('No authenticated user found');
      return null;
    }

    debugTenantRouting('Fetching tenant context for user', user.id);

    // Call the database function we created in Phase 1
    const { data, error } = await client
      .rpc('get_user_tenant_context')
      .single();

    if (error) {
      console.error('Failed to fetch tenant context:', error);
      return null;
    }

    if (!data) {
      debugTenantRouting('No default tenant assigned to user');
      return null;
    }

    const context: TenantContext = {
      tenantId: data.tenant_id,
      tenantKey: data.tenant_key,
      schemaName: data.schema_name,
      companyName: data.company_name,
      userRole: data.user_role,
      isActive: data.is_active,
    };

    debugTenantRouting('Tenant context resolved', context);

    return context;
  } catch (err) {
    console.error('Error getting tenant context:', err);
    return null;
  }
}

/**
 * Set PostgreSQL search_path for current session
 *
 * This is the KEY function that enables schema-per-tenant routing.
 * After calling this, all unqualified queries automatically resolve to tenant schema.
 */
export async function setTenantSearchPath(
  client: SupabaseClient,
  schemaName: string
): Promise<boolean> {
  try {
    debugTenantRouting('Setting search_path to', schemaName);

    const { error } = await client.rpc('set_tenant_search_path', {
      tenant_schema: schemaName,
    });

    if (error) {
      console.error('Failed to set search_path:', error);
      return false;
    }

    debugTenantRouting('Search path set successfully', `${schemaName}, public`);
    return true;
  } catch (err) {
    console.error('Error setting search_path:', err);
    return false;
  }
}

/**
 * List all tenants user has access to
 *
 * Useful for tenant switching UI
 */
export async function listUserTenants(client: SupabaseClient) {
  try {
    const { data, error } = await client.rpc('list_user_tenants');

    if (error) {
      console.error('Failed to list user tenants:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Error listing tenants:', err);
    return [];
  }
}

/**
 * Switch user's default tenant
 *
 * Changes which tenant is used by default on next login
 */
export async function switchDefaultTenant(
  client: SupabaseClient,
  tenantId: string
): Promise<boolean> {
  try {
    debugTenantRouting('Switching default tenant to', tenantId);

    const { data, error } = await client.rpc('switch_default_tenant', {
      new_tenant_id: tenantId,
    });

    if (error) {
      console.error('Failed to switch tenant:', error);
      return false;
    }

    debugTenantRouting('Default tenant switched successfully');
    return true;
  } catch (err) {
    console.error('Error switching tenant:', err);
    return false;
  }
}

/**
 * Validate that schema name is safe to use
 *
 * Prevents SQL injection in schema names
 */
export function isValidSchemaName(schemaName: string): boolean {
  return /^[a-z0-9_]+$/.test(schemaName);
}
