import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TankAlert } from '@/types/fuel';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useAlerts() {
  const queryClient = useQueryClient();
  const channelNameRef = useRef(`tank_alerts_${Math.random().toString(36).slice(2)}`);
  const channelRef = useRef(null);

  const { data: alerts = [], isLoading, error } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      console.log('Fetching alerts...');
      const { data, error } = await supabase
        .from('tank_alerts')
        .select(`
          *,
          fuel_tanks (
            id,
            group_id,
            product_type,
            tank_groups ( name )
          )
        `)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching alerts:', error);
        throw error;
      }

      if (!data) {
        console.log('No alerts data returned');
        return [];
      }

      console.log(`Fetched ${data.length} alerts`);
      return data as TankAlert[];
    }
  });

  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    channelRef.current = supabase
      .channel(channelNameRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tank_alerts' }, () => {
        queryClient.invalidateQueries({ queryKey: ['alerts'] });
      })
      .subscribe();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient]);

  const acknowledgeAlert = async (alertId: string) => {
    console.log(`Acknowledging alert ${alertId}...`);
    const { error } = await supabase
      .from('tank_alerts')
      .update({ acknowledged_at: new Date().toISOString() })
      .eq('id', alertId);

    if (error) {
      console.error('Error acknowledging alert:', error);
      throw error;
    }

    console.log(`Alert ${alertId} acknowledged`);
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
  };

  const snoozeAlert = async (alertId: string, until: string) => {
    console.log(`Snoozing alert ${alertId} until ${until}...`);
    const { error } = await supabase
      .from('tank_alerts')
      .update({ snoozed_until: until })
      .eq('id', alertId);

    if (error) {
      console.error('Error snoozing alert:', error);
      throw error;
    }

    console.log(`Alert ${alertId} snoozed until ${until}`);
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
  };

  return {
    alerts,
    isLoading,
    error,
    acknowledgeAlert,
    snoozeAlert
  };
} 