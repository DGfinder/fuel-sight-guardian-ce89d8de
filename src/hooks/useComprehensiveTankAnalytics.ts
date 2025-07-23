import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Types for our analytics
export interface TankAnalytics {
  // Core metrics
  rolling_avg: number;           // L/day - 7-day rolling average consumption
  prev_day_used: number;         // L - fuel used yesterday
  days_to_min_level: number | null; // days - predicted days until minimum level
  
  // Advanced metrics  
  weekly_trend: 'increasing' | 'decreasing' | 'stable';
  consumption_pattern: 'consistent' | 'variable' | 'seasonal';
  efficiency_score: number;     // 0-100 - how efficiently tank is managed
  
  // Predictions
  predicted_empty_date: Date | null;
  recommended_order_date: Date | null;
  optimal_delivery_amount: number;
  
  // Status indicators
  is_trending_up: boolean;
  is_consumption_normal: boolean;
  needs_attention: boolean;
}

// Helper function to calculate consumption between two readings
const calculateConsumption = (olderReading: any, newerReading: any): number => {
  if (!olderReading || !newerReading) return 0;
  
  const consumption = olderReading.value - newerReading.value;
  return Math.max(0, consumption); // Consumption can't be negative (ignore refills)
};

// Calculate days between two dates
const daysBetween = (date1: Date, date2: Date): number => {
  return Math.abs((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
};

// Main analytics hook
export const useComprehensiveTankAnalytics = (tankId: string) => {
  // Fetch recent readings for calculations (last 30 days)
  const { data: recentReadings = [] } = useQuery({
    queryKey: ['tank-readings-analytics', tankId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data, error } = await supabase
        .from('dip_readings')
        .select('*')
        .eq('tank_id', tankId)
        .is('archived_at', null)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error('[ANALYTICS] Error fetching readings:', error);
        return [];
      }
      
      return data || [];
    },
    enabled: !!tankId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch current tank info
  const { data: tankInfo } = useQuery({
    queryKey: ['tank-info-analytics', tankId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tanks_basic_data')
        .select('*')
        .eq('id', tankId)
        .single();
        
      if (error) {
        console.error('[ANALYTICS] Error fetching tank info:', error);
        return null;
      }
      
      return data;
    },
    enabled: !!tankId,
  });

  // Calculate comprehensive analytics
  const analytics: TankAnalytics = useMemo(() => {
    if (!recentReadings.length || !tankInfo) {
      return {
        rolling_avg: 0,
        prev_day_used: 0,
        days_to_min_level: null,
        weekly_trend: 'stable',
        consumption_pattern: 'consistent',
        efficiency_score: 0,
        predicted_empty_date: null,
        recommended_order_date: null,
        optimal_delivery_amount: 0,
        is_trending_up: false,
        is_consumption_normal: true,
        needs_attention: false,
      };
    }

    const readings = [...recentReadings].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // ========================================
    // 1. ROLLING AVERAGE CALCULATION (7-day)
    // ========================================
    let totalConsumption = 0;
    let totalDays = 0;
    const dailyConsumptions: number[] = [];

    for (let i = 1; i < readings.length; i++) {
      const older = readings[i - 1];
      const newer = readings[i];
      
      const consumption = calculateConsumption(older, newer);
      const days = daysBetween(new Date(older.created_at), new Date(newer.created_at));
      
      if (days > 0 && consumption > 0) {
        const dailyRate = consumption / days;
        dailyConsumptions.push(dailyRate);
        totalConsumption += consumption;
        totalDays += days;
      }
    }

    const rolling_avg = totalDays > 0 ? totalConsumption / totalDays : 0;

    // ========================================
    // 2. PREVIOUS DAY USAGE
    // ========================================
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    
    const dayBeforeYesterday = new Date(yesterday);
    dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);

    // Find readings around yesterday
    const yesterdayReading = readings.find(r => {
      const readingDate = new Date(r.created_at);
      return readingDate >= yesterday && readingDate < new Date(yesterday.getTime() + 24 * 60 * 60 * 1000);
    });

    const dayBeforeReading = readings.find(r => {
      const readingDate = new Date(r.created_at);
      return readingDate >= dayBeforeYesterday && readingDate < yesterday;
    });

    const prev_day_used = (yesterdayReading && dayBeforeReading) 
      ? calculateConsumption(dayBeforeReading, yesterdayReading)
      : rolling_avg; // Fallback to average if no specific readings

    // ========================================
    // 3. DAYS TO MINIMUM LEVEL
    // ========================================
    const currentLevel = tankInfo.current_level || 0;
    const minLevel = tankInfo.min_level || 0;
    const availableFuel = Math.max(0, currentLevel - minLevel);
    
    const days_to_min_level = rolling_avg > 0 
      ? Math.round((availableFuel / rolling_avg) * 10) / 10 // Round to 1 decimal
      : null;

    // ========================================
    // 4. WEEKLY TREND ANALYSIS
    // ========================================
    const recentWeek = dailyConsumptions.slice(-7);
    const previousWeek = dailyConsumptions.slice(-14, -7);
    
    let weekly_trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recentWeek.length >= 3 && previousWeek.length >= 3) {
      const recentAvg = recentWeek.reduce((a, b) => a + b, 0) / recentWeek.length;
      const previousAvg = previousWeek.reduce((a, b) => a + b, 0) / previousWeek.length;
      
      const change = (recentAvg - previousAvg) / previousAvg;
      if (change > 0.15) weekly_trend = 'increasing';      // 15% increase
      else if (change < -0.15) weekly_trend = 'decreasing'; // 15% decrease
    }

    // ========================================
    // 5. CONSUMPTION PATTERN ANALYSIS
    // ========================================
    const variance = dailyConsumptions.length > 1 
      ? dailyConsumptions.reduce((sum, val) => sum + Math.pow(val - rolling_avg, 2), 0) / dailyConsumptions.length
      : 0;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = rolling_avg > 0 ? standardDeviation / rolling_avg : 0;

    let consumption_pattern: 'consistent' | 'variable' | 'seasonal' = 'consistent';
    if (coefficientOfVariation > 0.5) consumption_pattern = 'variable';
    else if (coefficientOfVariation > 0.3) consumption_pattern = 'seasonal';

    // ========================================
    // 6. EFFICIENCY SCORE (0-100)
    // ========================================
    let efficiency_score = 100;
    
    // Penalty for high variability
    efficiency_score -= Math.min(30, coefficientOfVariation * 50);
    
    // Penalty if tank level is too low
    const levelPercent = tankInfo.current_level_percent || 0;
    if (levelPercent < 10) efficiency_score -= 30;
    else if (levelPercent < 20) efficiency_score -= 15;
    
    // Penalty if consumption trend is rapidly increasing
    if (weekly_trend === 'increasing') efficiency_score -= 10;
    
    efficiency_score = Math.max(0, Math.round(efficiency_score));

    // =======================================
    // 7. PREDICTIONS
    // =======================================
    const predicted_empty_date = days_to_min_level 
      ? new Date(Date.now() + (days_to_min_level * 24 * 60 * 60 * 1000))
      : null;

    // Recommend ordering when 5 days remain (or 20% capacity, whichever is sooner)
    const daysForOrdering = Math.min(5, days_to_min_level ? days_to_min_level * 0.8 : 5);
    const recommended_order_date = days_to_min_level && days_to_min_level > daysForOrdering
      ? new Date(Date.now() + ((days_to_min_level - daysForOrdering) * 24 * 60 * 60 * 1000))
      : new Date(); // Order now if close to minimum

    // Optimal delivery amount = current usage * delivery lead time + safety buffer
    const deliveryLeadTimeDays = 3; // Assume 3-day delivery lead time
    const safetyBufferDays = 7;     // 1 week safety buffer
    const optimal_delivery_amount = rolling_avg * (deliveryLeadTimeDays + safetyBufferDays);

    // =======================================
    // 8. STATUS INDICATORS
    // =======================================
    const is_trending_up = weekly_trend === 'increasing';
    const is_consumption_normal = coefficientOfVariation < 0.4; // Less than 40% variation
    const needs_attention = (
      levelPercent < 15 || 
      (days_to_min_level !== null && days_to_min_level < 7) ||
      efficiency_score < 60 ||
      consumption_pattern === 'variable'
    );

    console.log('[ANALYTICS] Calculated comprehensive analytics:', {
      tankId,
      readingsCount: readings.length,
      rolling_avg,
      prev_day_used,
      days_to_min_level,
      weekly_trend,
      efficiency_score,
      needs_attention
    });

    return {
      rolling_avg: Math.round(rolling_avg),
      prev_day_used: Math.round(prev_day_used),
      days_to_min_level,
      weekly_trend,
      consumption_pattern,
      efficiency_score,
      predicted_empty_date,
      recommended_order_date,
      optimal_delivery_amount: Math.round(optimal_delivery_amount),
      is_trending_up,
      is_consumption_normal,
      needs_attention,
    };

  }, [recentReadings, tankInfo]);

  return {
    analytics,
    isLoading: !recentReadings.length || !tankInfo,
    error: null,
  };
};

// Export individual calculation functions for testing
export const analyticsUtils = {
  calculateConsumption,
  daysBetween,
};

export default useComprehensiveTankAnalytics; 