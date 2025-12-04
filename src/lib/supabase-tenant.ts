/**
 * Tenant-Aware Supabase Client (Client-Side)
 *
 * Automatically routes queries to the correct tenant schema using PostgreSQL search_path.
 * This enables schema-per-tenant without modifying existing queries.
 *
 * Usage:
 *   import { supabase } from '@/lib/supabase-tenant';
 *
 *   // Initialize tenant context on app start
 *   await supabase.initialize();
 *
 *   // Use normally - queries automatically route to tenant schema
 *   const { data } = await supabase.from('ta_tanks').select('*');
 *   // ^ Resolves to great_southern_fuels.ta_tanks automatically!
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';
import {
  getUserTenantContext,
  setTenantSearchPath,
  TenantContext,
} from './tenant-context';
import { debugTenantRouting } from './features';

class TenantSupabaseClient {
  private client: SupabaseClient<Database>;
  private tenantContext: TenantContext | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase environment variables');
    }

    this.client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 5,
        },
      },
      global: {
        headers: {
          'x-application-name': 'fuel-sight-guardian',
        },
      },
      // Note: Not setting db.schema here allows .schema() calls to work properly
    });

    debugTenantRouting('Tenant-aware Supabase client created');
  }

  /**
   * Initialize tenant context and set search_path
   *
   * MUST be called after user authentication before making any queries
   * Typically called in App.tsx or authentication callback
   */
  async initialize(): Promise<void> {
    // Return existing promise if initialization already in progress
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already initialized
    if (this.initialized) {
      return;
    }

    // Create initialization promise
    this.initPromise = (async () => {
      try {
        debugTenantRouting('Initializing tenant context...');

        // Get user's tenant context
        const context = await getUserTenantContext(this.client);

        if (!context) {
          debugTenantRouting('No tenant context found - user may not be assigned to tenant');
          this.initialized = true;
          return;
        }

        if (!context.isActive) {
          console.warn(`Tenant ${context.companyName} is not active`);
          this.initialized = true;
          return;
        }

        // Store tenant context
        this.tenantContext = context;

        // Set PostgreSQL search_path for this session
        const success = await setTenantSearchPath(this.client, context.schemaName);

        if (success) {
          debugTenantRouting('Tenant routing initialized', {
            tenant: context.companyName,
            schema: context.schemaName,
            role: context.userRole,
          });
        } else {
          console.error('Failed to set search_path - queries may hit wrong schema');
        }

        this.initialized = true;
      } catch (err) {
        console.error('Error initializing tenant context:', err);
        this.initialized = true; // Mark as initialized even on error to prevent retries
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  /**
   * Re-initialize tenant context
   *
   * Call this after user switches tenants or logs in
   */
  async reinitialize(): Promise<void> {
    this.initialized = false;
    this.tenantContext = null;
    await this.initialize();
  }

  /**
   * Get current tenant context
   */
  getTenantContext(): TenantContext | null {
    return this.tenantContext;
  }

  /**
   * Check if tenant context is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // ========================================================================
  // Proxy Methods - Forward to underlying Supabase client
  // ========================================================================

  /**
   * Specify schema for query
   *
   * Allows explicit schema specification (e.g., for great_southern_fuels)
   * This is needed for AgBot queries that explicitly use .schema()
   */
  schema(schema: string) {
    return this.client.schema(schema);
  }

  /**
   * Query builder for tables
   *
   * Automatically resolves to tenant schema via search_path
   */
  from<T extends keyof Database['public']['Tables']>(
    table: T
  ) {
    return this.client.from(table);
  }

  /**
   * Call Remote Procedure (RPC) functions
   */
  rpc<T extends keyof Database['public']['Functions']>(
    fn: T,
    params?: Database['public']['Functions'][T]['Args']
  ) {
    return this.client.rpc(fn, params);
  }

  /**
   * Storage API
   */
  get storage() {
    return this.client.storage;
  }

  /**
   * Authentication API
   */
  get auth() {
    return this.client.auth;
  }

  /**
   * Realtime API
   */
  get realtime() {
    return this.client.realtime;
  }

  /**
   * Realtime channel subscriptions
   */
  channel(name: string, opts?: any) {
    return this.client.channel(name, opts);
  }

  /**
   * Remove Realtime channel
   */
  removeChannel(channel: any) {
    return this.client.removeChannel(channel);
  }

  /**
   * Get underlying Supabase client (for advanced usage)
   */
  getClient(): SupabaseClient<Database> {
    return this.client;
  }
}

// Export singleton instance
export const supabase = new TenantSupabaseClient();

// Export helper functions for tank servicing (maintaining existing API)
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

// Export helper to get client instance (maintaining existing API)
export const getSupabaseClient = () => supabase.getClient();
