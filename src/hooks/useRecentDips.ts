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

// Define interfaces for our data
interface Tank {
  id: string;
  location: string;
  product_type: string;
  group_id: string;
}

interface TankGroup {
  id: string;
  name: string;
}

export function useRecentDips(limit = 30) {
  return useQuery<RecentDip[]>({
    queryKey: ['recent-dips', limit],
    queryFn: async () => {
      // Fetch recent active dip readings only
      const { data: rawData, error } = await supabase
        .from('dip_readings')
        .select(`
          id,
          value,
          created_at,
          recorded_by,
          tank_id,
          created_by_name
        `)
        .is('archived_at', null) // Only active readings
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!rawData || rawData.length === 0) return [];

      // Get unique user IDs for profile lookup
      const userIds = [...new Set(rawData.map(r => r.recorded_by).filter(Boolean))];
      
      // Fetch user profiles separately
      const userProfiles = new Map<string, string>();
      if (userIds.length > 0) {
        console.log(`Recent Dips: Looking up profiles for ${userIds.length} users:`, userIds);
        try {
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          
          if (profileError) {
            console.warn('Recent Dips profile lookup error:', profileError);
          } else if (profiles) {
            console.log(`Recent Dips: Found ${profiles.length} profiles:`, profiles);
            profiles.forEach(profile => {
              if (profile.full_name) {
                userProfiles.set(profile.id, profile.full_name);
              } else {
                console.warn(`Recent Dips: Profile ${profile.id} has empty full_name`);
              }
            });
            console.log(`Recent Dips: Successfully mapped ${userProfiles.size} user names`);
          }
        } catch (profileError) {
          console.warn('Could not fetch user profiles:', profileError);
        }
      }

      // Get tank info separately (without the problematic nested select)
      const tankIds = [...new Set(rawData.map(r => r.tank_id))];
      const { data: tanksData, error: tanksError } = await supabase
        .from('fuel_tanks')
        .select(`
          id,
          location,
          product_type,
          group_id
        `)
        .in('id', tankIds);

      if (tanksError) throw tanksError;

      // Get group info separately 
      const groupIds = [...new Set(tanksData?.map(t => t.group_id).filter(Boolean))];
      let groupsData = [];
      if (groupIds.length > 0) {
        const { data: groups, error: groupsError } = await supabase
          .from('tank_groups')
          .select('id, name')
          .in('id', groupIds);

        if (!groupsError && groups) {
          groupsData = groups;
        }
      }

      // Create lookup maps
      const tankMap = new Map<string, { id: string; location: string; product_type: string; group_id: string }>();
      tanksData?.forEach(tank => {
        tankMap.set(tank.id, tank);
      });

      const groupMap = new Map<string, { id: string; name: string }>();
      groupsData.forEach(group => {
        groupMap.set(group.id, group);
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
          const group = tank?.group_id ? groupMap.get(tank.group_id) : undefined;
          
          const userId = reading.recorded_by;
          const fullName = userProfiles.get(userId);
          const createdByName = reading.created_by_name;
          
          // Enhanced fallback logic prioritizing created_by_name if available
          let displayName = 'Unknown User';
          
          // Priority 1: Use created_by_name if it exists and is not empty
          if (createdByName && createdByName.trim().length > 0) {
            displayName = createdByName.trim();
          }
          // Priority 2: Use profile lookup result
          else if (fullName) {
            displayName = fullName;
          }
          // Priority 3: Format UUID nicely if available
          else if (userId && userId.length > 0) {
            if (userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              displayName = `User (${userId.substring(0, 8)}...)`;
            } else {
              displayName = userId; // Fallback to original value
            }
          }
          
          return {
            id: reading.id,
            value: reading.value,
            created_at: reading.created_at,
            recorded_by: displayName,
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