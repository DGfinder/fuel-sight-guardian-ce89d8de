/**
 * AgBot Asset Repository
 * Data access layer for ta_agbot_assets table
 *
 * Responsibilities:
 * - All queries to ta_agbot_assets table
 * - Asset CRUD operations
 * - Asset search and filtering
 * - Device status queries
 *
 * Tables Accessed:
 * - ta_agbot_assets (primary)
 *
 * Zero business logic - pure data access only
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface AgBotAsset {
  id: string;
  location_id: string;
  external_guid: string;
  name: string | null;
  serial_number: string | null;
  profile_name: string | null;
  profile_guid: string | null;
  commodity: string | null;
  capacity_liters: number | null;
  max_depth_m: number | null;
  max_pressure_bar: number | null;
  max_display_percent: number | null;
  current_level_liters: number | null;
  current_level_percent: number | null;
  current_raw_percent: number | null;
  current_depth_m: number | null;
  current_pressure_bar: number | null;
  ullage_liters: number | null;
  daily_consumption_liters: number | null;
  days_remaining: number | null;
  refill_detection_threshold: number | null;
  refill_threshold_notes: string | null;
  last_consumption_calc_at: string | null;
  consumption_calc_confidence: string | null;
  device_guid: string | null;
  device_serial: string | null;
  device_model: number | null;
  device_model_name: string | null;
  device_sku: string | null;
  device_network_id: string | null;
  helmet_serial: string | null;
  is_online: boolean;
  is_disabled: boolean;
  device_state: string | null;
  battery_voltage: number | null;
  temperature_c: number | null;
  device_activated_at: string | null;
  device_activation_epoch: number | null;
  last_telemetry_at: string | null;
  last_telemetry_epoch: number | null;
  last_raw_telemetry_at: string | null;
  last_calibrated_telemetry_at: string | null;
  asset_updated_at: string | null;
  asset_updated_epoch: number | null;
  created_at: string;
  updated_at: string;
  raw_data: any | null;
}

export interface AssetCreateInput {
  location_id: string;
  external_guid: string;
  name?: string;
  serial_number?: string;
  profile_name?: string;
  profile_guid?: string;
  commodity?: string;
  capacity_liters?: number;
  max_depth_m?: number;
  max_pressure_bar?: number;
  max_display_percent?: number;
  current_level_liters?: number;
  current_level_percent?: number;
  current_raw_percent?: number;
  current_depth_m?: number;
  current_pressure_bar?: number;
  ullage_liters?: number;
  daily_consumption_liters?: number;
  days_remaining?: number;
  device_guid?: string;
  device_serial?: string;
  device_model?: number;
  device_model_name?: string;
  device_sku?: string;
  device_network_id?: string;
  helmet_serial?: string;
  is_online?: boolean;
  is_disabled?: boolean;
  device_state?: string;
  battery_voltage?: number;
  temperature_c?: number;
  device_activated_at?: string;
  device_activation_epoch?: number;
  last_telemetry_at?: string;
  last_telemetry_epoch?: number;
  raw_data?: any;
}

export interface AssetUpdateInput {
  name?: string;
  current_level_liters?: number;
  current_level_percent?: number;
  current_raw_percent?: number;
  current_depth_m?: number;
  current_pressure_bar?: number;
  ullage_liters?: number;
  daily_consumption_liters?: number;
  days_remaining?: number;
  is_online?: boolean;
  is_disabled?: boolean;
  device_state?: string;
  battery_voltage?: number;
  temperature_c?: number;
  last_telemetry_at?: string;
  last_telemetry_epoch?: number;
  raw_data?: any;
}

export interface ConsumptionData {
  daily_consumption_liters: number;
  days_remaining: number;
  last_consumption_calc_at?: string;
  consumption_calc_confidence?: 'high' | 'medium' | 'low';
}

export class AgBotAssetRepository {
  constructor(private db: SupabaseClient) {}

  /**
   * Finds all assets for a location
   */
  async findByLocation(locationId: string, includeDisabled: boolean = false): Promise<AgBotAsset[]> {
    let query = this.db
      .from('ta_agbot_assets')
      .select('*')
      .eq('location_id', locationId)
      .order('name', { ascending: true });

    if (!includeDisabled) {
      query = query.eq('is_disabled', false);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch assets by location: ${error.message}`);
    }

    return (data || []) as AgBotAsset[];
  }

  /**
   * Finds an asset by ID
   */
  async findById(id: string): Promise<AgBotAsset | null> {
    const { data, error } = await this.db
      .from('ta_agbot_assets')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch asset: ${error.message}`);
    }

    return data as AgBotAsset;
  }

  /**
   * Finds an asset by external GUID
   */
  async findByExternalGuid(externalGuid: string): Promise<AgBotAsset | null> {
    const { data, error } = await this.db
      .from('ta_agbot_assets')
      .select('*')
      .eq('external_guid', externalGuid)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch asset by external GUID: ${error.message}`);
    }

    return data as AgBotAsset;
  }

  /**
   * Finds an asset by device serial number
   */
  async findByDeviceSerial(deviceSerial: string): Promise<AgBotAsset | null> {
    const { data, error } = await this.db
      .from('ta_agbot_assets')
      .select('*')
      .eq('device_serial', deviceSerial)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch asset by device serial: ${error.message}`);
    }

    return data as AgBotAsset;
  }

  /**
   * Finds all online assets
   */
  async findOnline(): Promise<AgBotAsset[]> {
    const { data, error } = await this.db
      .from('ta_agbot_assets')
      .select('*')
      .eq('is_online', true)
      .eq('is_disabled', false)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch online assets: ${error.message}`);
    }

    return (data || []) as AgBotAsset[];
  }

  /**
   * Finds all offline assets
   */
  async findOffline(): Promise<AgBotAsset[]> {
    const { data, error } = await this.db
      .from('ta_agbot_assets')
      .select('*')
      .eq('is_online', false)
      .eq('is_disabled', false)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch offline assets: ${error.message}`);
    }

    return (data || []) as AgBotAsset[];
  }

  /**
   * Finds assets needing maintenance (low battery, temperature issues)
   */
  async findNeedingMaintenance(lowBatteryThreshold: number = 11.0): Promise<AgBotAsset[]> {
    const { data, error } = await this.db
      .from('ta_agbot_assets')
      .select('*')
      .eq('is_disabled', false)
      .or(`battery_voltage.lt.${lowBatteryThreshold},is_online.eq.false`)
      .order('battery_voltage', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch assets needing maintenance: ${error.message}`);
    }

    return (data || []) as AgBotAsset[];
  }

  /**
   * Finds assets with low fuel
   */
  async findLowFuel(thresholdPercent: number): Promise<AgBotAsset[]> {
    const { data, error } = await this.db
      .from('ta_agbot_assets')
      .select('*')
      .eq('is_disabled', false)
      .lt('current_level_percent', thresholdPercent)
      .order('current_level_percent', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch low fuel assets: ${error.message}`);
    }

    return (data || []) as AgBotAsset[];
  }

  /**
   * Finds assets by commodity type
   */
  async findByCommodity(commodity: string): Promise<AgBotAsset[]> {
    const { data, error } = await this.db
      .from('ta_agbot_assets')
      .select('*')
      .eq('commodity', commodity)
      .eq('is_disabled', false)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch assets by commodity: ${error.message}`);
    }

    return (data || []) as AgBotAsset[]
  }

  /**
   * Creates a new asset
   */
  async create(input: AssetCreateInput): Promise<AgBotAsset> {
    const { data, error } = await this.db
      .from('ta_agbot_assets')
      .insert({
        location_id: input.location_id,
        external_guid: input.external_guid,
        name: input.name,
        serial_number: input.serial_number,
        profile_name: input.profile_name,
        profile_guid: input.profile_guid,
        commodity: input.commodity,
        capacity_liters: input.capacity_liters,
        max_depth_m: input.max_depth_m,
        max_pressure_bar: input.max_pressure_bar,
        max_display_percent: input.max_display_percent,
        current_level_liters: input.current_level_liters,
        current_level_percent: input.current_level_percent,
        current_raw_percent: input.current_raw_percent,
        current_depth_m: input.current_depth_m,
        current_pressure_bar: input.current_pressure_bar,
        ullage_liters: input.ullage_liters,
        daily_consumption_liters: input.daily_consumption_liters,
        days_remaining: input.days_remaining,
        device_guid: input.device_guid,
        device_serial: input.device_serial,
        device_model: input.device_model,
        device_model_name: input.device_model_name,
        device_sku: input.device_sku,
        device_network_id: input.device_network_id,
        helmet_serial: input.helmet_serial,
        is_online: input.is_online || false,
        is_disabled: input.is_disabled || false,
        device_state: input.device_state,
        battery_voltage: input.battery_voltage,
        temperature_c: input.temperature_c,
        device_activated_at: input.device_activated_at,
        device_activation_epoch: input.device_activation_epoch,
        last_telemetry_at: input.last_telemetry_at,
        last_telemetry_epoch: input.last_telemetry_epoch,
        raw_data: input.raw_data,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create asset: ${error.message}`);
    }

    return data as AgBotAsset;
  }

  /**
   * Updates an asset by ID
   */
  async update(id: string, input: AssetUpdateInput): Promise<AgBotAsset> {
    const { data, error } = await this.db
      .from('ta_agbot_assets')
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update asset: ${error.message}`);
    }

    return data as AgBotAsset;
  }

  /**
   * Upserts an asset (create or update based on external_guid)
   */
  async upsert(input: AssetCreateInput): Promise<AgBotAsset> {
    const { data, error } = await this.db
      .from('ta_agbot_assets')
      .upsert(
        {
          location_id: input.location_id,
          external_guid: input.external_guid,
          name: input.name,
          serial_number: input.serial_number,
          profile_name: input.profile_name,
          profile_guid: input.profile_guid,
          commodity: input.commodity,
          capacity_liters: input.capacity_liters,
          max_depth_m: input.max_depth_m,
          max_pressure_bar: input.max_pressure_bar,
          max_display_percent: input.max_display_percent,
          current_level_liters: input.current_level_liters,
          current_level_percent: input.current_level_percent,
          current_raw_percent: input.current_raw_percent,
          current_depth_m: input.current_depth_m,
          current_pressure_bar: input.current_pressure_bar,
          ullage_liters: input.ullage_liters,
          daily_consumption_liters: input.daily_consumption_liters,
          days_remaining: input.days_remaining,
          device_guid: input.device_guid,
          device_serial: input.device_serial,
          device_model: input.device_model,
          device_model_name: input.device_model_name,
          device_sku: input.device_sku,
          device_network_id: input.device_network_id,
          helmet_serial: input.helmet_serial,
          is_online: input.is_online || false,
          is_disabled: input.is_disabled || false,
          device_state: input.device_state,
          battery_voltage: input.battery_voltage,
          temperature_c: input.temperature_c,
          device_activated_at: input.device_activated_at,
          device_activation_epoch: input.device_activation_epoch,
          last_telemetry_at: input.last_telemetry_at,
          last_telemetry_epoch: input.last_telemetry_epoch,
          raw_data: input.raw_data,
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
      throw new Error(`Failed to upsert asset: ${error.message}`);
    }

    return data as AgBotAsset;
  }

  /**
   * Updates consumption data for an asset
   */
  async updateConsumption(id: string, data: ConsumptionData): Promise<void> {
    const { error } = await this.db
      .from('ta_agbot_assets')
      .update({
        daily_consumption_liters: data.daily_consumption_liters,
        days_remaining: data.days_remaining,
        last_consumption_calc_at: data.last_consumption_calc_at,
        consumption_calc_confidence: data.consumption_calc_confidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update consumption: ${error.message}`);
    }
  }

  /**
   * Bulk updates consumption for multiple assets
   */
  async bulkUpdateConsumption(updates: Array<{ id: string; data: ConsumptionData }>): Promise<number> {
    if (updates.length === 0) {
      return 0;
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const update of updates) {
      try {
        await this.updateConsumption(update.id, update.data);
        successCount++;
      } catch (error) {
        errors.push(`Failed to update asset ${update.id}: ${(error as Error).message}`);
      }
    }

    if (errors.length > 0) {
      console.warn(`[AgBotAssetRepository] Bulk update had ${errors.length} errors:`, errors);
    }

    return successCount;
  }

  /**
   * Updates device status (online/offline)
   */
  async updateDeviceStatus(id: string, isOnline: boolean): Promise<void> {
    const { error } = await this.db
      .from('ta_agbot_assets')
      .update({
        is_online: isOnline,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update device status: ${error.message}`);
    }
  }

  /**
   * Deletes an asset by ID
   */
  async delete(id: string): Promise<void> {
    const { error } = await this.db.from('ta_agbot_assets').delete().eq('id', id);

    if (error) {
      throw new Error(`Failed to delete asset: ${error.message}`);
    }
  }

  /**
   * Counts assets by status
   */
  async countByStatus(): Promise<{
    total: number;
    online: number;
    offline: number;
    disabled: number;
  }> {
    const { data, error } = await this.db
      .from('ta_agbot_assets')
      .select('is_online, is_disabled', { count: 'exact' });

    if (error) {
      throw new Error(`Failed to count assets: ${error.message}`);
    }

    const total = data?.length || 0;
    const online = data?.filter((a) => a.is_online && !a.is_disabled).length || 0;
    const offline = data?.filter((a) => !a.is_online && !a.is_disabled).length || 0;
    const disabled = data?.filter((a) => a.is_disabled).length || 0;

    return { total, online, offline, disabled };
  }

  /**
   * Counts assets for a specific location
   */
  async countByLocation(locationId: string): Promise<number> {
    const { count, error } = await this.db
      .from('ta_agbot_assets')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', locationId);

    if (error) {
      throw new Error(`Failed to count assets by location: ${error.message}`);
    }

    return count || 0;
  }
}
