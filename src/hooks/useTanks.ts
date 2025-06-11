import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export interface Tank {
  id: string;
  location?: string;
  product_type?: string;
  safe_level?: number;
  min_level?: number;
  created_at?: string;
  updated_at?: string;
  group_id?: string;
  group_name?: string;
  current_level?: number;
  current_level_percent?: number;
  rolling_avg?: number;
  days_to_min_level?: number;
  latest_dip_value?: number;
  latest_dip_date?: string;
  latest_dip_by?: string;
  last_dip?: {
    value: number;
    created_at: string;
    recorded_by: string;
  } | null;
}

export function useTanks() {
  const queryClient = useQueryClient();

  const { data: tanks, isLoading, error } = useQuery<Tank[]>({
    queryKey: ['tanks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tanks_with_rolling_avg')
        .select('*')
        .order('last_dip_ts', { ascending: false });
      if (error) throw error;
      return data?.map(tank => ({
        ...tank,
        safe_level: tank.safe_fill,
        product_type: tank.product,
        current_level: tank.current_level,
        current_level_percent: tank.current_level_percent_display,
        rolling_avg: tank.rolling_avg_lpd,
        last_dip: (tank.last_dip_ts && tank.current_level != null) 
          ? { 
              value: tank.current_level, 
              created_at: tank.last_dip_ts, 
              recorded_by: tank.last_dip_by || 'Unknown' 
            } 
          : null,
      }));
    }
  });

  const { mutate: refreshTanks } = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('tanks_with_rolling_avg')
        .select('*')
        .order('last_dip_ts', { ascending: false });
      if (error) throw error;
      return data?.map(tank => ({
        ...tank,
        safe_level: tank.safe_fill,
        product_type: tank.product,
        current_level: tank.current_level,
        current_level_percent: tank.current_level_percent_display,
        rolling_avg: tank.rolling_avg_lpd,
        last_dip: (tank.last_dip_ts && tank.current_level != null) 
          ? { 
              value: tank.current_level, 
              created_at: tank.last_dip_ts, 
              recorded_by: tank.last_dip_by || 'Unknown' 
            } 
          : null,
      }));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['tanks'], data);
    }
  });

  const { mutate: exportTanksToCSV } = useMutation({
    mutationFn: async () => {
      if (!tanks) throw new Error('No tank data available');
      
      const headers = ['ID', 'Location', 'Product', 'Safe Level', 'Current Level', 'Rolling Avg', 'Days to Min', 'Group Name', 'Last Dip Value', 'Last Dip Date', 'Last Dip By'];
      const csvContent = [
        headers.join(','),
        ...tanks.map(tank => [
          tank.id,
          tank.location || '',
          tank.product_type || '',
          tank.safe_level || '',
          tank.current_level || '',
          tank.rolling_avg || '',
          tank.days_to_min_level || '',
          tank.group_name || '',
          tank.last_dip?.value ?? '',
          tank.last_dip?.created_at ?? '',
          tank.last_dip?.recorded_by ?? ''
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tanks-export-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  });

  return {
    tanks,
    isLoading,
    error,
    refreshTanks,
    exportTanksToCSV
  };
}
