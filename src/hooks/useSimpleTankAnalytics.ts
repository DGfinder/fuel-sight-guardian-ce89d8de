import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Simple analytics that work with your EXISTING database
export interface SimpleTankAnalytics {
  rolling_avg: number;           // L/day - 7-day rolling average
  prev_day_used: number;         // L - fuel used yesterday  
  days_to_min_level: number | null; // days - predicted days until minimum
  weekly_trend: 'increasing' | 'decreasing' | 'stable';
  needs_attention: boolean;
}

// Helper functions
const calculateConsumption = (olderReading: any, newerReading: any): number => {
  if (!olderReading || !newerReading) return 0;
  const consumption = olderReading.value - newerReading.value;
  return Math.max(0, consumption); // Can't be negative
};

const daysBetween = (date1: Date, date2: Date): number => {
  return Math.abs((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
};

// Main hook - works with your existing database!
export const useSimpleTankAnalytics = (tankId: string) => {
  // Get recent readings from your existing dip_readings table
  const { data: recentReadings = [] } = useQuery({
    queryKey: ['simple-tank-analytics', tankId],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      console.log(`[ANALYTICS] Fetching readings for tank ${tankId}`);
      
      const { data, error } = await supabase
        .from('dip_readings')
        .select('id, value, created_at, tank_id')
        .eq('tank_id', tankId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });
        
      if (error) {
        console.error('[ANALYTICS] Error fetching readings:', error);
        return [];
      }
      
      console.log(`[ANALYTICS] Found ${data?.length || 0} readings for tank ${tankId}`);
      return data || [];
    },
    enabled: !!tankId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get tank info from your existing tanks view (or table)
  const { data: tankInfo } = useQuery({
    queryKey: ['tank-info-simple', tankId],
    queryFn: async () => {
      console.log(`[ANALYTICS] Fetching tank info for ${tankId}`);
      
      // Try the existing view first, fallback to basic query
      let query = supabase
        .from('tanks_with_rolling_avg')
        .select('*')
        .eq('id', tankId)
        .single();

      let { data, error } = await query;
      
      // If the view fails (500 error), try the base table
      if (error) {
        console.log('[ANALYTICS] View failed, trying base table...');
        
        const { data: tankData, error: tankError } = await supabase
          .from('fuel_tanks')
          .select(`
            id, location, product_type, safe_level, min_level, 
            group_id, subgroup, created_at, updated_at
          `)
          .eq('id', tankId)
          .single();
          
        if (tankError) {
          console.error('[ANALYTICS] Error fetching tank info:', tankError);
          return null;
        }
        
        // Get latest reading separately
        const { data: latestReading } = await supabase
          .from('dip_readings')
          .select('value, created_at')
          .eq('tank_id', tankId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        // Combine the data
        data = {
          ...tankData,
          current_level: latestReading?.value || 0,
          last_dip_ts: latestReading?.created_at || null,
          current_level_percent: tankData.safe_level > 0 
            ? Math.round(((latestReading?.value || 0) / tankData.safe_level) * 100)
            : 0
        };
      }
      
      console.log(`[ANALYTICS] Tank info fetched:`, {
        location: data?.location,
        currentLevel: data?.current_level,
        safeLevel: data?.safe_level
      });
      
      return data;
    },
    enabled: !!tankId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Calculate analytics
  const analytics: SimpleTankAnalytics = useMemo(() => {
    if (!recentReadings.length || !tankInfo) {
      return {
        rolling_avg: 0,
        prev_day_used: 0,
        days_to_min_level: null,
        weekly_trend: 'stable',
        needs_attention: false,
      };
    }

    const readings = [...recentReadings].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Calculate rolling average
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

    const rolling_avg = totalDays > 0 ? Math.round(totalConsumption / totalDays) : 0;

    // Calculate previous day usage
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const prev_day_used = dailyConsumptions.length > 0 
      ? Math.round(dailyConsumptions[dailyConsumptions.length - 1] || rolling_avg)
      : rolling_avg;

    // Calculate days to minimum
    const currentLevel = tankInfo.current_level || 0;
    const minLevel = tankInfo.min_level || 0;
    const availableFuel = Math.max(0, currentLevel - minLevel);
    
    const days_to_min_level = rolling_avg > 0 
      ? Math.round((availableFuel / rolling_avg) * 10) / 10
      : null;

    // Calculate weekly trend
    const recentWeek = dailyConsumptions.slice(-7);
    const previousWeek = dailyConsumptions.slice(-14, -7);
    
    let weekly_trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recentWeek.length >= 3 && previousWeek.length >= 3) {
      const recentAvg = recentWeek.reduce((a, b) => a + b, 0) / recentWeek.length;
      const previousAvg = previousWeek.reduce((a, b) => a + b, 0) / previousWeek.length;
      
      const change = (recentAvg - previousAvg) / previousAvg;
      if (change > 0.15) weekly_trend = 'increasing';
      else if (change < -0.15) weekly_trend = 'decreasing';
    }

    // Determine if needs attention
    const levelPercent = tankInfo.current_level_percent || 0;
    const needs_attention = (
      levelPercent < 15 || 
      (days_to_min_level !== null && days_to_min_level < 7) ||
      weekly_trend === 'increasing'
    );

    console.log(`[ANALYTICS] Calculated for ${tankInfo.location}:`, {
      rolling_avg,
      prev_day_used,
      days_to_min_level,
      weekly_trend,
      needs_attention,
      readingsUsed: readings.length
    });

    return {
      rolling_avg,
      prev_day_used,
      days_to_min_level,
      weekly_trend,
      needs_attention,
    };

  }, [recentReadings, tankInfo]);

  return {
    analytics,
    isLoading: !recentReadings.length || !tankInfo,
    error: null,
  };
};

export default useSimpleTankAnalytics; 