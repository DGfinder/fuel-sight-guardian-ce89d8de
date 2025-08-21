/**
 * Driver Profile Service
 * Unified service for aggregating driver data across MtData, LYTX, and Guardian systems
 * Provides comprehensive driver analytics with security and privacy compliance
 */

import { supabase } from '@/lib/supabase';

// Core interfaces for unified driver profile data
export interface DriverProfileSummary {
  // Driver Identity
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  employee_id?: string;
  fleet: string;
  depot?: string;
  status: 'Active' | 'Inactive' | 'Terminated';
  
  // Aggregate Performance Metrics
  overall_safety_score: number;
  lytx_safety_score?: number;
  guardian_risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
  
  // Activity Summary
  total_trips_30d: number;
  total_km_30d: number;
  total_hours_30d: number;
  total_volume_30d: number; // in litres
  active_days_30d: number;
  last_activity_date?: string;
  
  // Safety Events Summary
  lytx_events_30d: number;
  guardian_events_30d: number;
  high_risk_events_30d: number;
  coaching_sessions_30d: number;
}

export interface DriverTripAnalytics {
  // Trip Statistics
  total_trips: number;
  total_km: number;
  total_hours: number;
  total_volume: number; // in litres
  avg_trip_distance: number;
  avg_trip_duration: number;
  avg_trip_volume: number; // in litres
  
  // Vehicle Utilization
  vehicles_driven: number;
  primary_vehicle?: string;
  depot_coverage: string[];
  
  // Time Analysis
  most_active_hours: { hour: number; trip_count: number }[];
  daily_patterns: { day: string; trips: number; km: number; hours: number; volume: number }[];
  monthly_trends: { month: string; trips: number; km: number; hours: number; volume: number }[];
  
  // Productivity Metrics
  volume_per_hour: number; // litres per hour
  km_per_hour: number;
  deliveries_per_trip: number;
  
  // Performance Metrics
  fuel_efficiency_score?: number;
  route_optimization_score?: number;
  vehicle_care_score?: number;
  volume_efficiency_score?: number;
}

export interface DriverSafetyAnalytics {
  // LYTX Safety Events
  lytx_total_events: number;
  lytx_events_by_trigger: { trigger: string; count: number; avg_score: number }[];
  lytx_resolution_rate: number;
  lytx_coaching_history: Array<{
    date: string;
    trigger: string;
    coach: string;
    status: string;
  }>;
  
  // Guardian Distraction/Fatigue Events
  guardian_total_events: number;
  guardian_events_by_type: { 
    type: 'Distraction' | 'Fatigue' | 'Field of View'; 
    count: number; 
    severity_breakdown: Record<string, number> 
  }[];
  guardian_confirmation_rate: number;
  guardian_severity_trends: { month: string; low: number; medium: number; high: number; critical: number }[];
  
  // Risk Assessment
  risk_trend: 'Improving' | 'Stable' | 'Deteriorating';
  risk_factors: string[];
  coaching_recommendations: string[];
}

export interface DriverPerformanceComparison {
  fleet_rank: number;
  fleet_percentile: number;
  peer_comparison: {
    safety_score_vs_fleet: number;
    trips_vs_fleet: number;
    km_vs_fleet: number;
    volume_vs_fleet: number;
    productivity_vs_fleet: number;
    hours_vs_fleet: number;
  };
  improvement_areas: string[];
  strengths: string[];
}

export interface UnifiedDriverProfile {
  summary: DriverProfileSummary;
  trip_analytics: DriverTripAnalytics;
  safety_analytics: DriverSafetyAnalytics;
  performance_comparison: DriverPerformanceComparison;
  last_updated: string;
}

// Service class for driver profile operations
export class DriverProfileService {
  
  /**
   * Get comprehensive driver profile with security filtering
   */
  static async getDriverProfile(
    driverId: string, 
    timeframe: '30d' | '90d' | '1y' = '30d'
  ): Promise<UnifiedDriverProfile> {
    
    // Get base driver info with RLS
    const driverSummary = await this.getDriverSummary(driverId, timeframe);
    
    // Parallel data fetching for performance
    const [tripAnalytics, safetyAnalytics, performanceComparison] = await Promise.all([
      this.getDriverTripAnalytics(driverId, timeframe),
      this.getDriverSafetyAnalytics(driverId, timeframe),
      this.getDriverPerformanceComparison(driverId, timeframe)
    ]);
    
    return {
      summary: driverSummary,
      trip_analytics: tripAnalytics,
      safety_analytics: safetyAnalytics,
      performance_comparison: performanceComparison,
      last_updated: new Date().toISOString()
    };
  }
  
  /**
   * Update driver status (Active/Inactive/Terminated)
   */
  static async updateDriverStatus(
    driverId: string,
    status: 'Active' | 'Inactive' | 'Terminated'
  ): Promise<{ id: string; status: 'Active' | 'Inactive' | 'Terminated' }> {
    const { data, error } = await supabase
      .from('drivers')
      .update({ status })
      .eq('id', driverId)
      .select('id, status')
      .single();

    if (error) throw error;
    return data as { id: string; status: 'Active' | 'Inactive' | 'Terminated' };
  }

  /**
   * Get driver summary with aggregate metrics
   */
  private static async getDriverSummary(
    driverId: string, 
    timeframe: string
  ): Promise<DriverProfileSummary> {
    
    const days = timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data, error } = await supabase
      .rpc('get_driver_profile_summary', {
        p_driver_id: driverId,
        p_start_date: startDate.toISOString(),
        p_timeframe: timeframe
      });
    
    if (error) throw error;
    
    // Transform database result to typed interface
    const result = data[0];
    return {
      id: result.driver_id,
      first_name: result.first_name,
      last_name: result.last_name,
      full_name: `${result.first_name} ${result.last_name}`,
      employee_id: result.employee_id,
      fleet: result.fleet,
      depot: result.depot,
      status: result.status,
      overall_safety_score: result.overall_safety_score || 0,
      lytx_safety_score: result.lytx_safety_score,
      guardian_risk_level: result.guardian_risk_level || 'Low',
      total_trips_30d: result.total_trips || 0,
      total_km_30d: result.total_km || 0,
      total_hours_30d: result.total_hours || 0,
      total_volume_30d: result.total_volume || 0,
      active_days_30d: result.active_days || 0,
      last_activity_date: result.last_activity_date,
      lytx_events_30d: result.lytx_events || 0,
      guardian_events_30d: result.guardian_events || 0,
      high_risk_events_30d: result.high_risk_events || 0,
      coaching_sessions_30d: result.coaching_sessions || 0,
    };
  }
  
  /**
   * Get comprehensive trip analytics from MtData
   */
  private static async getDriverTripAnalytics(
    driverId: string, 
    timeframe: string
  ): Promise<DriverTripAnalytics> {
    
    const { data, error } = await supabase
      .rpc('get_driver_trip_analytics', {
        p_driver_id: driverId,
        p_timeframe: timeframe
      });
    
    if (error) throw error;
    
    const result = data[0];
    return {
      total_trips: result.total_trips || 0,
      total_km: result.total_km || 0,
      total_hours: result.total_hours || 0,
      total_volume: result.total_volume || 0,
      avg_trip_distance: result.avg_trip_distance || 0,
      avg_trip_duration: result.avg_trip_duration || 0,
      avg_trip_volume: result.avg_trip_volume || 0,
      vehicles_driven: result.vehicles_driven || 0,
      primary_vehicle: result.primary_vehicle,
      depot_coverage: result.depot_coverage || [],
      most_active_hours: result.most_active_hours || [],
      daily_patterns: result.daily_patterns || [],
      monthly_trends: result.monthly_trends || [],
      volume_per_hour: result.volume_per_hour || 0,
      km_per_hour: result.km_per_hour || 0,
      deliveries_per_trip: result.deliveries_per_trip || 0,
      fuel_efficiency_score: result.fuel_efficiency_score,
      route_optimization_score: result.route_optimization_score,
      vehicle_care_score: result.vehicle_care_score,
      volume_efficiency_score: result.volume_efficiency_score,
    };
  }
  
  /**
   * Get safety analytics from LYTX and Guardian systems
   */
  private static async getDriverSafetyAnalytics(
    driverId: string, 
    timeframe: string
  ): Promise<DriverSafetyAnalytics> {
    
    // Get LYTX analytics
    const { data: lytxData, error: lytxError } = await supabase
      .rpc('get_driver_lytx_analytics', {
        p_driver_id: driverId,
        p_timeframe: timeframe
      });
    
    if (lytxError) throw lytxError;
    
    // Get Guardian analytics
    const { data: guardianData, error: guardianError } = await supabase
      .rpc('get_driver_guardian_analytics', {
        p_driver_id: driverId,
        p_timeframe: timeframe
      });
    
    if (guardianError) throw guardianError;
    
    const lytx = lytxData[0] || {};
    const guardian = guardianData[0] || {};
    
    return {
      lytx_total_events: lytx.total_events || 0,
      lytx_events_by_trigger: lytx.events_by_trigger || [],
      lytx_resolution_rate: lytx.resolution_rate || 0,
      lytx_coaching_history: lytx.coaching_history || [],
      guardian_total_events: guardian.total_events || 0,
      guardian_events_by_type: guardian.events_by_type || [],
      guardian_confirmation_rate: guardian.confirmation_rate || 0,
      guardian_severity_trends: guardian.severity_trends || [],
      risk_trend: this.calculateRiskTrend(lytx, guardian),
      risk_factors: this.identifyRiskFactors(lytx, guardian),
      coaching_recommendations: this.generateCoachingRecommendations(lytx, guardian),
    };
  }
  
  /**
   * Get performance comparison vs fleet/peers
   */
  private static async getDriverPerformanceComparison(
    driverId: string, 
    timeframe: string
  ): Promise<DriverPerformanceComparison> {
    
    const { data, error } = await supabase
      .rpc('get_driver_performance_comparison', {
        p_driver_id: driverId,
        p_timeframe: timeframe
      });
    
    if (error) throw error;
    
    const result = data[0];
    return {
      fleet_rank: result.fleet_rank || 0,
      fleet_percentile: result.fleet_percentile || 0,
      peer_comparison: {
        safety_score_vs_fleet: result.safety_score_vs_fleet || 0,
        trips_vs_fleet: result.trips_vs_fleet || 0,
        km_vs_fleet: result.km_vs_fleet || 0,
      },
      improvement_areas: result.improvement_areas || [],
      strengths: result.strengths || [],
    };
  }
  
  /**
   * Search drivers with autocomplete support
   */
  static async searchDrivers(
    searchTerm: string, 
    fleet?: string, 
    limit: number = 10
  ): Promise<Array<Pick<DriverProfileSummary, 'id' | 'full_name' | 'employee_id' | 'fleet' | 'depot'>>> {
    
    let query = supabase
      .from('driver_profiles')
      .select('id, first_name, last_name, employee_id, fleet, depot')
      .or(`
        first_name.ilike.%${searchTerm}%,
        last_name.ilike.%${searchTerm}%,
        employee_id.ilike.%${searchTerm}%
      `)
      .eq('status', 'Active')
      .limit(limit);
    
    if (fleet) {
      query = query.eq('fleet', fleet);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    return data.map(driver => ({
      id: driver.id,
      full_name: `${driver.first_name} ${driver.last_name}`,
      employee_id: driver.employee_id,
      fleet: driver.fleet,
      depot: driver.depot,
    }));
  }
  
  /**
   * Get all driver summaries with their actual performance metrics
   */
  static async getDriverSummaries(fleet?: string, limit: number = 50): Promise<DriverProfileSummary[]> {
    
    // Get drivers with real metrics from multiple data sources
    let driversQuery = supabase
      .from('drivers')
      .select(`
        id,
        first_name,
        last_name,
        employee_id,
        fleet,
        depot,
        status,
        safety_score,
        lytx_score
      `);
      // Remove hardcoded Active filter - let UI decide how to filter by status
    
    if (fleet) {
      driversQuery = driversQuery.eq('fleet', fleet);
    }
    
    const { data: drivers, error: driversError } = await driversQuery.limit(limit);
    
    if (driversError) throw driversError;
    
    // Get trip data for each driver in parallel
    const driverSummaries = await Promise.all(
      drivers.map(async (driver: any) => {
        // Get trip metrics from MtData - unified approach using foreign keys and fallback
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        
        // Primary: Get correlated trips via foreign key (much faster)
        const { data: correlatedTrips } = await supabase
          .from('mtdata_trip_history')
          .select('start_time, distance_km, duration_hours, total_volume_litres')
          .eq('driver_id', driver.id)
          .gte('start_time', thirtyDaysAgo)
          .order('start_time', { ascending: false });
        
        // Fallback: Get uncorrelated trips via name matching
        const { data: uncorrelatedTrips } = await supabase
          .from('mtdata_trip_history')
          .select('start_time, distance_km, duration_hours, total_volume_litres')
          .is('driver_id', null)
          .ilike('driver_name', `%${driver.first_name}%${driver.last_name}%`)
          .gte('start_time', thirtyDaysAgo)
          .order('start_time', { ascending: false });
        
        // Combine both datasets for complete picture
        const tripData = [...(correlatedTrips || []), ...(uncorrelatedTrips || [])];
        
        // Get LYTX events using foreign key relationship
        const { data: lytxEvents } = await supabase
          .from('lytx_safety_events')
          .select('event_datetime, trigger_type, score, status')
          .eq('driver_id', driverId)
          .gte('event_datetime', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
        
        // Get Guardian events
        const { data: guardianEvents } = await supabase
          .from('guardian_events')
          .select('detection_time, event_type, severity')
          .ilike('driver_name', `%${driver.first_name}%${driver.last_name}%`)
          .gte('detection_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
        
        // Calculate metrics including volume
        const totalTrips = tripData?.length || 0;
        const totalKm = tripData?.reduce((sum, trip) => sum + (trip.distance_km || 0), 0) || 0;
        const totalHours = tripData?.reduce((sum, trip) => sum + (trip.duration_hours || 0), 0) || 0;
        const totalVolume = tripData?.reduce((sum, trip) => sum + (trip.total_volume_litres || 0), 0) || 0;
        const activeDays = new Set(tripData?.map(trip => trip.start_time?.split('T')[0])).size || 0;
        const lastActivity = tripData?.[0]?.start_time;
        
        const lytxEventCount = lytxEvents?.length || 0;
        const guardianEventCount = guardianEvents?.length || 0;
        const coachingSessions = lytxEvents?.filter(e => e.status === 'Face-To-Face').length || 0;
        
        return {
          id: driver.id,
          first_name: driver.first_name,
          last_name: driver.last_name,
          full_name: `${driver.first_name} ${driver.last_name}`,
          employee_id: driver.employee_id,
          fleet: driver.fleet,
          depot: driver.depot,
          status: driver.status,
          overall_safety_score: driver.safety_score || 0,
          lytx_safety_score: driver.lytx_score || 0,
          guardian_risk_level: 'Low' as const, // Remove meaningless risk classification
          total_trips_30d: totalTrips,
          total_km_30d: Math.round(totalKm),
          total_hours_30d: Math.round(totalHours * 10) / 10,
          total_volume_30d: Math.round(totalVolume),
          active_days_30d: activeDays,
          last_activity_date: lastActivity,
          lytx_events_30d: lytxEventCount,
          guardian_events_30d: guardianEventCount,
          high_risk_events_30d: lytxEvents?.filter(e => (e.score || 0) >= 7).length || 0,
          coaching_sessions_30d: coachingSessions,
        };
      })
    );
    
    return driverSummaries;
  }
  
  /**
   * Get detailed event breakdown for a specific driver
   */
  static async getDriverEventDetails(
    driverId: string,
    timeframe: '30d' | '90d' = '30d'
  ): Promise<{
    lytx_events: Array<{ date: string; trigger_type: string; score: number; status: string }>;
    guardian_events: Array<{ date: string; event_type: string; severity: string }>;
    trip_summary: { total_trips: number; total_km: number; total_hours: number; avg_km_per_trip: number };
  }> {
    
    const days = timeframe === '30d' ? 30 : 90;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    // Get driver name for queries
    const { data: driver } = await supabase
      .from('drivers')
      .select('first_name, last_name')
      .eq('id', driverId)
      .single();
    
    if (!driver) throw new Error('Driver not found');
    
    const driverName = `${driver.first_name} ${driver.last_name}`;
    
    // Get detailed events and trips using foreign key relationships
    const [lytxResult, guardianResult, correlatedTripsResult, uncorrelatedTripsResult] = await Promise.all([
      supabase
        .from('lytx_safety_events')
        .select('event_datetime, trigger_type, score, status')
        .eq('driver_id', driverId)
        .gte('event_datetime', startDate)
        .order('event_datetime', { ascending: false }),
      
      supabase
        .from('guardian_events')
        .select('detection_time, event_type, severity')
        .ilike('driver_name', `%${driverName}%`)
        .gte('detection_time', startDate)
        .order('detection_time', { ascending: false }),
      
      // Get MtData trips using unified approach (foreign key + name fallback)
      supabase.from('mtdata_trip_history')
        .select('start_time, distance_km, duration_hours, total_volume_litres')
        .eq('driver_id', driverId)
        .gte('start_time', startDate),
      
      supabase.from('mtdata_trip_history')
        .select('start_time, distance_km, duration_hours, total_volume_litres')
        .is('driver_id', null)
        .ilike('driver_name', `%${driverName}%`)
        .gte('start_time', startDate)
    ]);
    
    const lytxEvents = lytxResult.data || [];
    const guardianEvents = guardianResult.data || [];
    // Combine correlated and uncorrelated trips for complete picture
    const trips = [...(correlatedTripsResult.data || []), ...(uncorrelatedTripsResult.data || [])];
    
    const totalKm = trips.reduce((sum, trip) => sum + (trip.distance_km || 0), 0);
    const totalHours = trips.reduce((sum, trip) => sum + (trip.duration_hours || 0), 0);
    const totalVolume = trips.reduce((sum, trip) => sum + (trip.total_volume_litres || 0), 0);
    
    return {
      lytx_events: lytxEvents.map(e => ({
        date: e.event_datetime,
        trigger_type: e.trigger_type || 'Unknown',
        score: e.score || 0,
        status: e.status || 'Pending'
      })),
      guardian_events: guardianEvents.map(e => ({
        date: e.detection_time,
        event_type: e.event_type || 'Unknown',
        severity: e.severity || 'Low'
      })),
      trip_summary: {
        total_trips: trips.length,
        total_km: Math.round(totalKm),
        total_hours: Math.round(totalHours * 10) / 10,
        avg_km_per_trip: trips.length > 0 ? Math.round((totalKm / trips.length) * 10) / 10 : 0
      }
    };
  }
  
  // Private helper methods
  private static calculateRiskTrend(lytx: any, guardian: any): 'Improving' | 'Stable' | 'Deteriorating' {
    const lytxTrend = lytx.trend || 0;
    const guardianTrend = guardian.trend || 0;
    const combined = (lytxTrend + guardianTrend) / 2;
    
    if (combined > 10) return 'Deteriorating';
    if (combined < -10) return 'Improving';
    return 'Stable';
  }
  
  private static identifyRiskFactors(lytx: any, guardian: any): string[] {
    const factors: string[] = [];
    
    if (lytx.high_risk_events > 5) factors.push('Frequent high-risk LYTX events');
    if (guardian.fatigue_events > 3) factors.push('Recurring fatigue alerts');
    if (guardian.distraction_events > 5) factors.push('High distraction event count');
    if (lytx.resolution_rate < 70) factors.push('Low event resolution rate');
    
    return factors;
  }
  
  private static generateCoachingRecommendations(lytx: any, guardian: any): string[] {
    const recommendations: string[] = [];
    
    if (lytx.speeding_events > 3) {
      recommendations.push('Focus on speed management and defensive driving techniques');
    }
    
    if (guardian.distraction_events > guardian.fatigue_events) {
      recommendations.push('Implement distraction awareness training and phone usage policies');
    } else if (guardian.fatigue_events > 2) {
      recommendations.push('Review schedule management and rest break compliance');
    }
    
    if (lytx.resolution_rate < 80) {
      recommendations.push('Establish regular coaching follow-up schedule');
    }
    
    return recommendations;
  }
}

export default DriverProfileService;