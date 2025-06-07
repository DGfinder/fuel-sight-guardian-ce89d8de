
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserRole {
  role: 'admin' | 'depot_manager' | 'operator';
  depot_id: string | null;
  group_id?: string | null;
}

export function useUserRole() {
  return useQuery({
    queryKey: ['user-role'],
    queryFn: async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        throw new Error('User not authenticated');
      }
      
      console.log('Fetching role for user:', user.id);
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user role:', error);
        // Return default role if no specific role found
        return { role: 'operator' as const, depot_id: null, group_id: null };
      }
      
      console.log('User role:', data);
      return { 
        role: data.role as 'admin' | 'depot_manager' | 'operator', 
        depot_id: null, 
        group_id: null 
      };
    }
  });
}
