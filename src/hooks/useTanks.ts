import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { generateAlerts } from '../lib/alertService';
import { validateTimestamp } from '../utils/timezone';

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
  prev_day_used: number;         // L - fuel used yesterday (negative = consumption, positive = refill)
  is_recent_refill: boolean;     // true if prev_day_used represents a refill
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
    enabled: true, // We'll handle auth checks inside the queryFn
    queryFn: async () => {
      // Fetching tanks with analytics
      
      try {
        // Step 0: Check authentication before making queries
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) {
          console.log('[TANKS DEBUG] No authenticated user - skipping query');
          return []; // Return empty array instead of throwing error to prevent console spam
        }
      
      // Step 1: Get ALL tank data from fuel_tanks table (single source of truth)
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
        console.error('[TANKS DEBUG] Error fetching tanks from base table:', baseError);
        throw baseError;
      }
      

      // Step 2: Get group names from tank_groups table
      const uniqueGroupIds = [...new Set(baseData?.map(t => t.group_id).filter(Boolean))];
      const { data: groupData } = await supabase
        .from('tank_groups')
        .select('id, name')
        .in('id', uniqueGroupIds);

      // Create a map of group_id to group_name for fast lookup
      const groupNameMap = new Map();
      groupData?.forEach(group => {
        groupNameMap.set(group.id, group.name);
      });


      // Step 3: Get current levels from latest dip readings (optimized with limit)
      const tankIds = baseData?.map(t => t.id) || [];
      const { data: latestReadings } = await supabase
        .from('dip_readings')
        .select('tank_id, value, created_at, recorded_by')
        .in('tank_id', tankIds)
        .order('created_at', { ascending: false })
        .limit(1000); // Limit to most recent 1000 readings for performance

      // Get latest reading per tank
      const latestByTank = new Map();
      latestReadings?.forEach(reading => {
        if (!latestByTank.has(reading.tank_id)) {
          // Validate timestamp and log any data quality issues
          if (reading.created_at) {
            const validation = validateTimestamp(reading.created_at);
            if (validation.issues.length > 0) {
              console.warn(`[TANK DATA QUALITY] Tank ${reading.tank_id} reading has issues:`, {
                timestamp: reading.created_at,
                issues: validation.issues,
                isFuture: validation.isFuture,
                age: validation.age
              });
            }
          }
          latestByTank.set(reading.tank_id, reading);
        }
      });

      // Step 4: Combine tank data with latest readings
      const tankData = baseData?.map(tank => {
        const latest = latestByTank.get(tank.id);
        const currentLevel = latest?.value ?? null; // Use null instead of 0 for missing readings
        const safeLevel = tank.safe_level || 0;
        const minLevel = tank.min_level || 0;
        
        return {
          ...tank,
          // Core fields with current readings
          current_level: currentLevel,
          current_level_percent: currentLevel !== null && safeLevel > minLevel 
            ? Math.round(((currentLevel - minLevel) / (safeLevel - minLevel)) * 100)
            : null, // Use null when no reading available
          last_dip_ts: latest?.created_at || null,
          last_dip_by: latest?.recorded_by || 'Unknown',
          
          // Ensure consistent field names
          safe_level: safeLevel,
          min_level: minLevel,
          product_type: tank.product_type || 'Diesel',
          
          // Calculated fields
          usable_capacity: Math.max(0, safeLevel - minLevel),
          ullage: Math.max(0, safeLevel - currentLevel),
          
          // Group info with fallback - use the fetched group name
          group_name: groupNameMap.get(tank.group_id) || 'Unknown Group',
          
          // Structured last_dip object
          last_dip: latest ? {
            value: latest.value,
            created_at: latest.created_at,
            recorded_by: latest.recorded_by || 'Unknown'
          } : null,
          
          // Analytics placeholders (calculated below)
          rolling_avg: 0,
          prev_day_used: 0,
          days_to_min_level: null
        };
      }) || [];


      // Step 5: Get dip readings for analytics (optimized query)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: allReadings } = await supabase
        .from('dip_readings')
        .select('tank_id, value, created_at')
        .in('tank_id', tankIds)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true })
        .limit(500); // Limit analytics readings for better performance


      // Step 6: Calculate analytics for each tank (optimized processing)
      // Pre-group readings by tank_id for faster lookup
      const readingsByTank = new Map();
      (allReadings || []).forEach(reading => {
        if (!readingsByTank.has(reading.tank_id)) {
          readingsByTank.set(reading.tank_id, []);
        }
        readingsByTank.get(reading.tank_id).push(reading);
      });
      
      const tanksWithAnalytics = (tankData || []).map(tank => {
        // Get pre-grouped readings for this tank (already time-ordered from query)
        const tankReadings = readingsByTank.get(tank.id) || [];

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

        // Calculate previous day usage (latest minus previous reading)
        let prev_day_used = 0;
        let isRefill = false;
        
        if (tankReadings.length >= 2) {
          const latestReading = tankReadings[tankReadings.length - 1];
          const previousReading = tankReadings[tankReadings.length - 2];
          const rawDifference = latestReading.value - previousReading.value;
          
          // Business logic: Detect if this is likely a refill
          // If the increase is >= 100L, it's likely a refill or top-up
          const REFILL_THRESHOLD = 100;
          isRefill = rawDifference >= REFILL_THRESHOLD;
          
          // Always preserve the actual raw difference
          // Positive = refill/increase, Negative = consumption/decrease
          prev_day_used = rawDifference;
          
          // Debug logging for Alkimos tank specifically
          if (tank.location && tank.location.toLowerCase().includes('alkimos')) {
            console.log(`[ALKIMOS DEBUG] Tank: ${tank.location}`);
            console.log(`[ALKIMOS DEBUG] Total readings: ${tankReadings.length}`);
            console.log(`[ALKIMOS DEBUG] Latest reading: ${JSON.stringify({
              value: latestReading.value,
              date: latestReading.created_at,
              isLatest: true
            })}`);
            console.log(`[ALKIMOS DEBUG] Previous reading: ${JSON.stringify({
              value: previousReading.value,
              date: previousReading.created_at,
              isPrevious: true
            })}`);
            console.log(`[ALKIMOS DEBUG] Raw calculation: ${latestReading.value} - ${previousReading.value} = ${rawDifference}`);
            console.log(`[ALKIMOS DEBUG] Detected as refill: ${isRefill}`);
            console.log(`[ALKIMOS DEBUG] Final prev_day_used: ${prev_day_used}`);
          }
        }

        // Convert rolling average to negative to indicate fuel usage
        // (User logic: negative = consumption, positive = refill)
        const rolling_avg_display = rolling_avg > 0 ? -rolling_avg : rolling_avg;
        // prev_day_used already has correct sign from latest - previous calculation

        // Calculate days to minimum
        const currentLevel = tank.current_level;
        const minLevel = tank.min_level || 0;
        
        // Only calculate if we have a current level reading and positive consumption rate
        const days_to_min_level = (currentLevel !== null && rolling_avg > 0) 
          ? Math.round((Math.max(0, currentLevel - minLevel) / rolling_avg) * 10) / 10
          : null;

        return {
          ...tank,
          // ✅ Analytics calculated and included in tank data (negative = consumption, positive = refill)
          rolling_avg: rolling_avg_display,
          prev_day_used: prev_day_used,
          is_recent_refill: isRefill,
          days_to_min_level,
        };
      });

      
      // Generate alerts asynchronously (non-blocking)
      // This runs in the background and doesn't affect tank loading performance
      if (tanksWithAnalytics.length > 0) {
        generateAlerts(tanksWithAnalytics).catch(error => {
          console.error('[ALERTS] Error generating alerts:', error);
        });
      }
      
      return tanksWithAnalytics;
      
    } catch (error) {
      console.error('[TANKS DEBUG] ❌ CRITICAL ERROR in useTanks:', error);
      throw error;
    }
  },
    staleTime: 5 * 60 * 1000, // 5 minutes - longer cache for better performance
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false, // Prevent unnecessary refetches
    retry: (failureCount, error) => {
      // Don't retry auth-related failures to prevent spam
      if (error?.message?.includes('No authenticated user')) {
        return false;
      }
      return failureCount < 3;
    }
  });

  // Data already includes calculated analytics
  const tanks = tanksQuery.data || [];

  // Only log error if we're authenticated and have a real error (avoid spam during auth loading)
  if (tanks.length === 0 && !tanksQuery.isLoading && tanksQuery.error && tanksQuery.error.message !== 'No authenticated user') {
    console.error('[TANKS] No tanks returned from database after authentication:', tanksQuery.error);
  }




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
