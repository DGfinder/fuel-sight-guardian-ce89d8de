import { supabase } from '@/lib/supabase';

/**
 * Terminal location from database
 */
export interface Terminal {
  id: string;
  terminal_name: string;
  terminal_code: string | null;
  latitude: number;
  longitude: number;
  location_point: unknown; // PostGIS geography
  carrier_primary: string | null;
  terminal_type: string;
  active: boolean;
  service_radius_km: number;
  service_area: unknown; // PostGIS geography
  created_at: string;
  updated_at: string;
  notes: string | null;
}

/**
 * Terminal for create/update operations
 */
export interface TerminalInput {
  terminal_name: string;
  terminal_code?: string | null;
  latitude: number;
  longitude: number;
  carrier_primary?: string | null;
  terminal_type?: string;
  active?: boolean;
  service_radius_km?: number;
  notes?: string | null;
}

/**
 * Terminal with statistics
 */
export interface TerminalWithStats extends Terminal {
  trip_count?: number;
  avg_idle_time_hours?: number;
  total_volume_litres?: number;
  last_visit_date?: string;
}

/**
 * Get all terminals
 */
export async function getTerminals(activeOnly: boolean = false) {
  let query = supabase
    .from('terminal_locations')
    .select('*')
    .order('terminal_name');

  if (activeOnly) {
    query = query.eq('active', true);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as Terminal[];
}

/**
 * Get a single terminal by ID
 */
export async function getTerminal(id: string) {
  const { data, error } = await supabase
    .from('terminal_locations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Terminal;
}

/**
 * Get terminal by name
 */
export async function getTerminalByName(name: string) {
  const { data, error } = await supabase
    .from('terminal_locations')
    .select('*')
    .eq('terminal_name', name)
    .single();

  if (error) throw error;
  return data as Terminal;
}

/**
 * Create a new terminal
 */
export async function createTerminal(terminal: TerminalInput) {
  const { data, error } = await supabase
    .from('terminal_locations')
    .insert([terminal])
    .select()
    .single();

  if (error) throw error;
  return data as Terminal;
}

/**
 * Update a terminal
 */
export async function updateTerminal(id: string, updates: Partial<TerminalInput>) {
  const { data, error } = await supabase
    .from('terminal_locations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Terminal;
}

/**
 * Delete a terminal
 */
export async function deleteTerminal(id: string) {
  const { error } = await supabase
    .from('terminal_locations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

/**
 * Get terminals with trip statistics
 */
export async function getTerminalsWithStats(dateFrom?: string, dateTo?: string) {
  // First get all terminals
  const terminals = await getTerminals();

  // Then get trip counts per terminal (this will need custom query once idle events table is created)
  // For now, return terminals without stats
  return terminals.map(terminal => ({
    ...terminal,
    trip_count: 0,
    avg_idle_time_hours: 0,
    total_volume_litres: 0,
    last_visit_date: null
  })) as TerminalWithStats[];
}

/**
 * Find nearest terminals to a GPS coordinate
 */
export async function findNearestTerminals(
  latitude: number,
  longitude: number,
  maxDistanceKm: number = 100,
  limit: number = 5
) {
  // Use PostGIS distance calculation
  const { data, error } = await supabase.rpc('find_nearest_terminals', {
    input_lat: latitude,
    input_lon: longitude,
    max_distance_km: maxDistanceKm,
    result_limit: limit
  });

  if (error) {
    // If RPC function doesn't exist, fall back to getting all terminals
    console.warn('find_nearest_terminals RPC not found, returning all terminals');
    return await getTerminals(true);
  }

  return data as (Terminal & { distance_km: number })[];
}

/**
 * Get terminal types (for dropdown)
 */
export function getTerminalTypes() {
  return [
    'Primary Fuel Terminal',
    'Regional Fuel Terminal',
    'Regional Terminal',
    'Mining Region Terminal',
    'Mining Terminal',
    'Industrial Terminal',
    'Southern Terminal',
    'Coastal Terminal',
    'Port Terminal',
    'Remote Terminal',
    'Customer Site',
    'Depot',
    'Other'
  ];
}

/**
 * Get carriers (for dropdown)
 */
export function getCarriers() {
  return [
    'SMB',
    'GSF',
    'Combined',
    'Third Party',
    'Unknown'
  ];
}

/**
 * Check if terminal name already exists
 */
export async function terminalNameExists(name: string, excludeId?: string) {
  let query = supabase
    .from('terminal_locations')
    .select('id')
    .eq('terminal_name', name);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data && data.length > 0;
}

/**
 * Ensure terminal_locations table exists
 */
export async function ensureTerminalTableExists() {
  try {
    // Try to query the table
    const { error } = await supabase
      .from('terminal_locations')
      .select('id')
      .limit(1);

    if (error && error.code === '42P01') {
      // Table doesn't exist
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Create terminal_locations table (runs migration)
 */
export async function createTerminalTable() {
  // This would need to run the SQL migration
  // For now, return a message that migration needs to be run manually
  throw new Error('Terminal table needs to be created via database migration. Please run: database/migrations/create_terminal_locations_lookup.sql');
}
