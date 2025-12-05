import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export const useTankDips = (tankId: string | undefined) =>
  useQuery({
    queryKey: ['dips', tankId],
    queryFn: async () => {
      if (!tankId) {
        console.log('🔍 [DIPS DEBUG] No tankId provided, returning empty array');
        return [];
      }
      
      console.log('🔍 [DIPS DEBUG] Fetching dips for tank:', tankId);
      
      const { data, error } = await supabase
        .from('ta_tank_dips')
        .select('level_liters, created_at')
        .eq('tank_id', tankId)
        .is('archived_at', null) // Only active readings
        .order('created_at', { ascending: false })
        .limit(30);
        
      if (error) {
        console.error('❌ [DIPS DEBUG] Error fetching dips:', error);
        throw error;
      }
      
      console.log('✅ [DIPS DEBUG] Dips fetched successfully:', {
        tankId,
        dipCount: data?.length || 0,
        firstDip: data?.[0],
        lastDip: data?.[data.length - 1]
      });

      // Transform ta_tank_dips format to expected format
      return data?.map(dip => ({
        value: dip.level_liters,
        created_at: dip.created_at
      })) ?? [];
    },
    enabled: !!tankId
  }); 