import { supabase } from '@/lib/supabase';
import type { MtDataTripRow } from '@/utils/mtdataExcelParser';

/**
 * Route Pattern from database
 */
export interface RoutePattern {
  id: string;
  route_hash: string;
  start_location: string;
  end_location: string;
  start_area: string | null;
  end_area: string | null;
  trip_count: number;
  average_distance_km: number;
  average_travel_time_hours: number;
  best_time_hours: number;
  worst_time_hours: number;
  efficiency_rating: number;
  time_variability: number;
  most_common_vehicles: string[];
  most_common_drivers: string[];
  peak_usage_hours: number[];
  first_seen: string;
  last_used: string;
  created_at: string;
  updated_at: string;
}

/**
 * Route optimization opportunity
 */
export interface RouteOptimizationOpportunity {
  route_hash: string;
  start_location: string;
  end_location: string;
  trip_count: number;
  average_time_hours: number;
  best_time_hours: number;
  worst_time_hours: number;
  time_saved_potential_hours: number;
  efficiency_rating: number;
  time_variability: number;
  priority: string;
  last_analyzed: string;
}

/**
 * Filters for route pattern queries
 */
export interface RoutePatternFilters {
  startLocation?: string;
  endLocation?: string;
  minTripCount?: number;
  dateFrom?: string;
  dateTo?: string;
  fleet?: string;
  depot?: string;
  minEfficiency?: number;
  maxEfficiency?: number;
}

/**
 * Get all route patterns with optional filters
 */
export async function getRoutePatterns(filters?: RoutePatternFilters) {
  let query = supabase
    .from('route_patterns')
    .select('*')
    .order('trip_count', { ascending: false });

  if (filters?.startLocation) {
    query = query.ilike('start_location', `%${filters.startLocation}%`);
  }

  if (filters?.endLocation) {
    query = query.ilike('end_location', `%${filters.endLocation}%`);
  }

  if (filters?.minTripCount) {
    query = query.gte('trip_count', filters.minTripCount);
  }

  if (filters?.minEfficiency !== undefined) {
    query = query.gte('efficiency_rating', filters.minEfficiency);
  }

  if (filters?.maxEfficiency !== undefined) {
    query = query.lte('efficiency_rating', filters.maxEfficiency);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data as RoutePattern[];
}

/**
 * Get route optimization opportunities
 */
export async function getRouteOptimizationOpportunities(minTripCount: number = 10) {
  const { data, error } = await supabase
    .from('route_optimization_opportunities')
    .select('*')
    .gte('trip_count', minTripCount)
    .order('time_saved_potential_hours', { ascending: false });

  if (error) throw error;
  return data as RouteOptimizationOpportunity[];
}

/**
 * Trigger route pattern generation/update
 */
export async function updateRoutePatterns() {
  const { data, error } = await supabase.rpc('update_route_patterns');

  if (error) throw error;
  return data;
}

/**
 * Get route pattern statistics
 */
export async function getRoutePatternStats() {
  const { data: patterns, error: patternsError } = await supabase
    .from('route_patterns')
    .select('trip_count, average_distance_km, average_travel_time_hours, efficiency_rating');

  if (patternsError) throw patternsError;

  const { data: trips, error: tripsError } = await supabase
    .from('mtdata_trip_history')
    .select('id, trip_date_computed')
    .order('trip_date_computed', { ascending: false })
    .limit(1);

  if (tripsError) throw tripsError;

  const totalRoutes = patterns?.length || 0;
  const totalTripsInPatterns = patterns?.reduce((sum, p) => sum + (p.trip_count || 0), 0) || 0;
  const avgEfficiency = patterns && patterns.length > 0
    ? patterns.reduce((sum, p) => sum + (p.efficiency_rating || 0), 0) / patterns.length
    : 0;
  const totalDistance = patterns?.reduce((sum, p) => sum + (p.average_distance_km * p.trip_count || 0), 0) || 0;
  const totalTime = patterns?.reduce((sum, p) => sum + (p.average_travel_time_hours * p.trip_count || 0), 0) || 0;

  return {
    totalRoutes,
    totalTripsInPatterns,
    avgEfficiency: Math.round(avgEfficiency),
    totalDistance: Math.round(totalDistance),
    totalTime: Math.round(totalTime),
    lastUpdated: trips && trips.length > 0 ? trips[0].trip_date_computed : null
  };
}

/**
 * Import MtData trips to database
 */
export async function importMtDataTrips(trips: MtDataTripRow[]) {
  // Map MtData trips to database format
  const dbTrips = trips.map(trip => ({
    // External IDs
    trip_external_id: `${trip.unitSerialNumber}-${trip.tripNo}`,
    trip_number: trip.tripNo,

    // Vehicle info
    vehicle_registration: trip.vehicleRego,
    mtdata_vehicle_id: trip.vehicleName,
    unit_serial_number: trip.unitSerialNumber,

    // Driver info
    driver_name: trip.driver || null,
    group_name: trip.group || null,

    // Trip timing
    start_time: trip.startTime.toISOString(),
    end_time: trip.endTime.toISOString(),
    travel_time_hours: trip.travelTimeHours,

    // Locations
    start_location: trip.startLocation,
    start_latitude: trip.startLatitude,
    start_longitude: trip.startLongitude,
    end_location: trip.endLocation,
    end_latitude: trip.endLatitude,
    end_longitude: trip.endLongitude,

    // Metrics
    distance_km: trip.distanceKm,
    odometer_reading: trip.odometer,
    idling_time_hours: trip.idlingTimeHours,
    idling_periods: trip.idlingPeriods,

    // Calculate average speed
    average_speed_kph: trip.travelTimeHours > 0 ? trip.distanceKm / trip.travelTimeHours : 0
  }));

  // Insert trips in batches to avoid timeout
  const BATCH_SIZE = 100;
  const results = [];

  for (let i = 0; i < dbTrips.length; i += BATCH_SIZE) {
    const batch = dbTrips.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('mtdata_trip_history')
      .upsert(batch, {
        onConflict: 'trip_external_id',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error(`Error importing batch ${i / BATCH_SIZE + 1}:`, error);
      throw error;
    }

    results.push(...(data || []));
  }

  return results;
}

/**
 * Get trip count in database
 */
export async function getTripCount(filters?: {
  dateFrom?: string;
  dateTo?: string;
  fleet?: string;
  depot?: string;
}) {
  let query = supabase
    .from('mtdata_trip_history')
    .select('id', { count: 'exact', head: true });

  if (filters?.dateFrom) {
    query = query.gte('start_time', filters.dateFrom);
  }

  if (filters?.dateTo) {
    query = query.lte('start_time', filters.dateTo);
  }

  if (filters?.fleet) {
    query = query.eq('group_name', filters.fleet);
  }

  const { count, error } = await query;

  if (error) throw error;
  return count || 0;
}

/**
 * Get unique routes (start/end location pairs) from trip history
 */
export async function getUniqueRoutes() {
  const { data, error } = await supabase
    .from('mtdata_trip_history')
    .select('start_location, end_location')
    .not('start_location', 'is', null)
    .not('end_location', 'is', null);

  if (error) throw error;

  // Group by route pairs
  const routeMap = new Map<string, { start: string; end: string; count: number }>();

  data?.forEach(trip => {
    const key = `${trip.start_location}→${trip.end_location}`;
    const existing = routeMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      routeMap.set(key, {
        start: trip.start_location,
        end: trip.end_location,
        count: 1
      });
    }
  });

  return Array.from(routeMap.values()).sort((a, b) => b.count - a.count);
}

/**
 * Get date range of trips in database
 */
export async function getTripDateRange() {
  const { data: minData, error: minError } = await supabase
    .from('mtdata_trip_history')
    .select('start_time')
    .order('start_time', { ascending: true })
    .limit(1);

  const { data: maxData, error: maxError } = await supabase
    .from('mtdata_trip_history')
    .select('start_time')
    .order('start_time', { ascending: false })
    .limit(1);

  if (minError || maxError) throw minError || maxError;

  return {
    from: minData && minData.length > 0 ? minData[0].start_time : null,
    to: maxData && maxData.length > 0 ? maxData[0].start_time : null
  };
}
