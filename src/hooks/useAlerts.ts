import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TankAlert } from '@/types/fuel';
import type { RealtimeChannel } from '@supabase/supabase-js';

export function useAlerts(tankId?: string) {
  const queryClient = useQueryClient();
  const channelNameRef = useRef(`tank_alerts_${Math.random().toString(36).slice(2)}`);
  const channelRef = useRef(null);

  const { data: alerts = [], isLoading, error } = useQuery({
    queryKey: ['alerts', tankId],
    enabled: !!tankId,
    queryFn: async () => {
      if (!tankId) return [];
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
        .eq('tank_id', tankId)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching alerts:', error);
        throw error;
      }

      if (!data) {
        return [];
      }

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
        queryClient.invalidateQueries({ queryKey: ['alerts', tankId] });
      })
      .subscribe();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient, tankId]);

  const { mutate: markAllRead } = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('tank_alerts')
        .update({ acknowledged_at: now })
        .is('acknowledged_at', null);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', tankId] });
    }
  });

  const { mutate: markAlertRead } = useMutation({
    mutationFn: async (alertId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('tank_alerts')
        .update({ acknowledged_at: now })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', tankId] });
    }
  });

  const { mutate: snoozeAlert } = useMutation({
    mutationFn: async ({ alertId, hours }: { alertId: string; hours: number }) => {
      const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('tank_alerts')
        .update({ snoozed_until: snoozeUntil })
        .eq('id', alertId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', tankId] });
    }
  });

  return {
    alerts,
    isLoading,
    error,
    markAllRead,
    markAlertRead,
    snoozeAlert
  };
} 