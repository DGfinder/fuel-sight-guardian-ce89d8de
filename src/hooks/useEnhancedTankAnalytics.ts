import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Tank } from '../hooks/useTanks';

// Type definitions for enhanced analytics
export interface DipReading {
  id: string;
  tank_id: string;
  value: number;
  created_at: string;
  recorded_by: string;
  notes?: string;
}

export interface TankAnalytics {
  // Basic data from simplified view
  tank: Tank;
  
  // Calculated analytics (moved from database)
  rolling_avg_lpd: number;
  prev_day_used: number;
  days_to_min_level: number | null;
  
  // Enhanced analytics
  last_7_days_consumption: number;
  last_30_days_consumption: number;
  consumption_trend: 'increasing' | 'decreasing' | 'stable';
  predicted_empty_date: string | null;
  refill_events: RefillEvent[];
  
  // Status calculations
  status: 'critical' | 'low' | 'normal';
  is_critical: boolean;
  days_until_critical: number | null;
}

export interface RefillEvent {
  date: string;
  amount: number;
  reading_before: number;
  reading_after: number;
}

/**
 * Enhanced Tank Analytics Hook
 * 
 * This hook replaces the complex database view calculations with frontend processing.
 * Benefits:
 * - More stable than database CTEs
 * - Easier to debug and modify
 * - Better performance by avoiding complex SQL
 * - Can use cached data efficiently
 */
export function useEnhancedTankAnalytics(tankId: string | undefined, enabled = true) {
  // Fetch basic tank data from simplified view
  const { data: basicTankData } = useQuery({
    queryKey: ['tank-basic-data', tankId],
    queryFn: async () => {
      if (!tankId) return null;
      
      const { data, error } = await supabase
        .from('tanks_basic_data') // Use our new simplified view
        .select('*')
        .eq('id', tankId)
        .single();
        
      if (error) throw error;
      return data as Tank;
    },
    enabled: enabled && !!tankId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch recent dip readings for analytics
  const { data: dipReadings } = useQuery({
    queryKey: ['tank-dip-readings', tankId],
    queryFn: async () => {
      if (!tankId) return [];
      
      const { data, error } = await supabase
        .from('dip_readings')
        .select('id, tank_id, value, created_at, recorded_by, notes')
        .eq('tank_id', tankId)
        .is('archived_at', null) // Only active readings
        .order('created_at', { ascending: false })
        .limit(100); // Get more data for better analytics
        
      if (error) throw error;
      return data as DipReading[];
    },
    enabled: enabled && !!tankId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Calculate enhanced analytics from the raw data
  const analytics = useMemo((): TankAnalytics | null => {
    if (!basicTankData || !dipReadings || dipReadings.length === 0) {
      return null;
    }

    // Sort readings chronologically for calculations
    const sortedReadings = [...dipReadings].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Calculate rolling average (last 7 days)
    const rolling_avg_lpd = calculateRollingAverage(sortedReadings, 7);
    
    // Calculate previous day usage
    const prev_day_used = calculatePreviousDayUsage(sortedReadings);
    
    // Calculate days to minimum level
    const days_to_min_level = calculateDaysToMinLevel(
      basicTankData.current_level || 0,
      basicTankData.min_level || 0,
      rolling_avg_lpd
    );
    
    // Enhanced analytics
    const last_7_days_consumption = calculateConsumption(sortedReadings, 7);
    const last_30_days_consumption = calculateConsumption(sortedReadings, 30);
    const consumption_trend = calculateConsumptionTrend(sortedReadings);
    const predicted_empty_date = calculatePredictedEmptyDate(
      basicTankData.current_level || 0,
      basicTankData.min_level || 0,
      rolling_avg_lpd
    );
    const refill_events = detectRefillEvents(sortedReadings);
    
    // Status calculations
    const current_level_percent = basicTankData.current_level_percent || 0;
    const status = calculateStatus(current_level_percent, days_to_min_level);
    const is_critical = status === 'critical';
    const days_until_critical = calculateDaysUntilCritical(
      basicTankData.current_level || 0,
      basicTankData.safe_level || 0,
      rolling_avg_lpd
    );

    return {
      tank: basicTankData,
      rolling_avg_lpd,
      prev_day_used,
      days_to_min_level,
      last_7_days_consumption,
      last_30_days_consumption,
      consumption_trend,
      predicted_empty_date,
      refill_events,
      status,
      is_critical,
      days_until_critical,
    };
  }, [basicTankData, dipReadings]);

  return {
    data: analytics,
    isLoading: !basicTankData || !dipReadings,
    tank: basicTankData,
    readings: dipReadings,
  };
}

// Helper functions for calculations

function calculateRollingAverage(readings: DipReading[], days: number): number {
  if (readings.length < 2) return 0;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const recentReadings = readings.filter(
    r => new Date(r.created_at) >= cutoffDate
  );
  
  if (recentReadings.length < 2) return 0;
  
  let totalConsumption = 0;
  let totalDays = 0;
  
  for (let i = 1; i < recentReadings.length; i++) {
    const current = recentReadings[i];
    const previous = recentReadings[i - 1];
    
    const consumption = previous.value - current.value; // Positive = fuel consumed
    const daysDiff = Math.abs(
      (new Date(current.created_at).getTime() - new Date(previous.created_at).getTime()) 
      / (1000 * 60 * 60 * 24)
    );
    
    // Only include consumption periods (ignore refills)
    if (consumption > 0 && daysDiff > 0 && daysDiff < 7) {
      totalConsumption += consumption;
      totalDays += daysDiff;
    }
  }
  
  return totalDays > 0 ? Math.round(totalConsumption / totalDays) : 0;
}

function calculatePreviousDayUsage(readings: DipReading[]): number {
  if (readings.length < 2) return 0;
  
  const sortedReadings = readings.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  
  // Find readings from the last 24-48 hours
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  
  const recentReading = sortedReadings.find(r => new Date(r.created_at) >= yesterday);
  const previousReading = sortedReadings.find(r => 
    new Date(r.created_at) >= twoDaysAgo && 
    new Date(r.created_at) < yesterday
  );
  
  if (!recentReading || !previousReading) return 0;
  
  const consumption = Math.max(0, previousReading.value - recentReading.value);
  return Math.round(consumption);
}

function calculateDaysToMinLevel(
  currentLevel: number, 
  minLevel: number, 
  avgConsumption: number
): number | null {
  if (avgConsumption <= 0 || currentLevel <= minLevel) return null;
  
  const availableFuel = currentLevel - minLevel;
  const days = availableFuel / avgConsumption;
  
  return days > 0 ? Math.round(days * 10) / 10 : null; // Round to 1 decimal
}

function calculateConsumption(readings: DipReading[], days: number): number {
  if (readings.length < 2) return 0;
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const recentReadings = readings.filter(
    r => new Date(r.created_at) >= cutoffDate
  ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  
  if (recentReadings.length < 2) return 0;
  
  const firstReading = recentReadings[0];
  const lastReading = recentReadings[recentReadings.length - 1];
  
  // Calculate net consumption (ignoring refills)
  let totalConsumption = 0;
  for (let i = 1; i < recentReadings.length; i++) {
    const consumption = recentReadings[i - 1].value - recentReadings[i].value;
    if (consumption > 0) { // Only count consumption, not refills
      totalConsumption += consumption;
    }
  }
  
  return Math.round(totalConsumption);
}

function calculateConsumptionTrend(readings: DipReading[]): 'increasing' | 'decreasing' | 'stable' {
  if (readings.length < 4) return 'stable';
  
  const recent7Days = calculateConsumption(readings, 7);
  const previous7Days = calculateConsumption(readings.slice(7), 7);
  
  const difference = recent7Days - previous7Days;
  const threshold = Math.max(100, previous7Days * 0.2); // 20% change threshold
  
  if (difference > threshold) return 'increasing';
  if (difference < -threshold) return 'decreasing';
  return 'stable';
}

function calculatePredictedEmptyDate(
  currentLevel: number,
  minLevel: number,
  avgConsumption: number
): string | null {
  const daysToMin = calculateDaysToMinLevel(currentLevel, minLevel, avgConsumption);
  if (!daysToMin) return null;
  
  const emptyDate = new Date();
  emptyDate.setDate(emptyDate.getDate() + daysToMin);
  
  return emptyDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
}

function detectRefillEvents(readings: DipReading[]): RefillEvent[] {
  if (readings.length < 2) return [];
  
  const refills: RefillEvent[] = [];
  const sortedReadings = readings.sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  for (let i = 1; i < sortedReadings.length; i++) {
    const current = sortedReadings[i];
    const previous = sortedReadings[i - 1];
    
    // Detect refill: significant increase in fuel level
    const increase = current.value - previous.value;
    const threshold = 1000; // Minimum 1000L increase to count as refill
    
    if (increase >= threshold) {
      refills.push({
        date: current.created_at,
        amount: Math.round(increase),
        reading_before: previous.value,
        reading_after: current.value,
      });
    }
  }
  
  return refills;
}

function calculateStatus(
  levelPercent: number, 
  daysToMin: number | null
): 'critical' | 'low' | 'normal' {
  if (levelPercent <= 10 || (daysToMin !== null && daysToMin <= 1.5)) {
    return 'critical';
  }
  if (levelPercent <= 20 || (daysToMin !== null && daysToMin <= 3)) {
    return 'low';
  }
  return 'normal';
}

function calculateDaysUntilCritical(
  currentLevel: number,
  safeLevel: number,
  avgConsumption: number
): number | null {
  if (avgConsumption <= 0) return null;
  
  const criticalLevel = safeLevel * 0.1; // 10% is critical
  const fuelUntilCritical = currentLevel - criticalLevel;
  
  if (fuelUntilCritical <= 0) return 0;
  
  const days = fuelUntilCritical / avgConsumption;
  return days > 0 ? Math.round(days * 10) / 10 : null;
} 