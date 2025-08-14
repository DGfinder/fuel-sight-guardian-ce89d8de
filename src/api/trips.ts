import { supabase } from '@/lib/supabase';

// Trip analytics API functions for MtData trip history

export interface TripFilters {
  vehicle_id?: string;
  driver_id?: string;
  date_from?: string;
  date_to?: string;
  fleet?: string;
  depot?: string;
  min_distance?: number;
  max_distance?: number;
}

export interface TripPerformanceMetrics {
  total_trips: number;
  total_distance_km: number;
  total_travel_time_hours: number;
  average_speed_kph: number;
  idling_percentage: number;
  route_efficiency_score: number;
  unique_locations: number;
  operational_hours: number;
}

export interface DailyFleetPerformance {
  trip_date: string;
  fleet: string;
  depot: string;
  total_trips: number;
  active_vehicles: number;
  active_drivers: number;
  total_distance_km: number;
  total_travel_hours: number;
  avg_speed_kph: number;
  avg_idling_percentage: number;
  avg_route_efficiency: number;
  total_guardian_events: number;
  total_lytx_events: number;
  first_trip_start: string;
  last_trip_end: string;
}

export interface DriverEfficiencyRanking {
  driver_id: string;
  driver_first_name: string;
  driver_last_name: string;
  driver_employee_id: string;
  fleet: string;
  depot: string;
  trips_count: number;
  total_distance: number;
  avg_speed: number;
  avg_idling_percentage: number;
  avg_route_efficiency: number;
  total_guardian_events: number;
  total_lytx_events: number;
  efficiency_rank: number;
  idling_rank: number;
  speed_rank: number;
}

export interface RouteOptimization {
  route_hash: string;
  start_location: string;
  end_location: string;
  trip_count: number;
  average_distance_km: number;
  average_travel_time_hours: number;
  best_time_hours: number;
  worst_time_hours: number;
  efficiency_rating: number;
  optimization_priority: string;
  time_variability_hours: number;
  potential_time_savings: number;
  usage_frequency: string;
  most_common_vehicles: string[];
  most_common_drivers: string[];
}

// Get trip performance metrics with filters
export async function getTripPerformance(filters?: TripFilters) {
  let query = supabase
    .from('mtdata_trip_performance_view')
    .select('*');

  if (filters?.vehicle_id) {
    query = query.eq('vehicle_id', filters.vehicle_id);
  }
  
  if (filters?.driver_id) {
    query = query.eq('driver_id', filters.driver_id);
  }
  
  if (filters?.fleet) {
    query = query.eq('fleet', filters.fleet);
  }
  
  if (filters?.depot) {
    query = query.eq('depot', filters.depot);
  }
  
  if (filters?.date_from) {
    query = query.gte('trip_date', filters.date_from);
  }
  
  if (filters?.date_to) {
    query = query.lte('trip_date', filters.date_to);
  }
  
  if (filters?.min_distance) {
    query = query.gte('distance_km', filters.min_distance);
  }
  
  if (filters?.max_distance) {
    query = query.lte('distance_km', filters.max_distance);
  }

  const { data, error } = await query.order('start_time', { ascending: false });
  
  if (error) throw error;
  return data;
}

// Get aggregated trip performance metrics
export async function getTripPerformanceMetrics(filters?: TripFilters): Promise<TripPerformanceMetrics> {
  const trips = await getTripPerformance(filters);
  
  if (!trips || trips.length === 0) {
    return {
      total_trips: 0,
      total_distance_km: 0,
      total_travel_time_hours: 0,
      average_speed_kph: 0,
      idling_percentage: 0,
      route_efficiency_score: 0,
      unique_locations: 0,
      operational_hours: 0
    };
  }

  const total_trips = trips.length;
  const total_distance_km = trips.reduce((sum, trip) => sum + (trip.distance_km || 0), 0);
  const total_travel_time_hours = trips.reduce((sum, trip) => sum + (trip.travel_time_hours || 0), 0);
  const total_idling_time = trips.reduce((sum, trip) => sum + (trip.idling_time_hours || 0), 0);
  
  const unique_locations = new Set(
    trips.flatMap(trip => [trip.start_location, trip.end_location].filter(Boolean))
  ).size;

  const first_trip = trips.reduce((earliest, trip) => 
    !earliest || trip.start_time < earliest.start_time ? trip : earliest
  );
  const last_trip = trips.reduce((latest, trip) => 
    !latest || trip.end_time > latest.end_time ? trip : latest
  );
  
  const operational_hours = first_trip && last_trip 
    ? (new Date(last_trip.end_time).getTime() - new Date(first_trip.start_time).getTime()) / (1000 * 60 * 60)
    : 0;

  return {
    total_trips,
    total_distance_km: Number(total_distance_km.toFixed(2)),
    total_travel_time_hours: Number(total_travel_time_hours.toFixed(2)),
    average_speed_kph: total_travel_time_hours > 0 ? Number((total_distance_km / total_travel_time_hours).toFixed(1)) : 0,
    idling_percentage: total_travel_time_hours > 0 ? Number(((total_idling_time / total_travel_time_hours) * 100).toFixed(1)) : 0,
    route_efficiency_score: Number((trips.reduce((sum, trip) => sum + (trip.route_efficiency_score || 0), 0) / total_trips).toFixed(1)),
    unique_locations,
    operational_hours: Number(operational_hours.toFixed(1))
  };
}

// Get daily fleet performance
export async function getDailyFleetPerformance(
  dateFrom?: string, 
  dateTo?: string,
  fleet?: string
): Promise<DailyFleetPerformance[]> {
  let query = supabase
    .from('mtdata_daily_fleet_performance')
    .select('*');
    
  if (dateFrom) {
    query = query.gte('trip_date', dateFrom);
  }
  
  if (dateTo) {
    query = query.lte('trip_date', dateTo);
  }
  
  if (fleet) {
    query = query.eq('fleet', fleet);
  }

  const { data, error } = await query.order('trip_date', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Get driver efficiency rankings
export async function getDriverEfficiencyRankings(
  fleet?: string,
  depot?: string,
  days?: number
): Promise<DriverEfficiencyRanking[]> {
  let query = supabase
    .from('mtdata_driver_efficiency_rankings')
    .select('*');
    
  if (fleet) {
    query = query.eq('fleet', fleet);
  }
  
  if (depot) {
    query = query.eq('depot', depot);
  }

  const { data, error } = await query.order('efficiency_rank');
  
  if (error) throw error;
  return data || [];
}

// Get route optimization opportunities
export async function getRouteOptimizationOpportunities(
  minTrips?: number
): Promise<RouteOptimization[]> {
  let query = supabase
    .from('route_optimization_opportunities')
    .select('*');

  const { data, error } = await query.order('trip_count', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

// Get trip analytics for a specific vehicle
export async function getVehicleTripAnalytics(vehicleId: string, days: number = 30) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);
  
  const filters: TripFilters = {
    vehicle_id: vehicleId,
    date_from: dateFrom.toISOString().split('T')[0]
  };
  
  const [trips, metrics] = await Promise.all([
    getTripPerformance(filters),
    getTripPerformanceMetrics(filters)
  ]);
  
  return {
    trips,
    metrics,
    period_days: days
  };
}

// Get trip analytics for a specific driver
export async function getDriverTripAnalytics(driverId: string, days: number = 30) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);
  
  const filters: TripFilters = {
    driver_id: driverId,
    date_from: dateFrom.toISOString().split('T')[0]
  };
  
  const [trips, metrics] = await Promise.all([
    getTripPerformance(filters),
    getTripPerformanceMetrics(filters)
  ]);
  
  return {
    trips,
    metrics,
    period_days: days
  };
}

// Get fleet summary analytics
export async function getFleetSummaryAnalytics(fleet?: string, days: number = 7) {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);
  
  const filters: TripFilters = {
    fleet,
    date_from: dateFrom.toISOString().split('T')[0]
  };
  
  const [metrics, dailyPerformance, driverRankings, routeOpportunities] = await Promise.all([
    getTripPerformanceMetrics(filters),
    getDailyFleetPerformance(filters.date_from, undefined, fleet),
    getDriverEfficiencyRankings(fleet, undefined, days),
    getRouteOptimizationOpportunities(5)
  ]);
  
  return {
    summary: metrics,
    daily_performance: dailyPerformance,
    top_drivers: driverRankings.slice(0, 10),
    route_opportunities: routeOpportunities.slice(0, 10),
    period_days: days
  };
}

// Update route patterns (manual trigger for route analytics)
export async function updateRoutePatterns() {
  const { error } = await supabase.rpc('update_route_patterns');
  
  if (error) throw error;
  return { success: true };
}

// Generate trip analytics for date range (manual trigger)
export async function generateTripAnalytics(startDate: string, endDate: string) {
  const { error } = await supabase.rpc('generate_trip_analytics_for_date_range', {
    start_date: startDate,
    end_date: endDate
  });
  
  if (error) throw error;
  return { success: true };
}