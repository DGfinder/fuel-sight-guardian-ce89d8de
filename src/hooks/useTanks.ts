
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TankWithDetails {
  id: string;
  location: string;
  depot_name: string;
  min_level: number;
  safe_fill: number;
  product_type?: string; // This might need to be derived or added to schema
}

export function useTanks(userDepotId?: string) {
  return useQuery({
    queryKey: ['tanks', userDepotId],
    queryFn: async () => {
      console.log('Fetching tanks for depot:', userDepotId);
      
      let query = supabase
        .from('swan_tanks')
        .select('*');
      
      // Filter by depot if user has a specific depot assignment
      if (userDepotId) {
        query = query.eq('depot_name', userDepotId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching tanks:', error);
        throw error;
      }
      
      console.log('Fetched tanks:', data);
      return data as TankWithDetails[];
    },
    enabled: true
  });
}
