import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface UserPermissions {
  role: string;
  isAdmin: boolean;
  display_name: string;
  accessibleGroups: Array<{
    id: string;
    name: string;
    subgroups: string[];
    subgroupIds: string[];
    hasSubgroupRestriction: boolean;
  }>;
}

export const useUserPermissions = () => {
  return useQuery<UserPermissions>({
    queryKey: ['user-permissions'],
    queryFn: async () => {
      const startTime = Date.now();

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error('No authenticated user');
      }

      try {
        // Step 1: Get user role and display name (direct query, no RLS)
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role, display_name')
          .eq('user_id', user.id)
          .single();

        if (roleError) {
          // Default to clean viewer role if no role found
          return {
            role: 'viewer',
            isAdmin: false,
            display_name: user.email || 'User',
            accessibleGroups: []
          };
        }

        const userRole = roleData.role;
        const isAdmin = ['admin', 'manager'].includes(userRole);
        const hasAllGroupAccess = ['admin', 'manager', 'scheduler'].includes(userRole);

        // Step 2: Get accessible groups
        let accessibleGroups: any[] = [];

        if (hasAllGroupAccess) {
          // Admins, managers, and schedulers can access all groups
          // Use ta_groups (new schema) for future-proofing
          const { data: allGroups, error: groupsError } = await supabase
            .from('ta_groups')
            .select('id, name')
            .eq('is_active', true);

          if (!groupsError && allGroups) {
            accessibleGroups = allGroups.map(group => ({
              id: group.id,
              name: group.name,
              subgroups: [], // Users with all group access have access to all subgroups
              subgroupIds: [],
              hasSubgroupRestriction: false
            }));
          }
        } else {
          // Regular users: get their specific group/subgroup permissions
          // Use user_ta_group_permissions view (includes both group and subgroup level permissions)
          const { data: userPerms, error: userPermsError } = await supabase
            .from('user_ta_group_permissions')
            .select('group_id, group_name, subgroup_id, subgroup_name, permission_level')
            .eq('user_id', user.id);

          if (!userPermsError && userPerms && userPerms.length > 0) {
            // Group by group_id and collect subgroups
            const groupMap = new Map<string, {
              id: string;
              name: string;
              subgroups: string[];
              subgroupIds: string[];
              hasSubgroupRestriction: boolean;
            }>();

            userPerms.forEach(perm => {
              if (!perm.group_id) return;

              if (!groupMap.has(perm.group_id)) {
                groupMap.set(perm.group_id, {
                  id: perm.group_id,
                  name: perm.group_name || 'Unknown Group',
                  subgroups: [],
                  subgroupIds: [],
                  hasSubgroupRestriction: perm.permission_level === 'subgroup'
                });
              }

              const group = groupMap.get(perm.group_id)!;

              // If this is a subgroup-level permission, add the subgroup info
              if (perm.subgroup_name && perm.subgroup_id) {
                group.subgroups.push(perm.subgroup_name);
                group.subgroupIds.push(perm.subgroup_id);
                group.hasSubgroupRestriction = true;
              }
            });

            accessibleGroups = Array.from(groupMap.values());
          }
        }

        // Ensure clean, serializable object structure with proper fallbacks
        const cleanPermissions = {
          role: String(userRole || 'viewer'),
          isAdmin: Boolean(isAdmin),
          display_name: String(roleData.display_name || user.email || 'User'),
          accessibleGroups: Array.isArray(accessibleGroups) ?
            accessibleGroups.map(group => ({
              id: String(group?.id || ''),
              name: String(group?.name || 'Unknown Group'),
              subgroups: Array.isArray(group?.subgroups) ?
                group.subgroups.map(sub => String(sub)).filter(Boolean) : [],
              subgroupIds: Array.isArray(group?.subgroupIds) ?
                group.subgroupIds.map(id => String(id)).filter(Boolean) : [],
              hasSubgroupRestriction: Boolean(group?.hasSubgroupRestriction)
            })).filter(group => group.id) : []
        };

        return cleanPermissions;

      } catch (error) {
        console.error('Error in permissions calculation:', error);

        // Fallback: return clean viewer permissions with proper structure
        return {
          role: 'viewer',
          isAdmin: false,
          display_name: user?.email || 'User',
          accessibleGroups: [] as Array<{
            id: string;
            name: string;
            subgroups: string[];
            subgroupIds: string[];
            hasSubgroupRestriction: boolean;
          }>
        };
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on auth errors
      if (error?.message?.includes('No authenticated user')) {
        return false;
      }
      return failureCount < 2;
    },
    // Add cache validation to prevent malformed data
    select: (data) => {
      // Validate and clean the permissions data
      if (!data || typeof data !== 'object') {
        return {
          role: 'viewer',
          isAdmin: false,
          display_name: 'User',
          accessibleGroups: []
        };
      }

      // Ensure all properties are properly typed
      return {
        role: typeof data.role === 'string' ? data.role : 'viewer',
        isAdmin: Boolean(data.isAdmin),
        display_name: typeof data.display_name === 'string' ? data.display_name : 'User',
        accessibleGroups: Array.isArray(data.accessibleGroups)
          ? data.accessibleGroups.map(g => ({
              id: g?.id || '',
              name: g?.name || '',
              subgroups: Array.isArray(g?.subgroups) ? g.subgroups : [],
              subgroupIds: Array.isArray(g?.subgroupIds) ? g.subgroupIds : [],
              hasSubgroupRestriction: Boolean(g?.hasSubgroupRestriction)
            }))
          : []
      };
    },
  });
};

export function useCanAccessTank(tankId: string | undefined) {
  const { data: permissions } = useUserPermissions();

  return useQuery({
    queryKey: ['tank-access', tankId],
    queryFn: async () => {
      if (!tankId || !permissions) return false;

      if (permissions.isAdmin || permissions.role === 'scheduler') {
        return true;
      }

      const { data, error } = await supabase
        .from('fuel_tanks')
        .select('group_id')
        .eq('id', tankId)
        .single();

      if (error) {
        console.error('Error fetching tank group:', error);
        return false;
      }

      return permissions.accessibleGroups.some(group => group.id === data.group_id);
    },
    enabled: !!tankId && !!permissions,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCanAccessGroup(groupId: string | undefined) {
  const { data: permissions } = useUserPermissions();

  if (!permissions || !groupId) return false;
  if (permissions.isAdmin) return true;

  return permissions.accessibleGroups.some(group => group.id === groupId);
}

export function useCanAccessSubgroup(groupId: string | undefined, subgroupName: string | undefined) {
  const { data: permissions } = useUserPermissions();

  if (!permissions || !groupId || !subgroupName) return false;
  if (permissions.isAdmin) return true;
  
  const group = permissions.accessibleGroups.find(g => g.id === groupId);
  if (!group) return false;
  
  // If no subgroup restrictions, user can access all subgroups in the group
  if (group.subgroups.length === 0) return true;
  
  return group.subgroups.includes(subgroupName);
}

export function useCanAccessTankWithSubgroup(tankId: string | undefined) {
  const { data: permissions } = useUserPermissions();

  return useQuery({
    queryKey: ['tank-subgroup-access', tankId],
    queryFn: async () => {
      if (!tankId || !permissions) return false;

      if (permissions.isAdmin || permissions.role === 'scheduler') {
        return true;
      }

      const { data, error } = await supabase
        .from('fuel_tanks')
        .select('group_id, subgroup')
        .eq('id', tankId)
        .single();

      if (error) {
        console.error('Error fetching tank data:', error);
        return false;
      }

      const { group_id, subgroup } = data;

      // Check group access first
      const hasGroupAccess = permissions.accessibleGroups.some(group => group.id === group_id);
      if (!hasGroupAccess) {
        return false;
      }

      // If tank has no subgroup, group access is sufficient
      if (!subgroup) {
        return true;
      }

      // Check subgroup access
      const group = permissions.accessibleGroups.find(g => g.id === group_id);
      if (!group) return false;

      // If user has no subgroup restrictions, they can access all subgroups in the group
      if (group.subgroups.length === 0) {
        return true;
      }

      return group.subgroups.includes(subgroup);
    },
    enabled: !!tankId && !!permissions,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAccessibleSubgroups(groupId: string | undefined) {
  const { data: permissions } = useUserPermissions();

  if (!permissions || !groupId) return [];
  if (permissions.isAdmin || permissions.role === 'scheduler') {
    // For admins and schedulers, fetch all subgroups from the database
    return useQuery({
      queryKey: ['all-subgroups', groupId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('fuel_tanks')
          .select('subgroup')
          .eq('group_id', groupId)
          .not('subgroup', 'is', null);
          
        if (error) return [];
        
        const uniqueSubgroups = [...new Set(data.map(tank => tank.subgroup))];
        return uniqueSubgroups.filter(Boolean);
      },
      enabled: !!groupId,
      staleTime: 10 * 60 * 1000,
    });
  }
  
  const group = permissions.accessibleGroups.find(g => g.id === groupId);
  return { data: group?.subgroups || [], isLoading: false };
}

export function useFilterTanksBySubgroup() {
  const { data: permissions, isLoading } = useUserPermissions();

  const filterTanks = (tanks: any[]) => {
    // Return empty array if still loading or no data
    if (!tanks || !permissions || isLoading) return [];

    // Safety check for accessibleGroups
    if (!permissions.accessibleGroups || !Array.isArray(permissions.accessibleGroups)) {
      console.warn('⚠️ [SUBGROUP FILTER] accessibleGroups is undefined or not an array:', permissions);
      return [];
    }

    if (permissions.isAdmin || permissions.role === 'scheduler') return tanks;

    return tanks.filter(tank => {
      // Check group access first
      const group = permissions.accessibleGroups.find(g => g && g.id === tank.group_id);
      if (!group) return false;

      // If user has no subgroup restrictions, they can access all tanks in the group
      if (!group.hasSubgroupRestriction) return true;

      // User has subgroup-level restrictions
      // If tank has no subgroup_id, check by subgroup name as fallback
      if (tank.subgroup_id) {
        // Check using subgroup_id (preferred - new schema)
        return group.subgroupIds.includes(tank.subgroup_id);
      } else if (tank.subgroup) {
        // Fallback to subgroup name (legacy compatibility)
        return group.subgroups.includes(tank.subgroup);
      }

      // Tank has no subgroup assigned - deny access if user has subgroup restrictions
      return false;
    });
  };

  return {
    filterTanks,
    permissions,
    isLoading
  };
}