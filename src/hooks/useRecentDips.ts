import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface RecentDip {
  id: string;
  value: number;
  created_at: string;
  recorded_by: string | null;
  tank_id: string;
  tank_location: string;
  product_type: string;
  group_id: string;
  group_name: string;
  is_refill: boolean;
}

// Define TankGroup type
interface TankGroup {
  name: string;
}

export function useRecentDips(limit = 30) {
  return useQuery<RecentDip[]>({
    queryKey: ['recent-dips', limit],
    queryFn: async () => {
      // Fetch recent dip readings with user profiles
      const { data: rawData, error } = await supabase
        .from('dip_readings')
        .select(`
          id,
          value,
          created_at,
          recorded_by,
          tank_id,
          profiles!recorded_by(full_name)
        `)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!rawData || rawData.length === 0) return [];

      // Get tank and group info separately
      const tankIds = [...new Set(rawData.map(r => r.tank_id))];
      const { data: tanksData, error: tanksError } = await supabase
        .from('fuel_tanks')
        .select(`
          id,
          location,
          product_type,
          group_id,
          tank_groups (
            name
          )
        `)
        .in('id', tankIds);

      if (tanksError) throw tanksError;

      // Create a lookup map for tank data
      const tankMap = new Map<string, { id: string; location: string; product_type: string; group_id: string; tank_groups: TankGroup[] }>();
      tanksData?.forEach(tank => {
        tankMap.set(tank.id, tank);
      });

      return rawData
        .sort((a, b) => {
          // Primary sort: most recent first by created_at
          const dateA = new Date(a.created_at).getTime();
          const dateB = new Date(b.created_at).getTime();
          if (dateB !== dateA) {
            return dateB - dateA; // Most recent first
          }
          // Secondary sort: by ID if timestamps are identical
          return b.id.localeCompare(a.id);
        })
        .map(reading => {
          const tank = tankMap.get(reading.tank_id);
          const group = tank?.tank_groups && Array.isArray(tank.tank_groups) && tank.tank_groups.length > 0 ? tank.tank_groups[0] : undefined;
          
          return {
            id: reading.id,
            value: reading.value,
            created_at: reading.created_at,
            recorded_by: reading.profiles?.full_name || reading.recorded_by || 'Unknown',
            tank_id: reading.tank_id,
            tank_location: tank?.location || 'Unknown Tank',
            product_type: tank?.product_type || 'Unknown',
            group_id: tank?.group_id || '',
            group_name: group?.name || 'Unknown Group',
            is_refill: false // We'll implement refill detection later
          };
        });
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  });
} 