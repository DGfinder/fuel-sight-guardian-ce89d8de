import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useUserPermissions } from './useUserPermissions';
import { UserPermissions } from '../types/auth';
import { realtimeManager } from '../lib/realtime-manager';

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
  latitude?: number;
  longitude?: number;
  last_dip?: {
    value: number;
    created_at: string;
    recorded_by: string;
  } | null;
  usable_capacity?: number;
}

// Memoized tank data transformation function
const transformTankData = (rawTank: any): Tank => ({
  ...rawTank,
  id: rawTank.id,
  location: rawTank.location,
  product_type: rawTank.product,
  safe_level: rawTank.safe_fill,
  min_level: rawTank.min_level,
  group_id: rawTank.group_id,
  group_name: rawTank.group_name,
  subgroup: rawTank.subgroup,
  current_level: rawTank.current_level,
  current_level_percent: rawTank.current_level_percent_display,
  rolling_avg: rawTank.rolling_avg_lpd,
  days_to_min_level: rawTank.days_to_min_level,
  usable_capacity: rawTank.usable_capacity,
  prev_day_used: rawTank.prev_day_used,
  serviced_on: rawTank.serviced_on,
  serviced_by: rawTank.serviced_by,
  address: rawTank.address,
  vehicle: rawTank.vehicle,
  discharge: rawTank.discharge,
  bp_portal: rawTank.bp_portal,
  delivery_window: rawTank.delivery_window,
  afterhours_contact: rawTank.afterhours_contact,
  notes: rawTank.notes,
  latitude: rawTank.latitude,
  longitude: rawTank.longitude,
  last_dip: (rawTank.last_dip_ts && rawTank.current_level != null) 
    ? { 
        value: rawTank.current_level, 
        created_at: rawTank.last_dip_ts, 
        recorded_by: 'Unknown' 
      } 
    : null,
});

export function useTanks() {
  const queryClient = useQueryClient();
  const { data: permissions } = useUserPermissions();
  const userPermissions = permissions as UserPermissions | null;
  const subscriberIdRef = useRef<string | null>(null);

  // Optimized query key - only include essential permission info to reduce cache invalidations
  const queryKey = useMemo(() => {
    if (!userPermissions || !userPermissions.accessibleGroups) return ['tanks', 'no-permissions'];
    
    return [
      'tanks',
      userPermissions.isAdmin,
      userPermissions.accessibleGroups.map(g => g.id).sort().join(',')
    ];
  }, [userPermissions]);

  const { data: tanks, isLoading, error } = useQuery<Tank[]>({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from('tanks_with_rolling_avg')
        .select('*');

      // RLS will handle security, but we can optimize the query for non-admin users
      if (userPermissions && !userPermissions.isAdmin && userPermissions.accessibleGroups && userPermissions.accessibleGroups.length > 0) {
        const groupIds = userPermissions.accessibleGroups.map(g => g.id);
        query = query.in('group_id', groupIds);
      }

      const { data, error } = await query.order('last_dip_ts', { ascending: false });
      if (error) throw error;
      
      // Use memoized transformation function
      return data?.map(transformTankData) || [];
    },
    enabled: !!userPermissions, // Only run query when permissions are loaded
    staleTime: 2 * 60 * 1000, // 2 minutes - tanks don't change that frequently
    gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
    refetchOnWindowFocus: false, // Don't refetch on window focus to reduce load
    retry: (failureCount, error) => {
      // Only retry on network errors, not on auth/permission errors
      if (error?.message?.includes('permission') || error?.message?.includes('auth')) {
        return false;
      }
      return failureCount < 2;
    },
  });

  useEffect(() => {
    // Set the query client in the global manager
    realtimeManager.setQueryClient(queryClient);

    // Only subscribe if we have permissions
    if (!userPermissions) {
      return;
    }

    // Generate unique subscriber ID if we don't have one
    if (!subscriberIdRef.current) {
      subscriberIdRef.current = `useTanks_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Subscribe to global real-time updates
    realtimeManager.subscribe(subscriberIdRef.current, userPermissions);

    // Cleanup function
    return () => {
      if (subscriberIdRef.current) {
        realtimeManager.unsubscribe(subscriberIdRef.current);
      }
    };
  }, [queryClient, userPermissions]);

  const { mutate: refreshTanks } = useMutation({
    mutationFn: async () => {
      let query = supabase
        .from('tanks_with_rolling_avg')
        .select('*');

      // Apply same optimization as main query
      if (userPermissions && !userPermissions.isAdmin && userPermissions.accessibleGroups && userPermissions.accessibleGroups.length > 0) {
        const groupIds = userPermissions.accessibleGroups.map(g => g.id);
        query = query.in('group_id', groupIds);
      }

      const { data, error } = await query.order('last_dip_ts', { ascending: false });
      if (error) throw error;
      
      // Use same transformation function for consistency
      return data?.map(transformTankData) || [];
    },
    onSuccess: (data) => {
      // Update cache with optimized key
      queryClient.setQueryData(queryKey, data);
    }
  });

  const { mutate: exportTanksToCSV, isPending: isExporting } = useMutation({
    mutationFn: async () => {
      // Use cached data instead of making a new query
      const tanksData = tanks || queryClient.getQueryData<Tank[]>(queryKey);
      if (!tanksData || tanksData.length === 0) {
        throw new Error('No tank data available for export');
      }
      
      const headers = [
        'ID', 'Location', 'Product', 'Safe Level', 'Current Level', 
        'Rolling Avg', 'Days to Min', 'Group Name', 'Last Dip Value', 
        'Last Dip Date', 'Last Dip By'
      ];
      
      const csvContent = [
        headers.join(','),
        ...tanksData.map(tank => [
          `"${tank.id}"`,
          `"${tank.location || ''}"`,
          `"${tank.product_type || ''}"`,
          tank.safe_level || '',
          tank.current_level || '',
          tank.rolling_avg || '',
          tank.days_to_min_level || '',
          `"${tank.group_name || ''}"`,
          tank.last_dip?.value ?? '',
          `"${tank.last_dip?.created_at ?? ''}"`,
          `"${tank.last_dip?.recorded_by ?? ''}"`
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

  // Memoized computed values to prevent unnecessary recalculations
  const computedStats = useMemo(() => {
    if (!tanks) return { tanksCount: 0, criticalTanks: 0, lowTanks: 0 };
    
    return {
      tanksCount: tanks.length,
      criticalTanks: tanks.filter(t => (t.current_level_percent || 0) <= 20).length,
      lowTanks: tanks.filter(t => {
        const level = t.current_level_percent || 0;
        return level > 20 && level <= 40;
      }).length,
    };
  }, [tanks]);

  return {
    tanks,
    isLoading,
    error,
    refreshTanks,
    exportTanksToCSV,
    isExporting,
    ...computedStats,
  };
}
