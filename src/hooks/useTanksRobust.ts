import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Tank } from '../types/fuel';

// Helper to normalize tank data from different sources
const normalizeTankData = (rawTank: any): Tank => {
  // Handle last_dip - can be object or separate fields
  let last_dip = null;
  if (rawTank.last_dip && typeof rawTank.last_dip === 'object') {
    last_dip = rawTank.last_dip;
  } else if (rawTank.last_dip_ts) {
    last_dip = {
      value: rawTank.current_level || 0,
      created_at: rawTank.last_dip_ts,
      recorded_by: rawTank.last_dip_by || rawTank.latest_dip_by || 'Unknown'
    };
  }
  
  return {
    // Core fields
    id: rawTank.id,
    location: rawTank.location || '',
    product_type: rawTank.product_type || rawTank.product || 'Unknown',
    safe_level: rawTank.safe_level || rawTank.safe_fill || 0,
    min_level: rawTank.min_level || 0,
    group_id: rawTank.group_id,
    group_name: rawTank.group_name || '',
    subgroup: rawTank.subgroup || '',
    
    // Current level data
    current_level: rawTank.current_level || 0,
    current_level_percent: rawTank.current_level_percent || rawTank.current_level_percent_display || 0,
    
    // Analytics - handle different field names
    rolling_avg: rawTank.rolling_avg || rawTank.rolling_avg_lpd || 0,
    prev_day_used: rawTank.prev_day_used || 0,
    days_to_min_level: rawTank.days_to_min_level,
    
    // Capacity
    usable_capacity: rawTank.usable_capacity || 
      ((rawTank.safe_level || 0) - (rawTank.min_level || 0)),
    ullage: rawTank.ullage || 
      ((rawTank.safe_level || 0) - (rawTank.current_level || 0)),
    
    // Metadata
    address: rawTank.address,
    vehicle: rawTank.vehicle,
    discharge: rawTank.discharge,
    bp_portal: rawTank.bp_portal,
    delivery_window: rawTank.delivery_window,
    afterhours_contact: rawTank.afterhours_contact,
    notes: rawTank.notes,
    serviced_on: rawTank.serviced_on,
    serviced_by: rawTank.serviced_by,
    latitude: rawTank.latitude,
    longitude: rawTank.longitude,
    created_at: rawTank.created_at,
    updated_at: rawTank.updated_at,
    
    // Structured fields
    last_dip,
    
    // Legacy fields for compatibility
    latest_dip_value: rawTank.latest_dip_value || rawTank.current_level,
    latest_dip_date: rawTank.latest_dip_date || rawTank.last_dip_ts,
    latest_dip_by: rawTank.latest_dip_by || rawTank.last_dip_by
  };
};

// Robust hook that handles multiple data sources
export const useTanksRobust = () => {
  const queryClient = useQueryClient();

  const tanksQuery = useQuery({
    queryKey: ['tanks-robust'],
    queryFn: async () => {
      console.log('[TANKS ROBUST] Fetching tank data...');
      
      try {
        // Try primary view first
        const { data: viewData, error: viewError } = await supabase
          .from('tanks_with_rolling_avg')
          .select('*')
          .order('location');

        if (!viewError && viewData) {
          console.log(`[TANKS ROBUST] Successfully fetched ${viewData.length} tanks from view`);
          return viewData.map(normalizeTankData);
        }

        console.warn('[TANKS ROBUST] View failed, trying fallback:', viewError);
        
        // Fallback: Join tables manually
        const { data: tanksData, error: tanksError } = await supabase
          .from('fuel_tanks')
          .select(`
            *,
            tank_groups!inner(name),
            dip_readings(
              value,
              created_at,
              recorded_by,
              created_by_name
            )
          `)
          .eq('deleted_at', null)
          .order('location');

        if (tanksError) {
          throw tanksError;
        }

        console.log(`[TANKS ROBUST] Fetched ${tanksData?.length || 0} tanks from base tables`);

        // Process and calculate analytics
        return (tanksData || []).map(tank => {
          // Get latest dip reading
          const sortedDips = (tank.dip_readings || [])
            .sort((a: any, b: any) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
          
          const latestDip = sortedDips[0];
          
          // Calculate basic analytics from recent readings
          let rolling_avg = 0;
          let prev_day_used = 0;
          
          if (sortedDips.length >= 2) {
            // Simple rolling average from last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const recentDips = sortedDips.filter((d: any) => 
              new Date(d.created_at) >= sevenDaysAgo
            );
            
            if (recentDips.length >= 2) {
              const totalConsumption = recentDips[0].value - recentDips[recentDips.length - 1].value;
              const daysDiff = (
                new Date(recentDips[0].created_at).getTime() - 
                new Date(recentDips[recentDips.length - 1].created_at).getTime()
              ) / (1000 * 60 * 60 * 24);
              
              if (daysDiff > 0 && totalConsumption < 0) {
                rolling_avg = Math.abs(Math.round(totalConsumption / daysDiff));
              }
            }
            
            // Previous day usage
            if (sortedDips.length >= 2) {
              const consumption = sortedDips[1].value - sortedDips[0].value;
              if (consumption > 0) {
                prev_day_used = consumption;
              }
            }
          }
          
          const normalized = {
            ...tank,
            group_name: tank.tank_groups?.name || 'Unknown',
            current_level: latestDip?.value || 0,
            last_dip_ts: latestDip?.created_at,
            last_dip_by: latestDip?.recorded_by || 'Unknown',
            rolling_avg,
            prev_day_used,
            current_level_percent: tank.safe_level > 0 
              ? Math.round(((latestDip?.value || 0) / tank.safe_level) * 100)
              : 0
          };
          
          return normalizeTankData(normalized);
        });
        
      } catch (error) {
        console.error('[TANKS ROBUST] Failed to fetch tank data:', error);
        throw error;
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    tanks: tanksQuery.data || [],
    data: tanksQuery.data || [], // Backward compatibility
    isLoading: tanksQuery.isLoading,
    error: tanksQuery.error,
    refetch: tanksQuery.refetch,
    invalidate: () => {
      queryClient.invalidateQueries({ queryKey: ['tanks-robust'] });
    }
  };
};

// Export as default for easy migration
export default useTanksRobust;