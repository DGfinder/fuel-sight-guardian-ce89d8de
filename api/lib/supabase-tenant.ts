/**
 * Tenant-Aware Supabase Client (Server-Side / API Routes)
 *
 * Automatically routes queries to the correct tenant schema using PostgreSQL search_path.
 *
 * Usage:
 *   import { createTenantClient } from './lib/supabase-tenant';
 *
 *   export default async function handler(req, res) {
 *     const authToken = req.headers.authorization?.replace('Bearer ', '');
 *     const { client, tenant } = await createTenantClient(authToken);
 *
 *     // Use normally - queries automatically route to tenant schema
 *     const { data } = await client.from('ta_tanks').select('*');
 *   }
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface TenantContext {
  tenantId: string;
  tenantKey: string;
  schemaName: string;
  companyName: string;
  userRole: string;
  isActive: boolean;
}

export interface TenantClientResult {
  client: SupabaseClient;
  tenant: TenantContext | null;
  userId: string | null;
}

const DEBUG = process.env.VITE_DEBUG_TENANT_ROUTING === 'true';

function debugLog(message: string, data?: any) {
  if (DEBUG) {
    console.log(`[API Tenant Routing] ${message}`, data || '');
  }
}

/**
 * Create tenant-aware Supabase client for API routes
 *
 * @param authToken - JWT token from Authorization header
 * @returns Supabase client with search_path set to user's tenant schema
 */
export async function createTenantClient(
  authToken?: string
): Promise<TenantClientResult> {
  // Use backend-only environment variables (never use VITE_ variables in backend code)
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables (SUPABASE_URL and SUPABASE_ANON_KEY)');
  }

  // Create client with auth token if provided
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-application-name': 'fuel-sight-guardian-api',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    },
  });

  // If no auth token, return client without tenant context
  if (!authToken) {
    debugLog('No auth token provided - returning client without tenant context');
    return { client, tenant: null, userId: null };
  }

  try {
    // Get authenticated user
    const { data: { user }, error: authError } = await client.auth.getUser();

    if (authError || !user) {
      debugLog('Authentication failed or no user found');
      return { client, tenant: null, userId: null };
    }

    debugLog('Fetching tenant context for user', user.id);

    // Get tenant context using database function
    const { data: tenantData, error: tenantError } = await client
      .rpc('get_user_tenant_context')
      .single();

    if (tenantError || !tenantData) {
      debugLog('No tenant context found for user');
      return { client, tenant: null, userId: user.id };
    }

    const tenant: TenantContext = {
      tenantId: tenantData.tenant_id,
      tenantKey: tenantData.tenant_key,
      schemaName: tenantData.schema_name,
      companyName: tenantData.company_name,
      userRole: tenantData.user_role,
      isActive: tenantData.is_active,
    };

    if (!tenant.isActive) {
      console.warn(`Tenant ${tenant.companyName} is not active`);
      return { client, tenant, userId: user.id };
    }

    // Set search_path for this session
    debugLog('Setting search_path to', tenant.schemaName);

    const { error: searchPathError } = await client.rpc('set_tenant_search_path', {
      tenant_schema: tenant.schemaName,
    });

    if (searchPathError) {
      console.error('Failed to set search_path:', searchPathError);
      // Continue anyway - client will use public schema
    } else {
      debugLog('Search path set successfully', `${tenant.schemaName}, public`);
    }

    return { client, tenant, userId: user.id };
  } catch (err) {
    console.error('Error creating tenant client:', err);
    return { client, tenant: null, userId: null };
  }
}

/**
 * Create tenant client from request object
 *
 * Convenience wrapper for Next.js/Express request handlers
 */
export async function createTenantClientFromRequest(
  req: { headers: { authorization?: string } }
): Promise<TenantClientResult> {
  const authToken = req.headers.authorization?.replace('Bearer ', '');
  return createTenantClient(authToken);
}

/**
 * Legacy server-side client (for backwards compatibility)
 *
 * Use createTenantClient() for new code
 */
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'x-application-name': 'fuel-sight-guardian-api',
      },
    },
  }
);

// Export helper to get client instance (maintaining existing API)
export const getSupabaseClient = () => supabase;

// Helper functions for tank servicing (maintaining existing API)
export const markTankServiced = async (tankId: string, userId: string) => {
  return supabase
    .from('fuel_tanks')
    .update({
      serviced_on: new Date().toISOString().slice(0, 10),
      serviced_by: userId,
    })
    .eq('id', tankId);
};

export const unmarkTankServiced = async (tankId: string) => {
  return supabase
    .from('fuel_tanks')
    .update({
      serviced_on: null,
      serviced_by: null,
    })
    .eq('id', tankId);
};
