import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tank } from '@/types/fuel';

export function useTanks() {
  const { data: tanks, isLoading, error } = useQuery<Tank[]>({
    queryKey: ['tanks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tanks_with_rolling_avg' as any)
        .select('*');
      if (error) throw error;
      return (data || []) as unknown as Tank[];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
  return { tanks, isLoading, error };
}
