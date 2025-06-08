import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface UserRole {
  role: 'admin' | 'depot_manager' | 'operator';
  depot_id: string | null;
  group_id?: string | null;
}

export function useUserRole() {
  return useQuery({
    queryKey: ['user-role'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        throw new Error('User not authenticated');
      }
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      if (error) {
        console.error('Error fetching user role:', error);
        return { role: 'operator' as const, depot_id: null, group_id: null };
      }
      return {
        role: data.role as 'admin' | 'depot_manager' | 'operator',
        depot_id: null,
        group_id: null
      };
    }
  });
}
