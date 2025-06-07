import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Tank, DipReading } from '@/types/fuel';
import type { RealtimeChannel } from '@supabase/supabase-js';

const ROLLING_DAYS = 7;

export function useTanks() {
  const queryClient = useQueryClient();
  // Use a unique channel name per hook instance
  const channelNameRef = useRef(`fuel_tanks_${Math.random().toString(36).slice(2)}`);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { data: tanks, isLoading, error } = useQuery({
    queryKey: ['tanks'],
    queryFn: async () => {
      // Fetch tanks
      const { data: tankData, error: tankError } = await supabase
        .from('tanks_with_latest_dip')
        .select('*');
      if (tankError) throw tankError;
      const tanks = tankData || [];
      // Fetch last 7 days of dip readings for all tanks
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - ROLLING_DAYS - 1); // +1 for intervals
      const { data: dipsData, error: dipsError } = await supabase
        .from('dip_readings')
        .select('id, tank_id, value, created_at')
        .gte('created_at', fromDate.toISOString());
      if (dipsError) throw dipsError;
      // Group dips by tank_id
      const dipsByTank: Record<string, DipReading[]> = {};
      (dipsData || []).forEach((d: any) => {
        if (!dipsByTank[d.tank_id]) dipsByTank[d.tank_id] = [];
        dipsByTank[d.tank_id].push({
          id: d.id,
          tankId: d.tank_id,
          tank_id: d.tank_id,
          reading: d.value,
          value: d.value,
          timestamp: d.created_at,
          created_at: d.created_at,
          recorded_at: d.created_at,
          recordedBy: '',
          recorded_by: '',
          notes: '',
        });
      });
      // Sort dips for each tank by date descending
      Object.values(dipsByTank).forEach(arr => arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      // Map tanks to set current_level, percent, rolling_avg, days_to_min_level
      return tanks.map((tank: any) => {
        const current_level = tank.latest_dip_value ?? 0;
        const current_level_percent = (tank.latest_dip_value && tank.safe_level)
          ? Math.round((tank.latest_dip_value / tank.safe_level) * 100)
          : 0;
        // Calculate rolling average usage (burn rate)
        let rolling_avg: number | null = null;
        let days_to_min_level: number | null = null;
        const dips = dipsByTank[tank.id] || [];
        if (dips.length >= 2) {
          // Calculate daily usage for each interval
          const usages: number[] = [];
          for (let i = 1; i < dips.length; i++) {
            const usage = dips[i - 1].value - dips[i].value;
            const days = (new Date(dips[i - 1].created_at).getTime() - new Date(dips[i].created_at).getTime()) / (1000 * 60 * 60 * 24);
            if (days > 0) usages.push(usage / days);
          }
          if (usages.length > 0) {
            rolling_avg = usages.reduce((a, b) => a + b, 0) / usages.length;
          }
        }
        // Calculate days to min level if min_level and rolling_avg are available
        if (
          typeof tank.min_level === 'number' &&
          rolling_avg !== null &&
          rolling_avg > 0 &&
          typeof current_level === 'number'
        ) {
          days_to_min_level = Math.max(0, Math.round((current_level - tank.min_level) / rolling_avg));
        }
        return {
          ...tank,
          current_level,
          current_level_percent,
          rolling_avg,
          days_to_min_level,
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
