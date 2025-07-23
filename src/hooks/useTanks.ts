import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useUserPermissions } from './useUserPermissions';
import { UserPermissions } from '../types/auth';
import { realtimeManager } from '../lib/realtime-manager';
import { useSimpleTankAnalytics } from './useSimpleTankAnalytics';

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

  // Fetch tank data from your existing database (no changes needed!)
  const tanksQuery = useQuery({
    queryKey: ['tanks-existing'],
    queryFn: async () => {
      console.log('[TANKS DEBUG] Fetching tanks from existing database...');
      
      // Try existing view first, fallback to base table if it fails
      let { data, error } = await supabase
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

        // Add placeholder values for missing fields (analytics will fill these)
        data = baseData?.map(tank => ({
          ...tank,
          current_level: 0,
          current_level_percent: 0,
          rolling_avg: 0,
          prev_day_used: 0,
          days_to_min_level: null,
          last_dip_ts: null,
          last_dip_by: 'Unknown',
          usable_capacity: (tank.safe_level || 0) - (tank.min_level || 0),
          ullage: tank.safe_level || 0,
          group_name: 'Unknown Group'
        })) || [];
      }

      if (error && !error.message?.includes('500')) {
        console.error('[TANKS DEBUG] Error fetching tanks:', error);
        throw error;
      }

      console.log(`[TANKS DEBUG] Successfully fetched ${data?.length || 0} tanks`);
      return data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Transform raw tank data to include analytics
  const tanksWithAnalytics = (tanksQuery.data || []).map((tank: any) => {
    // Get analytics for this tank (computed in frontend)
    const { analytics } = useSimpleTankAnalytics(tank.id);
    
    return {
      ...tank,
      // ✅ Replace placeholder values with real analytics
      rolling_avg: analytics.rolling_avg,
      prev_day_used: analytics.prev_day_used, 
      days_to_min_level: analytics.days_to_min_level,
      
      // Ensure all fields have proper defaults
      current_level: tank.current_level || 0,
      current_level_percent: tank.current_level_percent || 0,
      safe_level: tank.safe_level || 10000,
      min_level: tank.min_level || 0,
      group_name: tank.group_name || 'Unknown Group',
      subgroup: tank.subgroup || 'No Subgroup',
      last_dip_by: tank.last_dip_by || 'Unknown User',
      usable_capacity: tank.usable_capacity || 0,
      ullage: tank.ullage || 0,
    } as Tank;
  });

  console.log('[TANKS DEBUG] Enhanced tanks with analytics:', {
    totalTanks: tanksWithAnalytics.length,
    tanksWithAnalytics: tanksWithAnalytics.slice(0, 3).map((t: Tank) => ({
      location: t.location,
      currentLevel: t.current_level,
      rollingAvg: t.rolling_avg,
      daysToMin: t.days_to_min_level,
      prevDayUsed: t.prev_day_used
    }))
  });

  return {
    data: tanksWithAnalytics,
    isLoading: tanksQuery.isLoading,
    error: tanksQuery.error,
    refetch: tanksQuery.refetch,
    
    // Utility functions
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ['tanks'] });
      queryClient.invalidateQueries({ queryKey: ['tank-readings-analytics'] });
    },
    
    // Analytics summary
    getAnalyticsSummary: () => {
      if (!tanksWithAnalytics.length) return null;
      
      const tanksWithData = tanksWithAnalytics.filter((t: Tank) => t.rolling_avg > 0);
      
      return {
        totalTanks: tanksWithAnalytics.length,
        tanksWithAnalytics: tanksWithData.length,
        avgRollingConsumption: tanksWithData.length > 0 
          ? Math.round(tanksWithData.reduce((sum: number, t: Tank) => sum + t.rolling_avg, 0) / tanksWithData.length)
          : 0,
        tanksNeedingAttention: tanksWithAnalytics.filter((t: Tank) => 
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
