/**
 * MtData Analytics Service
 * Provides data fetching functions for MtData trip analytics
 */

import { supabase } from '@/lib/supabase';

export interface MtDataOverview {
  totalTrips: number;
  totalDistance: number;
  totalTravelTime: number;
  uniqueVehicles: number;
  uniqueDrivers: number;
  avgTripDistance: number;
  avgTripDuration: number;
  dateRange: {
    start: string;
    end: string;
  };
}

export interface DailyTripMetrics {
  date: string;
  tripCount: number;
  totalDistance: number;
  totalTime: number;
  uniqueVehicles: number;
  avgDistance: number;
}

export interface VehicleUtilization {
  vehicleRegistration: string;
  groupName: string;
  tripCount: number;
  totalDistance: number;
  totalTime: number;
  avgTripDistance: number;
  lastSeen: string;
  utilizationScore: number;
}

export interface DriverPerformance {
  driverName: string;
  tripCount: number;
  totalDistance: number;
  totalTime: number;
  avgDistance: number;
  avgDuration: number;
  efficiencyScore: number;
}

export interface RouteAnalysis {
  startLocation: string;
  endLocation: string;
  tripCount: number;
  avgDistance: number;
  avgDuration: number;
  routeEfficiency: number;
}

export interface DepotMetrics {
  depot: string;
  tripCount: number;
  vehicleCount: number;
  totalDistance: number;
  avgUtilization: number;
}

/**
 * Get overview analytics for MtData trips
 */
export async function getMtDataOverview(fleet?: string): Promise<MtDataOverview> {
  let query = supabase
    .from('mtdata_trip_history')
    .select('*')
    .not('distance_km', 'is', null)
    .not('travel_time_hours', 'is', null);

  // Filter by fleet if specified
  if (fleet === 'Stevemacs') {
    query = query.or('group_name.eq.Stevemacs,group_name.eq.Stevemacs GSF');
  } else if (fleet === 'GSF') {
    query = query.not('group_name', 'in', '("Stevemacs","Stevemacs GSF")');
  }

  const { data: trips, error } = await query;

  if (error) {
    console.error('Error fetching MtData overview:', error);
    throw error;
  }

  if (!trips || trips.length === 0) {
    return {
      totalTrips: 0,
      totalDistance: 0,
      totalTravelTime: 0,
      uniqueVehicles: 0,
      uniqueDrivers: 0,
      avgTripDistance: 0,
      avgTripDuration: 0,
      dateRange: { start: '', end: '' }
    };
  }

  const totalTrips = trips.length;
  const totalDistance = trips.reduce((sum, trip) => sum + (parseFloat(trip.distance_km) || 0), 0);
  const totalTravelTime = trips.reduce((sum, trip) => sum + (parseFloat(trip.travel_time_hours) || 0), 0);
  const uniqueVehicles = new Set(trips.map(t => t.vehicle_registration)).size;
  const uniqueDrivers = new Set(trips.filter(t => t.driver_name).map(t => t.driver_name)).size;

  const sortedTrips = trips.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  return {
    totalTrips,
    totalDistance: Math.round(totalDistance),
    totalTravelTime: Math.round(totalTravelTime * 10) / 10,
    uniqueVehicles,
    uniqueDrivers,
    avgTripDistance: Math.round((totalDistance / totalTrips) * 100) / 100,
    avgTripDuration: Math.round((totalTravelTime / totalTrips) * 100) / 100,
    dateRange: {
      start: sortedTrips[0]?.start_time?.split('T')[0] || '',
      end: sortedTrips[sortedTrips.length - 1]?.start_time?.split('T')[0] || ''
    }
  };
}

/**
 * Get daily trip metrics for trend analysis
 */
export async function getDailyTripMetrics(fleet?: string, days: number = 30): Promise<DailyTripMetrics[]> {
  let query = supabase
    .from('mtdata_trip_history')
    .select('start_time, distance_km, travel_time_hours, vehicle_registration')
    .not('distance_km', 'is', null)
    .gte('start_time', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

  if (fleet === 'Stevemacs') {
    query = query.or('group_name.eq.Stevemacs,group_name.eq.Stevemacs GSF');
  } else if (fleet === 'GSF') {
    query = query.not('group_name', 'in', '("Stevemacs","Stevemacs GSF")');
  }

  const { data: trips, error } = await query;

  if (error) {
    console.error('Error fetching daily metrics:', error);
    throw error;
  }

  if (!trips) return [];

  // Group by date
  const dailyData: { [date: string]: any[] } = {};
  trips.forEach(trip => {
    const date = trip.start_time.split('T')[0];
    if (!dailyData[date]) dailyData[date] = [];
    dailyData[date].push(trip);
  });

  // Calculate metrics for each day
  return Object.entries(dailyData).map(([date, dayTrips]) => {
    const totalDistance = dayTrips.reduce((sum, trip) => sum + (parseFloat(trip.distance_km) || 0), 0);
    const totalTime = dayTrips.reduce((sum, trip) => sum + (parseFloat(trip.travel_time_hours) || 0), 0);
    const uniqueVehicles = new Set(dayTrips.map(t => t.vehicle_registration)).size;

    return {
      date,
      tripCount: dayTrips.length,
      totalDistance: Math.round(totalDistance),
      totalTime: Math.round(totalTime * 10) / 10,
      uniqueVehicles,
      avgDistance: Math.round((totalDistance / dayTrips.length) * 100) / 100
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get vehicle utilization metrics
 */
export async function getVehicleUtilization(fleet?: string): Promise<VehicleUtilization[]> {
  let query = supabase
    .from('mtdata_trip_history')
    .select('vehicle_registration, group_name, distance_km, travel_time_hours, start_time')
    .not('distance_km', 'is', null);

  if (fleet === 'Stevemacs') {
    query = query.or('group_name.eq.Stevemacs,group_name.eq.Stevemacs GSF');
  } else if (fleet === 'GSF') {
    query = query.not('group_name', 'in', '("Stevemacs","Stevemacs GSF")');
  }

  const { data: trips, error } = await query;

  if (error) {
    console.error('Error fetching vehicle utilization:', error);
    throw error;
  }

  if (!trips) return [];

  // Group by vehicle
  const vehicleData: { [reg: string]: any } = {};
  trips.forEach(trip => {
    const reg = trip.vehicle_registration;
    if (!vehicleData[reg]) {
      vehicleData[reg] = {
        vehicleRegistration: reg,
        groupName: trip.group_name,
        trips: [],
        totalDistance: 0,
        totalTime: 0,
        lastSeen: trip.start_time
      };
    }
    vehicleData[reg].trips.push(trip);
    vehicleData[reg].totalDistance += parseFloat(trip.distance_km) || 0;
    vehicleData[reg].totalTime += parseFloat(trip.travel_time_hours) || 0;
    if (trip.start_time > vehicleData[reg].lastSeen) {
      vehicleData[reg].lastSeen = trip.start_time;
    }
  });

  // Calculate utilization metrics
  return Object.values(vehicleData).map((vehicle: any) => {
    const tripCount = vehicle.trips.length;
    const avgTripDistance = vehicle.totalDistance / tripCount;
    
    // Simple utilization score based on trip frequency and distance
    const daysSinceLastTrip = Math.floor((Date.now() - new Date(vehicle.lastSeen).getTime()) / (1000 * 60 * 60 * 24));
    const utilizationScore = Math.max(0, Math.min(100, 
      (tripCount * 2) + (vehicle.totalDistance / 100) - (daysSinceLastTrip * 5)
    ));

    return {
      vehicleRegistration: vehicle.vehicleRegistration,
      groupName: vehicle.groupName,
      tripCount,
      totalDistance: Math.round(vehicle.totalDistance),
      totalTime: Math.round(vehicle.totalTime * 10) / 10,
      avgTripDistance: Math.round(avgTripDistance * 100) / 100,
      lastSeen: vehicle.lastSeen,
      utilizationScore: Math.round(utilizationScore)
    };
  }).sort((a, b) => b.utilizationScore - a.utilizationScore);
}

/**
 * Get driver performance metrics
 */
export async function getDriverPerformance(fleet?: string): Promise<DriverPerformance[]> {
  let query = supabase
    .from('mtdata_trip_history')
    .select('driver_name, distance_km, travel_time_hours')
    .not('driver_name', 'is', null)
    .not('distance_km', 'is', null);

  if (fleet === 'Stevemacs') {
    query = query.or('group_name.eq.Stevemacs,group_name.eq.Stevemacs GSF');
  } else if (fleet === 'GSF') {
    query = query.not('group_name', 'in', '("Stevemacs","Stevemacs GSF")');
  }

  const { data: trips, error } = await query;

  if (error) {
    console.error('Error fetching driver performance:', error);
    throw error;
  }

  if (!trips) return [];

  // Group by driver
  const driverData: { [name: string]: any } = {};
  trips.forEach(trip => {
    const name = trip.driver_name;
    if (!driverData[name]) {
      driverData[name] = { trips: [], totalDistance: 0, totalTime: 0 };
    }
    driverData[name].trips.push(trip);
    driverData[name].totalDistance += parseFloat(trip.distance_km) || 0;
    driverData[name].totalTime += parseFloat(trip.travel_time_hours) || 0;
  });

  // Calculate performance metrics
  return Object.entries(driverData).map(([driverName, data]: [string, any]) => {
    const tripCount = data.trips.length;
    const avgDistance = data.totalDistance / tripCount;
    const avgDuration = data.totalTime / tripCount;
    
    // Efficiency score based on distance per hour
    const efficiencyScore = data.totalTime > 0 ? data.totalDistance / data.totalTime : 0;

    return {
      driverName,
      tripCount,
      totalDistance: Math.round(data.totalDistance),
      totalTime: Math.round(data.totalTime * 10) / 10,
      avgDistance: Math.round(avgDistance * 100) / 100,
      avgDuration: Math.round(avgDuration * 100) / 100,
      efficiencyScore: Math.round(efficiencyScore * 100) / 100
    };
  }).sort((a, b) => b.efficiencyScore - a.efficiencyScore);
}

/**
 * Get route analysis data
 */
export async function getRouteAnalysis(fleet?: string): Promise<RouteAnalysis[]> {
  let query = supabase
    .from('mtdata_trip_history')
    .select('start_location, end_location, distance_km, travel_time_hours')
    .not('start_location', 'is', null)
    .not('end_location', 'is', null)
    .not('distance_km', 'is', null);

  if (fleet === 'Stevemacs') {
    query = query.or('group_name.eq.Stevemacs,group_name.eq.Stevemacs GSF');
  } else if (fleet === 'GSF') {
    query = query.not('group_name', 'in', '("Stevemacs","Stevemacs GSF")');
  }

  const { data: trips, error } = await query;

  if (error) {
    console.error('Error fetching route analysis:', error);
    throw error;
  }

  if (!trips) return [];

  // Group by route
  const routeData: { [route: string]: any } = {};
  trips.forEach(trip => {
    const route = `${trip.start_location} → ${trip.end_location}`;
    if (!routeData[route]) {
      routeData[route] = {
        startLocation: trip.start_location,
        endLocation: trip.end_location,
        trips: [],
        totalDistance: 0,
        totalTime: 0
      };
    }
    routeData[route].trips.push(trip);
    routeData[route].totalDistance += parseFloat(trip.distance_km) || 0;
    routeData[route].totalTime += parseFloat(trip.travel_time_hours) || 0;
  });

  // Calculate route metrics and filter for frequent routes
  return Object.values(routeData)
    .filter((route: any) => route.trips.length >= 3) // Only routes with 3+ trips
    .map((route: any) => {
      const tripCount = route.trips.length;
      const avgDistance = route.totalDistance / tripCount;
      const avgDuration = route.totalTime / tripCount;
      
      // Route efficiency: km per hour
      const routeEfficiency = avgDuration > 0 ? avgDistance / avgDuration : 0;

      return {
        startLocation: route.startLocation,
        endLocation: route.endLocation,
        tripCount,
        avgDistance: Math.round(avgDistance * 100) / 100,
        avgDuration: Math.round(avgDuration * 100) / 100,
        routeEfficiency: Math.round(routeEfficiency * 100) / 100
      };
    })
    .sort((a, b) => b.tripCount - a.tripCount)
    .slice(0, 20); // Top 20 routes
}

/**
 * Get depot-level metrics for GSF analysis
 */
export async function getDepotMetrics(): Promise<DepotMetrics[]> {
  // Get vehicle depot assignments
  const { data: vehicles, error: vehicleError } = await supabase
    .from('vehicles')
    .select('registration, depot');

  if (vehicleError) {
    console.error('Error fetching vehicles:', vehicleError);
    throw vehicleError;
  }

  // Get trip data
  const { data: trips, error: tripError } = await supabase
    .from('mtdata_trip_history')
    .select('vehicle_registration, distance_km')
    .not('distance_km', 'is', null)
    .not('vehicle_id', 'is', null); // Only correlated vehicles

  if (tripError) {
    console.error('Error fetching trips for depot analysis:', tripError);
    throw tripError;
  }

  if (!vehicles || !trips) return [];

  // Create vehicle-to-depot mapping
  const vehicleDepotMap = new Map();
  vehicles.forEach(vehicle => {
    vehicleDepotMap.set(vehicle.registration, vehicle.depot);
  });

  // Group trips by depot
  const depotData: { [depot: string]: any } = {};
  trips.forEach(trip => {
    const depot = vehicleDepotMap.get(trip.vehicle_registration);
    if (!depot) return;

    if (!depotData[depot]) {
      depotData[depot] = {
        trips: [],
        vehicles: new Set(),
        totalDistance: 0
      };
    }

    depotData[depot].trips.push(trip);
    depotData[depot].vehicles.add(trip.vehicle_registration);
    depotData[depot].totalDistance += parseFloat(trip.distance_km) || 0;
  });

  // Calculate depot metrics
  return Object.entries(depotData).map(([depot, data]: [string, any]) => {
    const vehicleCount = data.vehicles.size;
    const avgUtilization = vehicleCount > 0 ? data.trips.length / vehicleCount : 0;

    return {
      depot,
      tripCount: data.trips.length,
      vehicleCount,
      totalDistance: Math.round(data.totalDistance),
      avgUtilization: Math.round(avgUtilization * 100) / 100
    };
  }).sort((a, b) => b.tripCount - a.tripCount);
}