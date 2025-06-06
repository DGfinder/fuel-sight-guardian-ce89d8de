
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserRole {
  role: string;
  depot_id: string | null;
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
        .select('role, depot_id')
        .eq('user_id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user role:', error);
        // Return default role if no specific role found
        return { role: 'operator', depot_id: null };
      }
      
      console.log('User role:', data);
      return data as UserRole;
    }
  });
}
