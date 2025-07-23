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
      console.log('[TANKS DEBUG] Using view: tanks_with_rolling_avg');
      
      // Step 1: Get tank data
      let { data: tankData, error } = await supabase
        .from('tanks_with_rolling_avg')
        .select('*')
        .order('location');

      // If the view is broken (500 error), use base table
      if (error && error.message?.includes('500')) {
        console.log('[TANKS DEBUG] View failed with 500 error, using base table fallback...');
        console.log('[TANKS DEBUG] Error details:', error);
        
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
        
        console.log(`[TANKS DEBUG] Fallback successful - fetched ${baseData?.length || 0} tanks from base table`);

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

        // Combine tank data with latest readings and normalize field names
        tankData = baseData?.map(tank => {
          const latest = latestByTank.get(tank.id);
          const currentLevel = latest?.value || 0;
          const safeLevel = tank.safe_level || 0;
          const minLevel = tank.min_level || 0;
          
          return {
            ...tank,
            // Core fields (ensure correct field names)
            current_level: currentLevel,
            current_level_percent: safeLevel > minLevel 
              ? Math.round(((currentLevel - minLevel) / (safeLevel - minLevel)) * 100)
              : 0,
            last_dip_ts: latest?.created_at || null,
            last_dip_by: latest?.recorded_by || 'Unknown',
            
            // Ensure correct field names (safe_level not safe_fill)
            safe_level: safeLevel,
            min_level: minLevel,
            product_type: tank.product_type || 'Diesel',  // Ensure product_type not product
            
            // Calculated fields that frontend expects
            usable_capacity: Math.max(0, safeLevel - minLevel),
            ullage: Math.max(0, safeLevel - currentLevel),
            
            // Group info with fallback
            group_name: tank.group_name || 'Unknown Group',
            
            // Structured last_dip object that frontend expects
            last_dip: latest ? {
              value: latest.value,
              created_at: latest.created_at,
              recorded_by: latest.recorded_by || 'Unknown'
            } : null,
            
            // Analytics placeholders (will be calculated below)
            rolling_avg: 0,
            prev_day_used: 0,
            days_to_min_level: null
          };
        }) || [];
      }

      if (error && !error.message?.includes('500')) {
        console.error('[TANKS DEBUG] Non-500 error fetching tanks:', error);
        throw error;
      }

      const dataSource = error ? 'base_table_fallback' : 'view';
      console.log(`[TANKS DEBUG] Successfully fetched ${tankData?.length || 0} tanks from ${dataSource}`);
      
      // Log sample of fetched data structure
      if (tankData && tankData.length > 0) {
        console.log('[TANKS DEBUG] Sample tank data structure:', {
          firstTank: Object.keys(tankData[0]),
          hasRollingAvg: 'rolling_avg' in tankData[0],
          hasRollingAvgLpd: 'rolling_avg_lpd' in tankData[0],
          hasUsableCapacity: 'usable_capacity' in tankData[0],
          hasUllage: 'ullage' in tankData[0]
        });
      }

      // Step 2: Get all dip readings for analytics (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: allReadings } = await supabase
        .from('dip_readings')
        .select('tank_id, value, created_at')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      console.log(`[TANKS DEBUG] Fetched ${allReadings?.length || 0} readings for analytics from last 30 days`);

      // Step 3: Calculate analytics for each tank and normalize data structure
      const tanksWithAnalytics = (tankData || []).map(tank => {
        // Normalize field names if coming from view (handle multiple naming conventions)
        const normalizedTank = {
          ...tank,
          // Handle field name variations for analytics
          rolling_avg: tank.rolling_avg ?? tank.rolling_avg_lpd ?? 0,
          
          // Handle product type variations (some views use 'product' instead of 'product_type')
          product_type: tank.product_type ?? tank.product ?? 'Diesel',
          
          // Handle capacity field variations (some views incorrectly use 'safe_fill')
          safe_level: tank.safe_level ?? tank.safe_fill ?? 10000,
          min_level: tank.min_level ?? tank.min_fill ?? 0,
          
          // Ensure required calculated fields exist (use normalized capacity values)
          usable_capacity: tank.usable_capacity ?? Math.max(0, 
            (tank.safe_level ?? tank.safe_fill ?? 10000) - (tank.min_level ?? tank.min_fill ?? 0)
          ),
          ullage: tank.ullage ?? Math.max(0, 
            (tank.safe_level ?? tank.safe_fill ?? 10000) - (tank.current_level || 0)
          ),
          
          // Ensure structured last_dip exists
          last_dip: tank.last_dip ?? (tank.last_dip_ts ? {
            value: tank.current_level || 0,
            created_at: tank.last_dip_ts,
            recorded_by: tank.last_dip_by || 'Unknown'
          } : null)
        };
        
        // Log field name inconsistencies for debugging
        if (tank.safe_fill && !tank.safe_level) {
          console.warn(`[TANKS DEBUG] Tank ${tank.location} using deprecated 'safe_fill' field name`);
        }
        if (tank.product && !tank.product_type) {
          console.warn(`[TANKS DEBUG] Tank ${tank.location} using deprecated 'product' field name`);
        }
        
        // Get readings for this tank
        const tankReadings = (allReadings || [])
          .filter(r => r.tank_id === tank.id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        // Calculate rolling average
        let totalConsumption = 0;
        let totalDays = 0;
        const dailyConsumptions: number[] = [];

        for (let i = 1; i < tankReadings.length; i++) {
          const older = tankReadings[i - 1];
          const newer = tankReadings[i];
          
          const consumption = calculateConsumption(older, newer);
          const days = daysBetween(new Date(older.created_at), new Date(newer.created_at));
          
          if (days > 0 && consumption > 0) {
            const dailyRate = consumption / days;
            dailyConsumptions.push(dailyRate);
            totalConsumption += consumption;
            totalDays += days;
          }
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
          ...normalizedTank,
          // ✅ Analytics calculated and included in tank data
          rolling_avg,
          prev_day_used,
          days_to_min_level,
        };
      });

      console.log(`[TANKS DEBUG] Calculated analytics for ${tanksWithAnalytics.length} tanks`);
      
      // Log analytics calculation summary
      const analyticsValid = tanksWithAnalytics.filter(t => t.rolling_avg > 0).length;
      const hasCurrentLevel = tanksWithAnalytics.filter(t => t.current_level > 0).length;
      console.log(`[TANKS DEBUG] Analytics summary:`, {
        tanksWithValidAnalytics: analyticsValid,
        tanksWithCurrentLevel: hasCurrentLevel,
        sampleTank: tanksWithAnalytics[0] ? {
          location: tanksWithAnalytics[0].location,
          currentLevel: tanksWithAnalytics[0].current_level,
          rollingAvg: tanksWithAnalytics[0].rolling_avg,
          daysToMin: tanksWithAnalytics[0].days_to_min_level
        } : 'No tanks found'
      });
      
      return tanksWithAnalytics;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Data already includes calculated analytics
  const tanks = tanksQuery.data || [];

  console.log('[TANKS DEBUG] Tanks with analytics ready:', {
    totalTanks: tanks.length,
    isArray: Array.isArray(tanks),
    firstTankKeys: tanks[0] ? Object.keys(tanks[0]) : 'No tanks',
    sampleAnalytics: tanks.slice(0, 3).map((t: Tank) => ({
      location: t.location,
      currentLevel: t.current_level,
      currentLevelPercent: t.current_level_percent,
      safeLevel: t.safe_level,
      rollingAvg: t.rolling_avg,
      daysToMin: t.days_to_min_level,
      prevDayUsed: t.prev_day_used,
      hasUsableCapacity: t.usable_capacity !== undefined,
      hasUllage: t.ullage !== undefined
    }))
  });

  // Additional debug: Check for empty or problematic data  
  if (tanks.length === 0) {
    console.error('[TANKS DEBUG] ❌ CRITICAL: No tanks returned from database!');
  } else if (tanks.every(t => !t.location)) {
    console.error('[TANKS DEBUG] ❌ CRITICAL: All tanks missing location field!');
  } else if (tanks.every(t => t.current_level_percent === 0)) {
    console.warn('[TANKS DEBUG] ⚠️ WARNING: All tanks showing 0% - percentage calculation issue');
  } else {
    console.log('[TANKS DEBUG] ✅ Data looks good - tanks have locations and percentages');
  }



  // Debug the query state
  console.log('[TANKS DEBUG] Query State:', {
    isLoading: tanksQuery.isLoading,
    isFetching: tanksQuery.isFetching,
    isError: tanksQuery.isError,
    isPending: tanksQuery.isPending,
    hasError: !!tanksQuery.error,
    errorMessage: tanksQuery.error?.message,
    dataLength: tanks.length
  });

  return {
    tanks,
    data: tanks,  // Keep for backward compatibility
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
