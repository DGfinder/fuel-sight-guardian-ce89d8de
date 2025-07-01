import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { UserRole, UserPermissions } from '../types/auth';

export const useUserPermissions = () => {
  return useQuery({
    queryKey: ['userPermissions'],
    queryFn: async (): Promise<UserPermissions> => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔍 [RBAC DEBUG] Fetching permissions for user:', user?.id);
      
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      try {
        console.log('📋 [RBAC DEBUG] Querying user_roles table...');
        
        // Get user role
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (roleError) {
          console.error('❌ [RBAC DEBUG] Error fetching user role:', roleError);
          throw new Error(`Failed to fetch user role: ${roleError.message}`);
        }

        const role = roleData?.role as UserRole || 'user';

        // Get user's accessible groups
        const { data: groupData, error: groupError } = await supabase
          .from('user_group_permissions')
          .select(`
            group_id,
            tank_groups!inner (
              id,
              name
            )
          `)
          .eq('user_id', user.id);

        if (groupError) {
          console.error('❌ [RBAC DEBUG] Error fetching user groups:', groupError);
          throw new Error(`Failed to fetch user groups: ${groupError.message}`);
        }

        const accessibleGroups = groupData?.map(item => ({
          id: item.group_id,
          name: (item.tank_groups as any).name
        })) || [];

        console.log('✅ [RBAC DEBUG] Permissions loaded successfully:', { role, accessibleGroups });

        return {
          role,
          accessibleGroups,
          isAdmin: role === 'admin',
          isManager: role === 'manager',
          isPrivileged: ['admin', 'manager'].includes(role),
          canManageUsers: ['admin', 'manager'].includes(role),
          canManageGroups: ['admin', 'manager'].includes(role),
          canViewAllTanks: ['admin', 'manager'].includes(role),
          canEditAllTanks: ['admin', 'manager'].includes(role),
          canDeleteTanks: role === 'admin',
          canViewAllDips: ['admin', 'manager'].includes(role),
          canEditAllDips: ['admin', 'manager'].includes(role),
          canDeleteDips: role === 'admin',
          canViewAllAlerts: ['admin', 'manager'].includes(role),
          canAcknowledgeAlerts: ['admin', 'manager'].includes(role),
          canManageAlerts: role === 'admin',
        };
      } catch (error) {
        console.error('💥 [RBAC DEBUG] Critical error in useUserPermissions:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
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