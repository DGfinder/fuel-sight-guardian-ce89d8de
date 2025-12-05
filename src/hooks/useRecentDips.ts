import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { UserPermissions } from './useUserPermissions';

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

export function useRecentDips(limit: number = 30, permissions?: UserPermissions) {
  return useQuery<RecentDip[]>({
    queryKey: [
      'recent-dips',
      limit,
      permissions?.role,
      permissions?.accessibleGroups?.map(g => g.id).sort().join(',')
    ],
    queryFn: async () => {
      // Build base query on denormalized view
      let query = supabase
        .from('ta_recent_dips_enriched')
        .select('*')
        .limit(limit);

      // Apply RBAC filtering by group (5-10 groups vs 120+ tanks)
      const hasFullAccess = permissions?.role &&
        ['admin', 'manager', 'scheduler'].includes(permissions.role);

      if (!hasFullAccess && permissions?.accessibleGroups && permissions.accessibleGroups.length > 0) {
        const groupIds = permissions.accessibleGroups.map(g => g.id);
        query = query.in('group_id', groupIds);

        // Handle subgroup restrictions
        const restrictedGroups = permissions.accessibleGroups
          .filter(g => g.hasSubgroupRestriction);

        if (restrictedGroups.length > 0) {
          const subgroupIds = restrictedGroups
            .flatMap(g => g.subgroupIds)
            .filter(Boolean);

          if (subgroupIds.length > 0) {
            query = query.in('subgroup_id', subgroupIds);
          } else {
            // FIX: Empty subgroupIds means no access (security fix)
            return [];
          }
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      if (!data) return [];

      // Map to RecentDip interface
      return data.map(row => ({
        id: row.id,
        value: row.level_liters,
        created_at: row.created_at,
        recorded_by: row.user_full_name || row.measured_by_name || 'Unknown User',
        tank_id: row.tank_id,
        tank_location: row.tank_location || row.tank_name || 'Unknown Tank',
        product_type: row.product_type || 'Unknown',
        group_id: row.group_id || '',
        group_name: row.group_name || 'Unknown Group',
        is_refill: row.is_refill || false
      }));
    },
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  });
}
