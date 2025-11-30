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
    queryKey: ['alerts', tankId ?? 'all'],
    // Always enabled - fetch all alerts if no tankId, or tank-specific if provided
    queryFn: async () => {
      let query = supabase
        .from('tank_alerts')
        .select(`
          *,
          fuel_tanks (
            id,
            location,
            group_id,
            product_type,
            tank_groups!fuel_tanks_group_id_fkey ( name )
          )
        `)
        .is('acknowledged_at', null)
        .order('created_at', { ascending: false });

      // Filter by tank if tankId provided
      if (tankId) {
        query = query.eq('tank_id', tankId);
      }

      const { data, error } = await query;

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
        // Invalidate both the specific tank query and the 'all' query
        queryClient.invalidateQueries({ queryKey: ['alerts', tankId ?? 'all'] });
        if (tankId) {
          queryClient.invalidateQueries({ queryKey: ['alerts', 'all'] });
        }
      })
      .subscribe();
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient, tankId]);

  // Helper to invalidate all related alert queries
  const invalidateAlertQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['alerts', tankId ?? 'all'] });
    // Always invalidate 'all' to keep AlertsPage in sync
    queryClient.invalidateQueries({ queryKey: ['alerts', 'all'] });
  };

  const { mutate: markAllRead } = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('tank_alerts')
        .update({ acknowledged_at: now })
        .is('acknowledged_at', null);

      if (error) throw error;
    },
    onSuccess: invalidateAlertQueries
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
    onSuccess: invalidateAlertQueries
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
    onSuccess: invalidateAlertQueries
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