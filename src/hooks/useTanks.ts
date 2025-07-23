import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Helper functions for analytics calculations
const calculateConsumption = (olderReading: any, newerReading: any): number => {
  if (!olderReading || !newerReading) return 0;
  const consumption = olderReading.value - newerReading.value;
  return Math.max(0, consumption);
};

const daysBetween = (date1: Date, date2: Date): number => {
  return Math.abs((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
};

export interface Tank {
  id: string;
  location: string;
  product_type: string;
  safe_level: number;
  min_level: number;
  group_id: string | null;
  group_name: string;
  subgroup: string;
  current_level: number;
  last_dip_ts: string | null;
  last_dip_by: string;
  current_level_percent: number;
  
  // ✅ WORKING ANALYTICS (calculated in frontend)
  rolling_avg: number;           // L/day - 7-day rolling average  
  prev_day_used: number;         // L - fuel used yesterday
  days_to_min_level: number | null; // days - predicted days until minimum
  
  // Additional fields
  usable_capacity: number;
  ullage: number;
  address?: string;
  vehicle?: string;
  discharge?: string;
  bp_portal?: string;
  delivery_window?: string;
  afterhours_contact?: string;
  notes?: string;
  serviced_on?: string;
  serviced_by?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}

// Enhanced hook that provides tanks with comprehensive analytics
export const useTanks = () => {
  const queryClient = useQueryClient();

  // Fetch tank data from your existing database and calculate analytics
  const tanksQuery = useQuery({
    queryKey: ['tanks-with-analytics'],
    queryFn: async () => {
      console.log('[TANKS DEBUG] Fetching tanks and calculating analytics...');
      
      // Step 1: Get tank data
      let { data: tankData, error } = await supabase
        .from('tanks_with_rolling_avg')
        .select('*')
        .order('location');

      // If the view is broken (500 error), use base table
      if (error && error.message?.includes('500')) {
        console.log('[TANKS DEBUG] View failed, using base table...');
        
        const { data: baseData, error: baseError } = await supabase
          .from('fuel_tanks')
          .select(`
            id, location, product_type, safe_level, min_level, 
            group_id, subgroup, address, vehicle, discharge, 
            bp_portal, delivery_window, afterhours_contact, 
            notes, serviced_on, serviced_by, latitude, longitude,
            created_at, updated_at
          `)
          .order('location');

        if (baseError) {
          console.error('[TANKS DEBUG] Error fetching from base table:', baseError);
          throw baseError;
        }

        // Get current levels from latest dip readings
        const tankIds = baseData?.map(t => t.id) || [];
        const { data: latestReadings } = await supabase
          .from('dip_readings')
          .select('tank_id, value, created_at')
          .in('tank_id', tankIds)
          .order('created_at', { ascending: false });

        // Get latest reading per tank
        const latestByTank = new Map();
        latestReadings?.forEach(reading => {
          if (!latestByTank.has(reading.tank_id)) {
            latestByTank.set(reading.tank_id, reading);
          }
        });

        // Combine tank data with latest readings
        tankData = baseData?.map(tank => {
          const latest = latestByTank.get(tank.id);
          return {
            ...tank,
            current_level: latest?.value || 0,
            current_level_percent: tank.safe_level > 0 
              ? Math.round(((latest?.value || 0) / tank.safe_level) * 100)
              : 0,
            last_dip_ts: latest?.created_at || null,
            last_dip_by: 'Unknown',
            usable_capacity: (tank.safe_level || 0) - (tank.min_level || 0),
            ullage: (tank.safe_level || 0) - (latest?.value || 0),
            group_name: 'Unknown Group'
          };
        }) || [];
      }

      if (error && !error.message?.includes('500')) {
        console.error('[TANKS DEBUG] Error fetching tanks:', error);
        throw error;
      }

      console.log(`[TANKS DEBUG] Successfully fetched ${tankData?.length || 0} tanks`);

      // Step 2: Get all dip readings for analytics (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: allReadings } = await supabase
        .from('dip_readings')
        .select('tank_id, value, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      console.log(`[TANKS DEBUG] Fetched ${allReadings?.length || 0} readings for analytics`);

      // Step 3: Calculate analytics for each tank
      const tanksWithAnalytics = (tankData || []).map(tank => {
        // Get readings for this tank
        const tankReadings = (allReadings || [])
          .filter(r => r.tank_id === tank.id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        // DEBUG: Log tank reading info
        if (tank.location === 'Alkimos' || tank.location === 'Beckenham' || tank.location === 'Beenyup') {
          console.log(`[ANALYTICS DEBUG] Tank ${tank.location}:`, {
            totalReadings: tankReadings.length,
            firstReading: tankReadings[0],
            lastReading: tankReadings[tankReadings.length - 1]
          });
        }

        // Calculate rolling average
        let totalConsumption = 0;
        let totalDays = 0;
        const dailyConsumptions: number[] = [];
        let debugConsumptions: any[] = [];

        for (let i = 1; i < tankReadings.length; i++) {
          const older = tankReadings[i - 1];
          const newer = tankReadings[i];
          
          const consumption = calculateConsumption(older, newer);
          const days = daysBetween(new Date(older.created_at), new Date(newer.created_at));
          
          // DEBUG: Log consumption calculations
          if (tank.location === 'Alkimos' || tank.location === 'Beckenham' || tank.location === 'Beenyup') {
            debugConsumptions.push({
              olderValue: older.value,
              newerValue: newer.value,
              consumption,
              days,
              dailyRate: days > 0 ? consumption / days : 0,
              included: days > 0 && consumption > 0
            });
          }
          
          if (days > 0 && consumption > 0) {
            const dailyRate = consumption / days;
            dailyConsumptions.push(dailyRate);
            totalConsumption += consumption;
            totalDays += days;
          }
        }

        // DEBUG: Log final calculations
        if (tank.location === 'Alkimos' || tank.location === 'Beckenham' || tank.location === 'Beenyup') {
          console.log(`[ANALYTICS DEBUG] ${tank.location} calculations:`, {
            debugConsumptions: debugConsumptions.slice(0, 3), // First 3 calculations
            totalConsumption,
            totalDays,
            validConsumptions: dailyConsumptions.length
          });
        }

        // If no valid consumption data, try alternative calculation
        let rolling_avg = totalDays > 0 ? Math.round(totalConsumption / totalDays) : 0;
        
        // FALLBACK: If no consumption detected, estimate from overall level change
        if (rolling_avg === 0 && tankReadings.length >= 2) {
          const firstReading = tankReadings[0];
          const lastReading = tankReadings[tankReadings.length - 1];
          const totalChange = firstReading.value - lastReading.value;
          const totalDaysSpan = daysBetween(new Date(firstReading.created_at), new Date(lastReading.created_at));
          
          if (totalDaysSpan > 0 && totalChange > 0) {
            rolling_avg = Math.round(totalChange / totalDaysSpan);
            
            // DEBUG: Log fallback calculation
            if (tank.location === 'Alkimos' || tank.location === 'Beckenham' || tank.location === 'Beenyup') {
              console.log(`[ANALYTICS DEBUG] ${tank.location} FALLBACK calculation:`, {
                firstValue: firstReading.value,
                lastValue: lastReading.value,
                totalChange,
                totalDaysSpan,
                fallbackAvg: rolling_avg
              });
            }
          }
        }

        // Calculate previous day usage
        const prev_day_used = dailyConsumptions.length > 0 
          ? Math.round(dailyConsumptions[dailyConsumptions.length - 1] || rolling_avg)
          : rolling_avg;

        // Calculate days to minimum
        const currentLevel = tank.current_level || 0;
        const minLevel = tank.min_level || 0;
        const availableFuel = Math.max(0, currentLevel - minLevel);
        
        const days_to_min_level = rolling_avg > 0 
          ? Math.round((availableFuel / rolling_avg) * 10) / 10
          : null;

        return {
          ...tank,
          // ✅ Analytics calculated and included in tank data
          rolling_avg,
          prev_day_used,
          days_to_min_level,
        };
      });

      console.log(`[TANKS DEBUG] Calculated analytics for ${tanksWithAnalytics.length} tanks`);
      
      return tanksWithAnalytics;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Data already includes calculated analytics
  const tanks = tanksQuery.data || [];

  console.log('[TANKS DEBUG] Tanks with analytics ready:', {
    totalTanks: tanks.length,
    sampleAnalytics: tanks.slice(0, 3).map((t: Tank) => ({
      location: t.location,
      currentLevel: t.current_level,
      rollingAvg: t.rolling_avg,
      daysToMin: t.days_to_min_level,
      prevDayUsed: t.prev_day_used
    }))
  });

  // DETAILED DEBUG: Show actual tank values
  if (tanks.length > 0) {
    const firstTank = tanks[0];
    console.log('[TANKS DEBUG] First tank detailed values:', {
      location: firstTank.location,
      rolling_avg: firstTank.rolling_avg,
      prev_day_used: firstTank.prev_day_used,
      days_to_min_level: firstTank.days_to_min_level,
      current_level: firstTank.current_level,
      allProperties: Object.keys(firstTank)
    });
  }

  return {
    data: tanks,
    isLoading: tanksQuery.isLoading,
    error: tanksQuery.error,
    refetch: tanksQuery.refetch,
    
    // Utility functions
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ['tanks-with-analytics'] });
    },
    
    // Analytics summary
    getAnalyticsSummary: () => {
      if (!tanks.length) return null;
      
      const tanksWithData = tanks.filter((t: Tank) => t.rolling_avg > 0);
      
      return {
        totalTanks: tanks.length,
        tanksWithAnalytics: tanksWithData.length,
        avgRollingConsumption: tanksWithData.length > 0 
          ? Math.round(tanksWithData.reduce((sum: number, t: Tank) => sum + t.rolling_avg, 0) / tanksWithData.length)
          : 0,
        tanksNeedingAttention: tanks.filter((t: Tank) => 
          t.current_level_percent < 15 || 
          (t.days_to_min_level !== null && t.days_to_min_level < 7)
        ).length,
        totalDailyConsumption: Math.round(tanksWithData.reduce((sum: number, t: Tank) => sum + t.rolling_avg, 0))
      };
    }
  };
};

// Legacy hook name for backward compatibility
export const useTanksData = useTanks;
