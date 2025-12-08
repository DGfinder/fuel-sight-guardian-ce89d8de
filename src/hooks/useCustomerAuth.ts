import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

// Types for customer portal
export interface CustomerAccount {
  id: string;
  user_id: string;
  customer_contact_id: string | null;
  customer_name: string;
  customer_guid: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  company_name: string | null;
  account_type: 'customer' | 'gsf_staff';
  is_active: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  logo_url: string | null;
  logo_url_dark: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  primary_color_dark: string | null;
  secondary_color_dark: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  // Industry type determines feature visibility in customer portal
  industry_type: 'farming' | 'mining' | 'general' | null;
}

export interface CustomerTankAccess {
  id: string;
  customer_account_id: string;
  agbot_location_id: string | null;
  tank_id: string | null;
  smartfill_tank_id: string | null;
  tank_type: 'agbot' | 'smartfill' | 'dip' | 'manual' | null;
  access_level: 'read' | 'request_delivery' | 'admin';
  assigned_at: string;
  notes: string | null;
}

// Tank source type for UI display
export type TankSourceType = 'agbot' | 'smartfill' | 'dip' | 'manual' | 'unknown';

export interface CustomerTank {
  id: string;
  location_guid: string;
  customer_name: string;
  location_id: string;
  address1: string | null;
  address2: string | null;
  state: string | null;
  postcode: string | null;
  lat: number | null;
  lng: number | null;
  latest_calibrated_fill_percentage: number | null;
  latest_telemetry_epoch: number | null;
  disabled: boolean;
  // Asset data (joined)
  asset_id?: string;
  asset_serial_number?: string;
  device_online?: boolean;
  asset_days_remaining?: number | null;
  asset_daily_consumption?: number | null;
  asset_profile_water_capacity?: number | null;
  asset_current_level_liters?: number | null;
  // Access level for this customer
  access_level: 'read' | 'request_delivery' | 'admin';
  // Source type for multi-source support
  source_type: TankSourceType;
  // Source-specific IDs
  agbot_location_id?: string | null;
  smartfill_tank_id?: string | null;
  tank_id?: string | null;
  // Industry type for feature visibility (per-tank override)
  industry_type?: 'farming' | 'mining' | 'general' | null;
}

/**
 * Hook to get the current customer account
 * Returns null if user is not a customer (i.e., GSF staff)
 */
export function useCustomerAccount() {
  return useQuery<CustomerAccount | null>({
    queryKey: ['customer-account'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('customer_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        // No customer account found - user might be GSF staff
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error fetching customer account:', error);
        return null;
      }

      return data as CustomerAccount;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });
}

/**
 * Hook to check if the current user is a customer
 */
export function useIsCustomer() {
  const { data: customerAccount, isLoading } = useCustomerAccount();
  return {
    isCustomer: !!customerAccount && customerAccount.account_type === 'customer',
    isActive: !!customerAccount?.is_active,
    isLoading,
    customerAccount,
  };
}

/**
 * Hook to check if the current user is GSF staff
 * Uses the existing user_roles table
 */
export function useIsGSFStaff() {
  return useQuery<boolean>({
    queryKey: ['is-gsf-staff'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Use maybeSingle() to avoid 406 error when no role exists
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!data) {
        // No role found - not GSF staff
        return false;
      }

      // GSF staff roles
      return ['admin', 'manager', 'scheduler', 'viewer'].includes(data.role);
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get tanks assigned to the current customer
 * Supports multiple tank sources: AgBot, SmartFill, and manual dips
 */
export function useCustomerTanks() {
  const { data: customerAccount } = useCustomerAccount();

  return useQuery<CustomerTank[]>({
    queryKey: ['customer-tanks', customerAccount?.id],
    queryFn: async () => {
      if (!customerAccount) return [];

      // Try unified view first (supports all tank types)
      const { data: unifiedData, error: unifiedError } = await supabase
        .from('customer_tanks_unified')
        .select('*')
        .eq('customer_account_id', customerAccount.id);

      // If unified view exists and has data, use it
      if (!unifiedError && unifiedData && unifiedData.length > 0) {
        return unifiedData.map(tank => ({
          id: tank.tank_id || tank.agbot_location_id || tank.smartfill_tank_id,
          location_guid: tank.agbot_location_id || tank.tank_id,
          customer_name: tank.customer_name,
          location_id: tank.tank_name || tank.location_name,
          address1: tank.address,
          address2: null,
          state: null,
          postcode: null,
          lat: tank.latitude,
          lng: tank.longitude,
          latest_calibrated_fill_percentage: tank.current_level_percent,
          latest_telemetry_epoch: tank.last_reading_at ? new Date(tank.last_reading_at).getTime() / 1000 : null,
          disabled: false,
          asset_id: tank.agbot_asset_id,
          asset_serial_number: null,
          device_online: tank.device_online,
          // Use AgBot data first, fall back to dip data for manual tanks
          asset_days_remaining: tank.days_remaining ?? tank.dip_days_remaining,
          asset_daily_consumption: tank.daily_consumption_liters ?? tank.dip_daily_consumption_liters,
          asset_profile_water_capacity: tank.capacity_liters,
          asset_current_level_liters: tank.current_level_liters,
          access_level: tank.access_level || 'read',
          source_type: (tank.source_type as TankSourceType) || 'unknown',
          agbot_location_id: tank.agbot_location_id,
          smartfill_tank_id: tank.smartfill_tank_id,
          tank_id: tank.tank_id,
          industry_type: tank.industry_type || null,
        } as CustomerTank));
      }

      // Fallback to legacy AgBot-only query
      console.log('[useCustomerTanks] Falling back to legacy AgBot query');

      // Get tank access assignments
      const { data: accessData, error: accessError } = await supabase
        .from('customer_tank_access')
        .select('agbot_location_id, access_level')
        .eq('customer_account_id', customerAccount.id);

      if (accessError) {
        console.error('Error fetching tank access:', accessError);
        return [];
      }

      if (!accessData || accessData.length === 0) {
        return [];
      }

      const locationIds = accessData.filter(a => a.agbot_location_id).map(a => a.agbot_location_id);
      const accessMap = new Map(accessData.map(a => [a.agbot_location_id, a.access_level]));

      if (locationIds.length === 0) {
        return [];
      }

      // Get tank details with assets
      const { data: locations, error: locationsError } = await supabase
        .from('ta_agbot_locations')
        .select(`
          id,
          external_guid,
          customer_name,
          name,
          address,
          state,
          postcode,
          latitude,
          longitude,
          calibrated_fill_level,
          last_telemetry_epoch,
          is_disabled,
          industry_type,
          ta_agbot_assets (
            id,
            serial_number,
            is_online,
            days_remaining,
            daily_consumption_liters,
            capacity_liters,
            current_level_percent,
            current_level_liters
          )
        `)
        .in('id', locationIds)
        .eq('is_disabled', false);

      if (locationsError) {
        console.error('Error fetching tank locations:', locationsError);
        return [];
      }

      // Transform to CustomerTank format
      return (locations || []).map(loc => {
        const assets = Array.isArray(loc.ta_agbot_assets) ? loc.ta_agbot_assets : [];
        const asset = assets[0];

        const assetFillLevels = assets
          .filter(a => a.current_level_percent != null && a.current_level_percent !== undefined)
          .map(a => a.current_level_percent as number);

        const calculatedFillLevel = assetFillLevels.length > 0
          ? assetFillLevels.reduce((sum, level) => sum + level, 0) / assetFillLevels.length
          : loc.calibrated_fill_level;

        return {
          id: loc.id,
          location_guid: loc.external_guid,
          customer_name: loc.customer_name,
          location_id: loc.name,
          address1: loc.address,
          address2: null,
          state: loc.state,
          postcode: loc.postcode,
          lat: loc.latitude,
          lng: loc.longitude,
          latest_calibrated_fill_percentage: calculatedFillLevel,
          latest_telemetry_epoch: loc.last_telemetry_epoch,
          disabled: loc.is_disabled,
          asset_id: asset?.id,
          asset_serial_number: asset?.serial_number,
          device_online: asset?.is_online,
          asset_days_remaining: asset?.days_remaining,
          asset_daily_consumption: asset?.daily_consumption_liters,
          asset_profile_water_capacity: asset?.capacity_liters,
          asset_current_level_liters: asset?.current_level_liters,
          access_level: accessMap.get(loc.id) || 'read',
          source_type: 'agbot' as TankSourceType,
          agbot_location_id: loc.id,
          smartfill_tank_id: null,
          tank_id: null,
          industry_type: loc.industry_type || null,
        } as CustomerTank;
      });
    },
    enabled: !!customerAccount,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to get a specific tank for the customer
 */
export function useCustomerTank(locationId: string | undefined) {
  const { data: tanks } = useCustomerTanks();

  return useQuery<CustomerTank | null>({
    queryKey: ['customer-tank', locationId],
    queryFn: async () => {
      if (!locationId || !tanks) return null;
      return tanks.find(t => t.id === locationId) || null;
    },
    enabled: !!locationId && !!tanks,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to check if customer can request delivery for a tank
 */
export function useCanRequestDelivery(locationId: string | undefined) {
  const { data: tanks } = useCustomerTanks();

  if (!locationId || !tanks) return false;

  const tank = tanks.find(t => t.id === locationId);
  return tank?.access_level === 'request_delivery' || tank?.access_level === 'admin';
}

/**
 * Hook to update last login timestamp
 */
export function useUpdateLastLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('customer_accounts')
        .update({ last_login_at: new Date().toISOString() })
        .eq('user_id', user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-account'] });
    },
  });
}

/**
 * Hook to get customer's delivery requests
 */
export function useCustomerDeliveryRequests() {
  const { data: customerAccount } = useCustomerAccount();

  return useQuery({
    queryKey: ['customer-delivery-requests', customerAccount?.id],
    queryFn: async () => {
      if (!customerAccount) return [];

      const { data, error } = await supabase
        .from('delivery_requests')
        .select(`
          *,
          ta_agbot_locations (
            name,
            address,
            customer_name,
            calibrated_fill_level
          )
        `)
        .eq('customer_account_id', customerAccount.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching delivery requests:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!customerAccount,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook to create a delivery request
 */
export function useCreateDeliveryRequest() {
  const queryClient = useQueryClient();
  const { data: customerAccount } = useCustomerAccount();

  return useMutation({
    mutationFn: async (request: {
      agbot_location_id: string;
      request_type: 'standard' | 'urgent' | 'scheduled';
      requested_date?: string;
      requested_litres?: number;
      current_level_pct?: number;
      notes?: string;
    }) => {
      if (!customerAccount) {
        throw new Error('No customer account found');
      }

      const { data, error } = await supabase
        .from('delivery_requests')
        .insert({
          customer_account_id: customerAccount.id,
          agbot_location_id: request.agbot_location_id,
          request_type: request.request_type,
          requested_date: request.requested_date,
          requested_litres: request.requested_litres,
          current_level_pct: request.current_level_pct,
          notes: request.notes,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-delivery-requests'] });
    },
  });
}

/**
 * Hook to get customer portal summary stats
 */
export function useCustomerPortalSummary() {
  const { data: tanks } = useCustomerTanks();
  const { data: requests } = useCustomerDeliveryRequests();

  const summary = {
    totalTanks: tanks?.length || 0,
    lowFuelTanks: tanks?.filter(t => (t.latest_calibrated_fill_percentage || 0) < 25).length || 0,
    criticalTanks: tanks?.filter(t => (t.latest_calibrated_fill_percentage || 0) < 15).length || 0,
    onlineTanks: tanks?.filter(t => t.device_online).length || 0,
    pendingRequests: requests?.filter(r => r.status === 'pending').length || 0,
    scheduledDeliveries: requests?.filter(r => r.status === 'scheduled').length || 0,
  };

  return summary;
}

/**
 * Hook to get tank reading history for a customer's tank
 */
export function useCustomerTankHistory(assetId: string | undefined, days: number = 30) {
  return useQuery({
    queryKey: ['customer-tank-history', assetId, days],
    queryFn: async () => {
      if (!assetId) return [];

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('ta_agbot_readings')
        .select('level_percent, reading_at, is_online')
        .eq('asset_id', assetId)
        .gte('reading_at', startDate.toISOString())
        .order('reading_at', { ascending: true });

      if (error) {
        console.error('Error fetching tank history:', error);
        return [];
      }

      // Map new column names to old interface for compatibility
      return (data || []).map(r => ({
        calibrated_fill_percentage: r.level_percent,
        reading_timestamp: r.reading_at,
        device_online: r.is_online
      }));
    },
    enabled: !!assetId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get customer preferences
 */
export function useCustomerPreferences() {
  return useQuery({
    queryKey: ['customer-preferences'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/customer/preferences', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch preferences');
      }

      return response.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to update customer preferences
 */
export function useUpdateCustomerPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: {
      default_critical_threshold_pct?: number;
      default_warning_threshold_pct?: number;
      delivery_notification_email?: string;
      enable_low_fuel_alerts?: boolean;
      enable_delivery_confirmations?: boolean;
      default_chart_days?: number;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/customer/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update preferences');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-preferences'] });
    },
  });
}

/**
 * Hook to get tank thresholds (includes overrides and defaults)
 */
export function useTankThresholds() {
  const { data: preferences } = useCustomerPreferences();

  return useQuery({
    queryKey: ['tank-thresholds'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/customer/tank-thresholds', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch tank thresholds');
      }

      const tankAccess = await response.json();

      // Enrich with default thresholds from preferences
      return tankAccess.map((access: any) => ({
        ...access,
        effective_critical_threshold: access.customer_tank_thresholds?.critical_threshold_pct
          ?? preferences?.default_critical_threshold_pct
          ?? 15,
        effective_warning_threshold: access.customer_tank_thresholds?.warning_threshold_pct
          ?? preferences?.default_warning_threshold_pct
          ?? 25,
        has_override: !!access.customer_tank_thresholds,
      }));
    },
    enabled: !!preferences,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to update tank threshold override
 */
export function useUpdateTankThreshold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      customer_tank_access_id: string;
      critical_threshold_pct?: number | null;
      warning_threshold_pct?: number | null;
      notes?: string;
    }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/customer/tank-thresholds', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update tank threshold');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tank-thresholds'] });
    },
  });
}

/**
 * Hook to delete tank threshold override (revert to defaults)
 */
export function useDeleteTankThreshold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (customerTankAccessId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `/api/customer/tank-thresholds?customer_tank_access_id=${customerTankAccessId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete tank threshold');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tank-thresholds'] });
    },
  });
}
