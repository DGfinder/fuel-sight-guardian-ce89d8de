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
          
          const { data: allGroups, error: groupsError } = await supabase
            .from('tank_groups')
            .select('id, name');

          if (!groupsError && allGroups) {
            accessibleGroups = allGroups.map(group => ({
              id: group.id,
              name: group.name,
              subgroups: [] // Users with all group access have access to all subgroups
            }));
          }
        } else {
          // Regular users: get their specific group permissions
          
          // Use manual join approach to avoid Supabase relationship ambiguity
          const { data: userGroupIds, error: userGroupsError } = await supabase
            .from('user_group_permissions')
            .select('group_id')
            .eq('user_id', user.id);

          if (!userGroupsError && userGroupIds && userGroupIds.length > 0) {
            const groupIds = userGroupIds.map(ug => ug.group_id);
            
            const { data: groupDetails, error: groupDetailsError } = await supabase
              .from('tank_groups')
              .select('id, name')
              .in('id', groupIds);
              
            const userGroups = groupDetails?.map(group => ({
              group_id: group.id,
              tank_groups: { id: group.id, name: group.name }
            })) || [];

            if (!groupDetailsError && userGroups.length > 0) {
            // Get subgroup restrictions for each group
            const { data: subgroupRestrictions } = await supabase
              .from('user_subgroup_permissions')
              .select('group_id, subgroup_name')
              .eq('user_id', user.id);

            const subgroupsByGroup = new Map();
            subgroupRestrictions?.forEach(restriction => {
              if (!subgroupsByGroup.has(restriction.group_id)) {
                subgroupsByGroup.set(restriction.group_id, []);
              }
              subgroupsByGroup.get(restriction.group_id).push(restriction.subgroup_name);
            });

            accessibleGroups = userGroups.map(userGroup => ({
              id: userGroup.group_id,
              name: (userGroup as any).tank_groups.name,
              subgroups: subgroupsByGroup.get(userGroup.group_id) || []
            }));
            }
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
                group.subgroups.map(sub => String(sub)).filter(Boolean) : []
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
          accessibleGroups: []
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
        accessibleGroups: Array.isArray(data.accessibleGroups) ? data.accessibleGroups : []
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
      const hasGroupAccess = permissions.accessibleGroups.some(group => group && group.id === tank.group_id);
      if (!hasGroupAccess) return false;

      // If tank has no subgroup, group access is sufficient
      if (!tank.subgroup) return true;

      // Check subgroup access
      const group = permissions.accessibleGroups.find(g => g && g.id === tank.group_id);
      if (!group) return false;

      // If user has no subgroup restrictions, they can access all subgroups in the group
      if (!group.subgroups || !Array.isArray(group.subgroups) || group.subgroups.length === 0) return true;

      return group.subgroups.includes(tank.subgroup);
    });
  };

  return {
    filterTanks,
    permissions,
    isLoading
  };
}