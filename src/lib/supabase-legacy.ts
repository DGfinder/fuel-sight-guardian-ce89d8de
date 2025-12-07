/**
 * Legacy Supabase Client (Pre-Multi-Tenant)
 *
 * Original client implementation before schema-per-tenant architecture.
 * All queries use public schema with no tenant routing.
 *
 * This file is kept for:
 * 1. Feature flag rollback capability
 * 2. Gradual migration testing
 * 3. Compatibility with non-tenant features
 *
 * NOTE: Uses lazy instantiation to avoid creating the client if not needed.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Lazy-loaded singleton
let _supabase: SupabaseClient<Database> | null = null;

/**
 * Get or create the Supabase client (lazy singleton)
 */
function getOrCreateClient(): SupabaseClient<Database> {
  if (_supabase) return _supabase;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  // Create client only when first accessed
  _supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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
  });

  return _supabase;
}

// Export getter function for explicit access
export const getSupabaseClient = getOrCreateClient;

// Export a proxy that lazily creates the client on first access
// This maintains backward compatibility with `supabase.from(...)` syntax
export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop) {
    const client = getOrCreateClient();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

// Helper functions for tank servicing
export const markTankServiced = async (tankId: string, userId: string) => {
  return getOrCreateClient()
    .from('fuel_tanks')
    .update({
      serviced_on: new Date().toISOString().slice(0, 10),
      serviced_by: userId,
    })
    .eq('id', tankId);
};

export const unmarkTankServiced = async (tankId: string) => {
  return getOrCreateClient()
    .from('fuel_tanks')
    .update({
      serviced_on: null,
      serviced_by: null,
    })
    .eq('id', tankId);
};
