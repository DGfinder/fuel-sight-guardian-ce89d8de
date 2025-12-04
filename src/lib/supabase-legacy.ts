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
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a single instance of the Supabase client
// Note: Not setting db.schema here allows .schema() calls to work properly
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
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

// Export a function to get the client instance
export const getSupabaseClient = () => supabase;

// Helper functions for tank servicing
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
