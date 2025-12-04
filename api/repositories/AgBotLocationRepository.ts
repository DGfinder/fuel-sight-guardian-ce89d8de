/**
 * AgBot Location Repository
 * Data access layer for ta_agbot_locations table
 *
 * Responsibilities:
 * - All queries to ta_agbot_locations table
 * - Location CRUD operations
 * - Location search and filtering
 * - Sync status updates
 *
 * Tables Accessed:
 * - ta_agbot_locations (primary)
 *
 * Zero business logic - pure data access only
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface AgBotLocation {
  id: string;
  external_guid: string;
  name: string;
  customer_name: string | null;
  customer_guid: string | null;
  tenancy_name: string | null;
  address: string | null;
  state: string | null;
  postcode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  installation_status: number;
  installation_status_label: string | null;
  is_disabled: boolean;
  daily_consumption_liters: number | null;
  days_remaining: number | null;
  calibrated_fill_level: number | null;
  total_assets: number;
  assets_online: number;
  avg_fill_percent: number | null;
  last_telemetry_at: string | null;
  last_telemetry_epoch: number | null;
  created_at: string;
  updated_at: string;
}

export interface LocationCreateInput {
  external_guid: string;
  name: string;
  customer_name?: string;
  customer_guid?: string;
  tenancy_name?: string;
  address?: string;
  state?: string;
  postcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  installation_status?: number;
  installation_status_label?: string;
  is_disabled?: boolean;
  daily_consumption_liters?: number;
  days_remaining?: number;
  calibrated_fill_level?: number;
  last_telemetry_at?: string;
  last_telemetry_epoch?: number;
}

export interface LocationUpdateInput {
  name?: string;
  customer_name?: string;
  address?: string;
  calibrated_fill_level?: number;
  daily_consumption_liters?: number;
  days_remaining?: number;
  total_assets?: number;
  assets_online?: number;
  avg_fill_percent?: number;
  last_telemetry_at?: string;
  last_telemetry_epoch?: number;
  is_disabled?: boolean;
}

export interface LocationStats {
  total: number;
  active: number;
  disabled: number;
  onlineAssets: number;
  totalAssets: number;
}

export class AgBotLocationRepository {
  constructor(private db: SupabaseClient) {}

  /**
   * Finds all locations, optionally including disabled ones
   */
  async findAll(includeDisabled: boolean = false): Promise<AgBotLocation[]> {
    // TEMPORARY: Using public schema until great_southern_fuels is exposed in Supabase API settings
    let query = this.db.from('ta_agbot_locations').select('*').order('name', { ascending: true });

    if (!includeDisabled) {
      query = query.eq('is_disabled', false);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch locations: ${error.message}`);
    }

    return (data || []) as AgBotLocation[];
  }

  /**
   * Finds a location by ID
   */
  async findById(id: string): Promise<AgBotLocation | null> {
    const { data, error } = await this.db
      .from('ta_agbot_locations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch location: ${error.message}`);
    }

    return data as AgBotLocation;
  }

  /**
   * Finds a location by external GUID
   */
  async findByExternalGuid(externalGuid: string): Promise<AgBotLocation | null> {
    const { data, error} = await this.db
      .from('ta_agbot_locations')
      .select('*')
      .eq('external_guid', externalGuid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch location by external GUID: ${error.message}`);
    }

    return data as AgBotLocation;
  }

  /**
   * Finds a location by name
   */
  async findByName(name: string): Promise<AgBotLocation | null> {
    const { data, error } = await this.db
      .from('ta_agbot_locations')
      .select('*')
      .eq('name', name)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch location by name: ${error.message}`);
    }

    return data as AgBotLocation;
  }

  /**
   * Finds all locations for a specific customer
   */
  async findByCustomer(customerName: string, includeDisabled: boolean = false): Promise<AgBotLocation[]> {
    let query = this.db
      .from('ta_agbot_locations')
      .select('*')
      .eq('customer_name', customerName)
      .order('name', { ascending: true });

    if (!includeDisabled) {
      query = query.eq('is_disabled', false);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch locations by customer: ${error.message}`);
    }

    return (data || []) as AgBotLocation[];
  }

  /**
   * Finds locations by customer GUID
   */
  async findByCustomerGuid(customerGuid: string, includeDisabled: boolean = false): Promise<AgBotLocation[]> {
    let query = this.db
      .from('ta_agbot_locations')
      .select('*')
      .eq('customer_guid', customerGuid)
      .order('name', { ascending: true });

    if (!includeDisabled) {
      query = query.eq('is_disabled', false);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch locations by customer GUID: ${error.message}`);
    }

    return (data || []) as AgBotLocation[];
  }

  /**
   * Finds locations with low fuel (below threshold percentage)
   */
  async findLowFuel(thresholdPercent: number): Promise<AgBotLocation[]> {
    const { data, error } = await this.db
      .from('ta_agbot_locations')
      .select('*')
      .eq('is_disabled', false)
      .lt('calibrated_fill_level', thresholdPercent)
      .order('calibrated_fill_level', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch low fuel locations: ${error.message}`);
    }

    return (data || []) as AgBotLocation[];
  }

  /**
   * Finds locations with critical fuel (below threshold percentage)
   */
  async findCriticalFuel(thresholdPercent: number): Promise<AgBotLocation[]> {
    const { data, error } = await this.db
      .from('ta_agbot_locations')
      .select('*')
      .eq('is_disabled', false)
      .lt('calibrated_fill_level', thresholdPercent)
      .order('calibrated_fill_level', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch critical fuel locations: ${error.message}`);
    }

    return (data || []) as AgBotLocation[];
  }

  /**
   * Finds locations with offline assets
   */
  async findWithOfflineAssets(): Promise<AgBotLocation[]> {
    const { data, error } = await this.db
      .from('ta_agbot_locations')
      .select('*')
      .eq('is_disabled', false)
      .filter('assets_online', 'lt', 'total_assets')
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch locations with offline assets: ${error.message}`);
    }

    return (data || []) as AgBotLocation[];
  }

  /**
   * Creates a new location
   */
  async create(input: LocationCreateInput): Promise<AgBotLocation> {
    const { data, error } = await this.db
      .from('ta_agbot_locations')
      .insert({
        external_guid: input.external_guid,
        name: input.name,
        customer_name: input.customer_name,
        customer_guid: input.customer_guid,
        tenancy_name: input.tenancy_name,
        address: input.address,
        state: input.state,
        postcode: input.postcode,
        country: input.country || 'Australia',
        latitude: input.latitude,
        longitude: input.longitude,
        installation_status: input.installation_status || 0,
        installation_status_label: input.installation_status_label,
        is_disabled: input.is_disabled || false,
        daily_consumption_liters: input.daily_consumption_liters,
        days_remaining: input.days_remaining,
        calibrated_fill_level: input.calibrated_fill_level,
        last_telemetry_at: input.last_telemetry_at,
        last_telemetry_epoch: input.last_telemetry_epoch,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create location: ${error.message}`);
    }

    return data as AgBotLocation;
  }

  /**
   * Updates a location by ID
   */
  async update(id: string, input: LocationUpdateInput): Promise<AgBotLocation> {
    const { data, error } = await this.db
      .from('ta_agbot_locations')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update location: ${error.message}`);
    }

    return data as AgBotLocation;
  }

  /**
   * Upserts a location (create or update based on external_guid)
   */
  async upsert(input: LocationCreateInput): Promise<AgBotLocation> {
    const { data, error } = await this.db
      .from('ta_agbot_locations')
      .upsert(
        {
          external_guid: input.external_guid,
          name: input.name,
          customer_name: input.customer_name,
          customer_guid: input.customer_guid,
          tenancy_name: input.tenancy_name,
          address: input.address,
          state: input.state,
          postcode: input.postcode,
          country: input.country || 'Australia',
          latitude: input.latitude,
          longitude: input.longitude,
          installation_status: input.installation_status || 0,
          installation_status_label: input.installation_status_label,
          is_disabled: input.is_disabled || false,
          daily_consumption_liters: input.daily_consumption_liters,
          days_remaining: input.days_remaining,
          calibrated_fill_level: input.calibrated_fill_level,
          last_telemetry_at: input.last_telemetry_at,
          last_telemetry_epoch: input.last_telemetry_epoch,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'external_guid',
          ignoreDuplicates: false,
        }
      )
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to upsert location: ${error.message}`);
    }

    return data as AgBotLocation;
  }

  /**
   * Bulk upserts multiple locations
   */
  async bulkUpsert(inputs: LocationCreateInput[]): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }

    const records = inputs.map((input) => ({
      external_guid: input.external_guid,
      name: input.name,
      customer_name: input.customer_name,
      customer_guid: input.customer_guid,
      tenancy_name: input.tenancy_name,
      address: input.address,
      state: input.state,
      postcode: input.postcode,
      country: input.country || 'Australia',
      latitude: input.latitude,
      longitude: input.longitude,
      installation_status: input.installation_status || 0,
      installation_status_label: input.installation_status_label,
      is_disabled: input.is_disabled || false,
      daily_consumption_liters: input.daily_consumption_liters,
      days_remaining: input.days_remaining,
      calibrated_fill_level: input.calibrated_fill_level,
      last_telemetry_at: input.last_telemetry_at,
      last_telemetry_epoch: input.last_telemetry_epoch,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await this.db
      .from('ta_agbot_locations')
      .upsert(records, {
        onConflict: 'external_guid',
        ignoreDuplicates: false,
      })
      .select('id');

    if (error) {
      throw new Error(`Failed to bulk upsert locations: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Deletes a location by ID
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('ta_agbot_locations').delete().eq('id', id);

    if (error) {
      throw new Error(`Failed to delete location: ${error.message}`);
    }
  }

  /**
   * Counts locations by status
   */
  async countByStatus(): Promise<LocationStats> {
    const { data: all, error: allError } = await this.db
      .from('ta_agbot_locations')
      .select('is_disabled, total_assets, assets_online', { count: 'exact' });

    if (allError) {
      throw new Error(`Failed to count locations: ${allError.message}`);
    }

    const total = all?.length || 0;
    const active = all?.filter((loc) => !loc.is_disabled).length || 0;
    const disabled = all?.filter((loc) => loc.is_disabled).length || 0;
    const totalAssets = all?.reduce((sum, loc) => sum + (loc.total_assets || 0), 0) || 0;
    const onlineAssets = all?.reduce((sum, loc) => sum + (loc.assets_online || 0), 0) || 0;

    return {
      total,
      active,
      disabled,
      totalAssets,
      onlineAssets,
    };
  }

  /**
   * Counts locations for a specific customer
   */
  async countByCustomer(customerName: string): Promise<number> {
    const { count, error } = await this.db
      .from('ta_agbot_locations')
      .select('*', { count: 'exact', head: true })
      .eq('customer_name', customerName);

    if (error) {
      throw new Error(`Failed to count locations by customer: ${error.message}`);
    }

    return count || 0;
  }
}
