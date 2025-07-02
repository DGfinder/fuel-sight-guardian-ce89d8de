import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useUserPermissions } from './useUserPermissions';
import { UserPermissions } from '../types/auth';

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
  subgroup?: string;
  current_level?: number;
  current_level_percent?: number;
  rolling_avg?: number;
  days_to_min_level?: number;
  latest_dip_value?: number;
  latest_dip_date?: string;
  latest_dip_by?: string;
  prev_day_used?: number;
  serviced_on?: string;
  serviced_by?: string;
  address?: string;
  vehicle?: string;
  discharge?: string;
  bp_portal?: string;
  delivery_window?: string;
  afterhours_contact?: string;
  notes?: string;
  last_dip?: {
    value: number;
    created_at: string;
    recorded_by: string;
  } | null;
  usable_capacity?: number;
}

export function useTanks() {
  const queryClient = useQueryClient();
  const { data: permissions } = useUserPermissions();
  const userPermissions = permissions as UserPermissions | null;
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { data: tanks, isLoading, error } = useQuery<Tank[]>({
    queryKey: ['tanks', userPermissions],
    queryFn: async () => {
      let query = supabase
        .from('tanks_with_rolling_avg')
        .select('*');

      // RLS will handle security, but we can optimize the query for non-admin users
      if (userPermissions && !userPermissions.isAdmin && userPermissions.accessibleGroups.length > 0) {
        const groupIds = userPermissions.accessibleGroups.map(g => g.id);
        query = query.in('group_id', groupIds);
      }

      const { data, error } = await query.order('last_dip_ts', { ascending: false });
      if (error) throw error;
      return data?.map(tank => ({
        ...tank,
        id: tank.id,
        location: tank.location,
        product_type: tank.product,
        safe_level: tank.safe_fill,
        min_level: tank.min_level,
        group_id: tank.group_id,
        group_name: tank.group_name,
        subgroup: tank.subgroup,
        current_level: tank.current_level,
        current_level_percent: tank.current_level_percent_display,
        rolling_avg: tank.rolling_avg_lpd,
        days_to_min_level: tank.days_to_min_level,
        usable_capacity: tank.usable_capacity,
        prev_day_used: tank.prev_day_used,
        serviced_on: tank.serviced_on,
        serviced_by: tank.serviced_by,
        address: tank.address,
        vehicle: tank.vehicle,
        discharge: tank.discharge,
        bp_portal: tank.bp_portal,
        delivery_window: tank.delivery_window,
        afterhours_contact: tank.afterhours_contact,
        notes: tank.notes,
        last_dip: (tank.last_dip_ts && tank.current_level != null) 
          ? { 
              value: tank.current_level, 
              created_at: tank.last_dip_ts, 
              recorded_by: 'Unknown' 
            } 
          : null,
      }));
    },
    enabled: !!userPermissions // Only run query when permissions are loaded
  });

  useEffect(() => {
    // Ensure we only subscribe when the user has permissions and we haven't already subscribed
    if (!userPermissions || channelRef.current) {
      return;
    }

    // Create the channel and store it in the ref
    channelRef.current = supabase
      .channel('fuel_tanks_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fuel_tanks' },
        (payload) => {
          console.log('Real-time change received!', payload);
          // Invalidate the query to force a refetch
          queryClient.invalidateQueries({ queryKey: ['tanks', userPermissions] });
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to fuel_tanks_changes!');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('Channel error:', err);
        }
      });

    // Cleanup function to remove the channel subscription when the component unmounts
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [queryClient, userPermissions]);

  const { mutate: refreshTanks } = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('tanks_with_rolling_avg')
        .select('*')
        .order('last_dip_ts', { ascending: false });
      if (error) throw error;
      return data?.map(tank => ({
        ...tank,
        product_type: tank.product,
        safe_level: tank.safe_fill,
        current_level: tank.current_level,
        current_level_percent: tank.current_level_percent_display,
        rolling_avg: tank.rolling_avg_lpd,
        usable_capacity: tank.usable_capacity,
        address: tank.address,
        vehicle: tank.vehicle,
        discharge: tank.discharge,
        bp_portal: tank.bp_portal,
        delivery_window: tank.delivery_window,
        afterhours_contact: tank.afterhours_contact,
        notes: tank.notes,
        last_dip: (tank.last_dip_ts && tank.current_level != null) 
          ? { 
              value: tank.current_level, 
              created_at: tank.last_dip_ts, 
              recorded_by: 'Unknown' 
            } 
          : null,
      }));
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['tanks', userPermissions], data);
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
