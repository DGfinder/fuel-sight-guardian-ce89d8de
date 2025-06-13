import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const useTankDips = (tankId: string | undefined) =>
  useQuery({
    queryKey: ['dips', tankId],
    queryFn: async () => {
      if (!tankId) return [];
      
      const { data, error } = await supabase
        .from('dip_readings')
        .select('value, created_at')
        .eq('tank_id', tankId)
        .order('created_at', { ascending: false })
        .limit(30);
        
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!tankId
  }); 