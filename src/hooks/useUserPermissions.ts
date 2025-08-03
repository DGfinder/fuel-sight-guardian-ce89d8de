import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface UserPermissions {
  role: string;
  isAdmin: boolean;
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
      console.log('🔍 [RBAC DEBUG] Fetching user permissions (no RLS)...');
      
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        console.log('❌ [RBAC DEBUG] No authenticated user');
        throw new Error('No authenticated user');
      }

      console.log('👤 [RBAC DEBUG] Fetching permissions for user:', user.id);

      try {
        // Step 1: Get user role (direct query, no RLS)
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (roleError) {
          console.log('⚠️ [RBAC DEBUG] No role found, defaulting to viewer');
          // Default to clean viewer role if no role found
          return {
            role: 'viewer',
            isAdmin: false,
            accessibleGroups: []
          };
        }

        const userRole = roleData.role;
        const isAdmin = ['admin', 'manager'].includes(userRole);

        console.log('✅ [RBAC DEBUG] User role fetched successfully:', userRole);

        // Step 2: Get accessible groups
        let accessibleGroups: any[] = [];

        if (isAdmin) {
          // Admins can access all groups
          console.log('👑 [RBAC DEBUG] User is admin, fetching all groups');
          
          const { data: allGroups, error: groupsError } = await supabase
            .from('tank_groups')
            .select('id, name');

          if (!groupsError && allGroups) {
            accessibleGroups = allGroups.map(group => ({
              id: group.id,
              name: group.name,
              subgroups: [] // Admins have access to all subgroups
            }));
          }
        } else {
          // Regular users: get their specific group permissions
          console.log('👤 [RBAC DEBUG] User is regular user, fetching specific permissions');
          
          const { data: userGroups, error: userGroupsError } = await supabase
            .from('user_group_permissions')
            .select(`
              group_id,
              tank_groups!inner(id, name)
            `)
            .eq('user_id', user.id);

          if (!userGroupsError && userGroups) {
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

        console.log('🎯 [RBAC DEBUG] Final permissions calculated:', {
          role: userRole,
          isAdmin,
          groupCount: accessibleGroups.length,
          groups: accessibleGroups.map(g => g.name)
        });

        // Ensure clean, serializable object structure
        const cleanPermissions = {
          role: String(userRole || 'viewer'),
          isAdmin: Boolean(isAdmin),
          accessibleGroups: Array.isArray(accessibleGroups) ? 
            accessibleGroups.map(group => ({
              id: String(group.id || ''),
              name: String(group.name || ''),
              subgroups: Array.isArray(group.subgroups) ? 
                group.subgroups.map(sub => String(sub)) : []
            })) : []
        };

        return cleanPermissions;

      } catch (error) {
        console.error('💥 [RBAC DEBUG] Error in permissions calculation:', error);
        
        // Fallback: return clean viewer permissions
        return {
          role: 'viewer',
          isAdmin: false,
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
        console.warn('⚠️ [RBAC DEBUG] Invalid permissions data, resetting to viewer');
        return {
          role: 'viewer',
          isAdmin: false,
          accessibleGroups: []
        };
      }
      
      // Ensure all properties are properly typed
      return {
        role: typeof data.role === 'string' ? data.role : 'viewer',
        isAdmin: Boolean(data.isAdmin),
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
      
      console.log('🔍 [TANK ACCESS DEBUG] Checking access for tank:', tankId, {
        isAdmin: permissions.isAdmin,
        accessibleGroups: permissions.accessibleGroups.map(g => g.name)
      });
      
      if (permissions.isAdmin) {
        console.log('✅ [TANK ACCESS DEBUG] Admin access granted');
        return true;
      }

      const { data, error } = await supabase
        .from('fuel_tanks')
        .select('group_id')
        .eq('id', tankId)
        .single();

      if (error) {
        console.error('❌ [TANK ACCESS DEBUG] Error fetching tank group:', error);
        return false;
      }

      const hasAccess = permissions.accessibleGroups.some(group => group.id === data.group_id);
      console.log('🔍 [TANK ACCESS DEBUG] Tank group check:', {
        tankGroupId: data.group_id,
        accessibleGroupIds: permissions.accessibleGroups.map(g => g.id),
        hasAccess
      });

      return hasAccess;
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