// Server-side Supabase client for API routes
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Create a server-side Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // No session persistence on server
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'x-application-name': 'fuel-sight-guardian-api'
    }
  }
});

// Export a function to get the client instance
export const getSupabaseClient = () => supabase;

// Helper functions for tank servicing
export const markTankServiced = async (tankId: string, userId: string) => {
  return supabase
    .from('fuel_tanks')
    .update({ 
      serviced_on: new Date().toISOString().slice(0, 10), 
      serviced_by: userId 
    })
    .eq('id', tankId);
};

export const unmarkTankServiced = async (tankId: string) => {
  return supabase
    .from('fuel_tanks')
    .update({ 
      serviced_on: null, 
      serviced_by: null 
    })
    .eq('id', tankId);
};