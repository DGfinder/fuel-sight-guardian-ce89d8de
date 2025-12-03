/**
 * Legacy Server-Side Supabase Client (Pre-Multi-Tenant)
 *
 * Original API-side client implementation before schema-per-tenant architecture.
 * All queries use public schema with no tenant routing.
 *
 * This file is kept for:
 * 1. Feature flag rollback capability
 * 2. Gradual migration testing
 * 3. Compatibility with non-tenant API routes
 */

import { createClient } from '@supabase/supabase-js';

// Use backend-only environment variables (never use VITE_ variables in backend code)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables (SUPABASE_URL and SUPABASE_ANON_KEY)');
}

// Create a server-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // No session persistence on server
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'x-application-name': 'fuel-sight-guardian-api',
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
