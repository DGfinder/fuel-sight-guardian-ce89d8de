import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tank } from '@/types/fuel';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useTanks() {
  const queryClient = useQueryClient();
  // Use a unique channel name per hook instance
  const channelNameRef = useRef(`fuel_tanks_${Math.random().toString(36).slice(2)}`);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { data: tanks, isLoading, error } = useQuery({
    queryKey: ['tanks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tanks_with_latest_dip')
        .select('*');
      if (error) throw error;
      // Map tanks to set current_level to latest_dip_value, and add current_level_percent
      return (data || []).map((tank: any) => {
        const current_level = tank.latest_dip_value ?? 0;
        const current_level_percent = (tank.latest_dip_value && tank.safe_level)
          ? Math.round((tank.latest_dip_value / tank.safe_level) * 100)
          : 0;
        return {
          ...tank,
          current_level,
          current_level_percent,
          group_name: tank.group_name || '',
        };
      });
    },
  });

  useEffect(() => {
    // Cleanup any previous channel before creating a new one
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    channelRef.current = supabase
      .channel(channelNameRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fuel_tanks' }, () => {
        queryClient.invalidateQueries({ queryKey: ['tanks'] });
      })
      .subscribe();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient]);

  return { tanks, isLoading, error };
}
