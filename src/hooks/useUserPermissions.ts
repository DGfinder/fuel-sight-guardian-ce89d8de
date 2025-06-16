import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface UserPermissions {
  role: 'admin' | 'swan_transit' | 'gsfs_depots' | 'kalgoorlie' | null;
  accessibleGroups: Array<{
    id: string;
    name: string;
  }>;
  isAdmin: boolean;
  isSingleGroup: boolean;
  userId: string | null;
}

export function useUserPermissions() {
  return useQuery<UserPermissions | null>({
    queryKey: ['user-permissions'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      const { data, error } = await supabase
        .from('user_roles')
        .select(`
          role,
          group_id,
          tank_groups (
            id,
            name
          )
        `)
        .eq('user_id', session.user.id);

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        // User has no roles assigned - deny access
        return {
          role: null,
          accessibleGroups: [],
          isAdmin: false,
          isSingleGroup: false,
          userId: session.user.id
        };
      }

      const role = data[0]?.role;
      const accessibleGroups = data
        .map(r => r.tank_groups)
        .filter(Boolean)
        .map(group => ({
          id: group.id,
          name: group.name
        }));

      return {
        role,
        accessibleGroups,
        isAdmin: role === 'admin',
        isSingleGroup: accessibleGroups.length === 1,
        userId: session.user.id
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useCanAccessTank(tankId: string | undefined) {
  const { data: permissions } = useUserPermissions();

  return useQuery({
    queryKey: ['tank-access', tankId, permissions?.userId],
    queryFn: async () => {
      if (!tankId || !permissions?.userId) return false;
      
      if (permissions.isAdmin) return true;

      const { data, error } = await supabase
        .from('fuel_tanks')
        .select('group_id')
        .eq('id', tankId)
        .single();

      if (error) return false;

      return permissions.accessibleGroups.some(group => group.id === data.group_id);
    },
    enabled: !!tankId && !!permissions?.userId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCanAccessGroup(groupId: string | undefined) {
  const { data: permissions } = useUserPermissions();

  if (!permissions || !groupId) return false;
  if (permissions.isAdmin) return true;

  return permissions.accessibleGroups.some(group => group.id === groupId);
}