/**
 * SmartFill Analytics Hooks
 * Provides data fetching for ta_smartfill_* tables with consumption trends and fleet analytics
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// Types
// ============================================================================

export interface SmartFillProvider {
  id: string;
  name: string;
  code: string;
  description?: string;
  api_base_url: string;
  is_active: boolean;
  health_status: string;
  last_health_check?: string;
}

export interface SmartFillCustomer {
  id: string;
  provider_id?: string;
  business_id?: string;
  api_reference: string;
  name: string;
  code?: string;
  contact_name?: string;
  contact_email?: string;
  sync_enabled: boolean;
  sync_priority: number;
  last_sync_at?: string;
  last_sync_status?: string;
  consecutive_failures: number;
  is_active: boolean;
  created_at: string;
}

export interface SmartFillLocation {
  id: string;
  customer_id: string;
  external_guid: string;
  unit_number: string;
  name?: string;
  description?: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  total_tanks: number;
  total_capacity?: number;
  total_volume?: number;
  avg_fill_percent?: number;
  critical_tanks: number;
  warning_tanks: number;
  latest_status?: string;
  latest_update_at?: string;
  is_active: boolean;
}

export interface SmartFillTank {
  id: string;
  location_id: string;
  customer_id: string;
  external_guid: string;
  unit_number: string;
  tank_number: string;
  name?: string;
  description?: string;
  commodity?: string;
  capacity?: number;
  safe_fill_level?: number;
  min_level?: number;
  reorder_level?: number;
  current_volume?: number;
  current_volume_percent?: number;
  current_status?: string;
  current_ullage?: number;
  avg_daily_consumption?: number;
  days_remaining?: number;
  estimated_empty_date?: string;
  consumption_trend?: string;
  health_score?: number;
  health_status: string;
  last_reading_at?: string;
  is_active: boolean;
  is_monitored: boolean;
  raw_data?: any;
  created_at: string;
  updated_at: string;
}

export interface SmartFillReading {
  id: string;
  tank_id: string;
  volume?: number;
  volume_percent?: number;
  status?: string;
  capacity?: number;
  safe_fill_level?: number;
  ullage?: number;
  volume_change?: number;
  is_refill: boolean;
  reading_at: string;
  api_timestamp?: string;
  timezone?: string;
  created_at: string;
}

export interface SmartFillSyncLog {
  id: string;
  sync_type: string;
  trigger_source?: string;
  sync_status: string;
  customers_attempted: number;
  customers_success: number;
  customers_failed: number;
  locations_processed: number;
  tanks_processed: number;
  readings_stored: number;
  duration_ms?: number;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

export interface SmartFillAlert {
  id: string;
  tank_id: string;
  alert_type: string;
  severity: string;
  title: string;
  message?: string;
  current_value?: number;
  threshold_value?: number;
  is_active: boolean;
  acknowledged_at?: string;
  resolved_at?: string;
  triggered_at: string;
}

export interface SmartFillCustomerSummary {
  customer_id: string;
  customer_name: string;
  business_id?: string;
  is_active: boolean;
  sync_enabled: boolean;
  last_sync_at?: string;
  last_sync_status?: string;
  consecutive_failures: number;
  location_count: number;
  tank_count: number;
  avg_fill_percent?: number;
  critical_tanks: number;
  warning_tanks: number;
  healthy_tanks: number;
  total_capacity?: number;
  total_volume?: number;
  fleet_fill_percent?: number;
  oldest_reading?: string;
  newest_reading?: string;
  avg_days_remaining?: number;
  health_score: number;
}

export interface SmartFillFleetOverview {
  total_customers: number;
  active_customers: number;
  total_locations: number;
  total_tanks: number;
  critical_tanks: number;
  warning_tanks: number;
  healthy_tanks: number;
  stale_tanks: number;
  avg_fill_percent?: number;
  total_capacity?: number;
  total_volume?: number;
  avg_days_remaining?: number;
  last_successful_sync?: string;
  active_alerts: number;
}

export interface SmartFillConsumptionDaily {
  tank_id: string;
  customer_id: string;
  customer_name: string;
  unit_number: string;
  tank_number: string;
  capacity?: number;
  reading_date: string;
  reading_count: number;
  max_volume?: number;
  min_volume?: number;
  daily_consumption?: number;
  avg_fill_percent?: number;
  had_refill: boolean;
}

export interface SmartFillTankTrend {
  tank_id: string;
  customer_name: string;
  unit_number: string;
  tank_number: string;
  description?: string;
  capacity?: number;
  volume?: number;
  volume_percent?: number;
  status?: string;
  volume_change?: number;
  is_refill: boolean;
  reading_at: string;
  local_time: string;
}

// ============================================================================
// Fleet Overview Hook
// ============================================================================

export function useSmartFillFleetOverview() {
  return useQuery({
    queryKey: ['smartfill-fleet-overview'],
    queryFn: async (): Promise<SmartFillFleetOverview> => {
      // Try new ta_smartfill_fleet_overview view first
      const { data: overview, error } = await supabase
        .from('ta_smartfill_fleet_overview')
        .select('*')
        .single();

      if (error) {
        console.warn('[SmartFill Analytics] Fleet overview view not available, calculating from tables');

        // Fallback: calculate from legacy tables
        const { data: customers } = await supabase
          .from('smartfill_customers')
          .select('id')
          .eq('active', true);

        const { data: locations } = await supabase
          .from('smartfill_locations')
          .select('id');

        const { data: tanks } = await supabase
          .from('smartfill_tanks')
          .select('id, latest_volume_percent, latest_update_time');

        const { data: syncLogs } = await supabase
          .from('smartfill_sync_logs')
          .select('completed_at')
          .eq('sync_status', 'success')
          .order('completed_at', { ascending: false })
          .limit(1);

        const tankArray = tanks || [];
        const critical = tankArray.filter(t => (t.latest_volume_percent || 0) < 20).length;
        const warning = tankArray.filter(t => {
          const pct = t.latest_volume_percent || 0;
          return pct >= 20 && pct < 40;
        }).length;
        const stale = tankArray.filter(t => {
          if (!t.latest_update_time) return true;
          const hoursSince = (Date.now() - new Date(t.latest_update_time).getTime()) / (1000 * 60 * 60);
          return hoursSince > 24;
        }).length;

        return {
          total_customers: customers?.length || 0,
          active_customers: customers?.length || 0,
          total_locations: locations?.length || 0,
          total_tanks: tankArray.length,
          critical_tanks: critical,
          warning_tanks: warning,
          healthy_tanks: tankArray.length - critical - warning,
          stale_tanks: stale,
          avg_fill_percent: tankArray.length > 0
            ? tankArray.reduce((sum, t) => sum + (t.latest_volume_percent || 0), 0) / tankArray.length
            : undefined,
          total_capacity: undefined,
          total_volume: undefined,
          avg_days_remaining: undefined,
          last_successful_sync: syncLogs?.[0]?.completed_at,
          active_alerts: critical,
        };
      }

      return overview as SmartFillFleetOverview;
    },
    refetchInterval: 60 * 1000, // Refresh every minute
    staleTime: 30 * 1000,
  });
}

// ============================================================================
// Customer Summary Hook
// ============================================================================

export function useSmartFillCustomerSummaries() {
  return useQuery({
    queryKey: ['smartfill-customer-summaries'],
    queryFn: async (): Promise<SmartFillCustomerSummary[]> => {
      // Try new view first
      const { data, error } = await supabase
        .from('ta_smartfill_customer_summary')
        .select('*')
        .order('customer_name');

      if (error) {
        console.warn('[SmartFill Analytics] Customer summary view not available');
        return [];
      }

      return data as SmartFillCustomerSummary[];
    },
    staleTime: 2 * 60 * 1000,
  });
}

// ============================================================================
// Tanks Hook (with enriched data)
// ============================================================================

export function useSmartFillTanks(options?: {
  customerId?: string;
  locationId?: string;
  healthStatus?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['smartfill-tanks', options],
    queryFn: async (): Promise<SmartFillTank[]> => {
      // Try new ta_smartfill_tanks first
      let query = supabase
        .from('ta_smartfill_tanks')
        .select(`
          *,
          location:ta_smartfill_locations(name, unit_number),
          customer:ta_smartfill_customers(name)
        `)
        .eq('is_active', true)
        .eq('is_monitored', true)
        .order('current_volume_percent', { ascending: true });

      if (options?.customerId) {
        query = query.eq('customer_id', options.customerId);
      }
      if (options?.locationId) {
        query = query.eq('location_id', options.locationId);
      }
      if (options?.healthStatus) {
        query = query.eq('health_status', options.healthStatus);
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[SmartFill Analytics] ta_smartfill_tanks not available, using legacy');

        // Fallback to legacy smartfill_tanks
        const { data: legacyData } = await supabase
          .from('smartfill_tanks')
          .select(`
            *,
            location:smartfill_locations(customer_name, unit_number, description)
          `)
          .order('latest_volume_percent', { ascending: true })
          .limit(options?.limit || 1000);

        // Transform legacy data to new format
        return (legacyData || []).map(t => ({
          id: t.id,
          location_id: t.location_id,
          customer_id: t.customer_id,
          external_guid: t.tank_guid,
          unit_number: t.unit_number,
          tank_number: t.tank_number,
          name: t.description,
          description: t.description,
          capacity: t.capacity,
          safe_fill_level: t.safe_fill_level,
          current_volume: t.latest_volume,
          current_volume_percent: t.latest_volume_percent,
          current_status: t.latest_status,
          health_status: (t.latest_volume_percent || 0) < 20 ? 'critical' :
                        (t.latest_volume_percent || 0) < 40 ? 'warning' : 'healthy',
          last_reading_at: t.latest_update_time,
          is_active: true,
          is_monitored: true,
          raw_data: t.raw_data,
          created_at: t.created_at,
          updated_at: t.updated_at,
        })) as SmartFillTank[];
      }

      return data as SmartFillTank[];
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });
}

// ============================================================================
// Consumption Trends Hook
// ============================================================================

export function useSmartFillConsumptionTrends(tankId?: string, days = 30) {
  return useQuery({
    queryKey: ['smartfill-consumption-trends', tankId, days],
    queryFn: async (): Promise<SmartFillConsumptionDaily[]> => {
      // Try new view
      let query = supabase
        .from('ta_smartfill_consumption_daily')
        .select('*')
        .gte('reading_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('reading_date', { ascending: false });

      if (tankId) {
        query = query.eq('tank_id', tankId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('[SmartFill Analytics] Consumption view not available');
        return [];
      }

      return data as SmartFillConsumptionDaily[];
    },
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Tank Trends Hook (for charts)
// ============================================================================

export function useSmartFillTankTrends(tankId: string, days = 30) {
  return useQuery({
    queryKey: ['smartfill-tank-trends', tankId, days],
    queryFn: async (): Promise<SmartFillTankTrend[]> => {
      // Try new view
      const { data, error } = await supabase
        .from('ta_smartfill_tank_trends')
        .select('*')
        .eq('tank_id', tankId)
        .order('reading_at', { ascending: true })
        .limit(500);

      if (error) {
        console.warn('[SmartFill Analytics] Tank trends view not available, using readings');

        // Fallback to readings history
        const { data: readings } = await supabase
          .from('smartfill_readings_history')
          .select('*')
          .eq('tank_id', tankId)
          .gte('update_time', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
          .order('update_time', { ascending: true });

        return (readings || []).map(r => ({
          tank_id: r.tank_id,
          customer_name: '',
          unit_number: '',
          tank_number: '',
          capacity: r.capacity,
          volume: r.volume,
          volume_percent: r.volume_percent,
          status: r.status,
          volume_change: null,
          is_refill: false,
          reading_at: r.update_time,
          local_time: r.update_time,
        })) as SmartFillTankTrend[];
      }

      return data as SmartFillTankTrend[];
    },
    enabled: !!tankId,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Sync Logs Hook
// ============================================================================

export function useSmartFillSyncLogs(limit = 20) {
  return useQuery({
    queryKey: ['smartfill-sync-logs', limit],
    queryFn: async (): Promise<SmartFillSyncLog[]> => {
      // Try new table first
      const { data, error } = await supabase
        .from('ta_smartfill_sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) {
        // Fallback to legacy table
        const { data: legacyData } = await supabase
          .from('smartfill_sync_logs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(limit);

        return (legacyData || []).map(l => ({
          id: l.id,
          sync_type: l.sync_type,
          sync_status: l.sync_status,
          customers_attempted: 0,
          customers_success: 0,
          customers_failed: 0,
          locations_processed: l.locations_processed || 0,
          tanks_processed: l.tanks_processed || 0,
          readings_stored: l.readings_processed || 0,
          duration_ms: l.sync_duration_ms,
          error_message: l.error_message,
          started_at: l.started_at,
          completed_at: l.completed_at,
        })) as SmartFillSyncLog[];
      }

      return data as SmartFillSyncLog[];
    },
    refetchInterval: 2 * 60 * 1000,
  });
}

// ============================================================================
// Sync Analytics Hook
// ============================================================================

export function useSmartFillSyncAnalytics(days = 30) {
  return useQuery({
    queryKey: ['smartfill-sync-analytics', days],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ta_smartfill_sync_analytics')
        .select('*')
        .order('sync_date', { ascending: false })
        .limit(days);

      if (error) {
        console.warn('[SmartFill Analytics] Sync analytics view not available');
        return [];
      }

      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================================
// Active Alerts Hook
// ============================================================================

export function useSmartFillActiveAlerts() {
  return useQuery({
    queryKey: ['smartfill-active-alerts'],
    queryFn: async (): Promise<SmartFillAlert[]> => {
      const { data, error } = await supabase
        .from('ta_smartfill_active_alerts')
        .select('*')
        .order('triggered_at', { ascending: false });

      if (error) {
        console.warn('[SmartFill Analytics] Active alerts view not available');
        return [];
      }

      return data as SmartFillAlert[];
    },
    refetchInterval: 60 * 1000,
  });
}

// ============================================================================
// Manual Sync Mutation
// ============================================================================

export function useSmartFillManualSync() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/cron/smartfill-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer manual-sync',
        },
      });

      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all SmartFill queries
      queryClient.invalidateQueries({ queryKey: ['smartfill'] });
      queryClient.invalidateQueries({ queryKey: ['smartfill-fleet-overview'] });
      queryClient.invalidateQueries({ queryKey: ['smartfill-customer-summaries'] });
      queryClient.invalidateQueries({ queryKey: ['smartfill-tanks'] });
      queryClient.invalidateQueries({ queryKey: ['smartfill-sync-logs'] });

      toast({
        title: 'SmartFill Sync Complete',
        description: `${data.summary?.customers_success || 0} customers synced, ${data.summary?.tanks_processed || 0} tanks updated`,
      });
    },
    onError: (error) => {
      toast({
        title: 'SmartFill Sync Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });
}

// ============================================================================
// Days Until Empty Calculator
// ============================================================================

export function useSmartFillDaysUntilEmpty(tankId: string) {
  return useQuery({
    queryKey: ['smartfill-days-until-empty', tankId],
    queryFn: async () => {
      // Try calling the database function
      const { data, error } = await supabase
        .rpc('ta_smartfill_calc_days_remaining', { p_tank_id: tankId });

      if (error) {
        console.warn('[SmartFill Analytics] Days remaining function not available');
        return null;
      }

      return data?.[0] || null;
    },
    enabled: !!tankId,
    staleTime: 10 * 60 * 1000,
  });
}

// ============================================================================
// Helper: Get percentage color
// ============================================================================

export function getSmartFillPercentageColor(percentage: number | null | undefined): string {
  if (percentage === null || percentage === undefined) return 'text-gray-400';
  if (percentage < 20) return 'text-red-600';
  if (percentage < 40) return 'text-yellow-600';
  return 'text-green-600';
}

export function getSmartFillPercentageBgColor(percentage: number | null | undefined): string {
  if (percentage === null || percentage === undefined) return 'bg-gray-200';
  if (percentage < 20) return 'bg-red-500';
  if (percentage < 40) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function getSmartFillHealthColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'critical': return 'text-red-600';
    case 'warning': return 'text-yellow-600';
    case 'healthy': return 'text-green-600';
    default: return 'text-gray-600';
  }
}

// ============================================================================
// Sync Health Status Hook
// ============================================================================

export type SyncHealthLevel = 'healthy' | 'warning' | 'critical' | 'unknown';

export interface SyncHealthStatus {
  level: SyncHealthLevel;
  lastSyncAt: string | null;
  hoursSinceSync: number | null;
  message: string;
  isStale: boolean;
}

export function useSyncHealthStatus() {
  const { data: syncLogs, isLoading } = useSmartFillSyncLogs(1);

  const getHealthStatus = (): SyncHealthStatus => {
    if (!syncLogs || syncLogs.length === 0) {
      return {
        level: 'unknown',
        lastSyncAt: null,
        hoursSinceSync: null,
        message: 'No sync history available',
        isStale: true,
      };
    }

    const lastSync = syncLogs[0];
    const lastSyncTime = lastSync.completed_at || lastSync.started_at;

    if (!lastSyncTime) {
      return {
        level: 'unknown',
        lastSyncAt: null,
        hoursSinceSync: null,
        message: 'No sync timestamp available',
        isStale: true,
      };
    }

    const now = new Date();
    const syncDate = new Date(lastSyncTime);
    const hoursSince = (now.getTime() - syncDate.getTime()) / (1000 * 60 * 60);

    if (hoursSince <= 2) {
      return {
        level: 'healthy',
        lastSyncAt: lastSyncTime,
        hoursSinceSync: hoursSince,
        message: `Synced ${formatSmartFillRelativeTime(lastSyncTime)}`,
        isStale: false,
      };
    } else if (hoursSince <= 6) {
      return {
        level: 'warning',
        lastSyncAt: lastSyncTime,
        hoursSinceSync: hoursSince,
        message: `Last sync ${formatSmartFillRelativeTime(lastSyncTime)} - sync may be delayed`,
        isStale: false,
      };
    } else {
      return {
        level: 'critical',
        lastSyncAt: lastSyncTime,
        hoursSinceSync: hoursSince,
        message: `Sync stale - last synced ${formatSmartFillRelativeTime(lastSyncTime)}`,
        isStale: true,
      };
    }
  };

  return {
    ...getHealthStatus(),
    isLoading,
    lastSyncStatus: syncLogs?.[0]?.sync_status,
    lastSyncCustomersSuccess: syncLogs?.[0]?.customers_success,
    lastSyncCustomersFailed: syncLogs?.[0]?.customers_failed,
    lastSyncReadingsStored: syncLogs?.[0]?.readings_stored,
  };
}

// ============================================================================
// Helper: Format relative time
// ============================================================================

export function formatSmartFillRelativeTime(timestamp: string | null | undefined): string {
  if (!timestamp) return 'No data';

  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  } catch {
    return 'Invalid date';
  }
}
