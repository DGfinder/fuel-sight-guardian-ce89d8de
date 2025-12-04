import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const useTankGroups = () =>
  useQuery({
    queryKey: ['tank-groups'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tank_groups').select('id,name').order('name');
      if (error) throw error;
      return data ?? [];
    }
  }); 