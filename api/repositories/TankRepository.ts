/**
 * Tank Repository
 * Data access layer for ta_agbot_locations and ta_agbot_assets tables
 * Abstracts all database queries for tank data
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface Asset {
  id: string;
  is_online: boolean;
  capacity_liters: number | null;
  daily_consumption_liters: number | null;
  days_remaining: number | null;
  device_serial: string | null;
  current_level_liters: number | null;
  ullage_liters: number | null;
  battery_voltage: number | null;
  commodity: string | null;
}

export interface Tank {
  id: string;
  name: string;
  address: string | null;
  customer_name: string;
  calibrated_fill_level: number | null;
  last_telemetry_at: string | null;
  is_disabled: boolean;
  ta_agbot_assets?: Asset[];
}

export class TankRepository {
  constructor(private db: SupabaseClient) {}

  /**
   * Find tanks specifically assigned to a contact
   * Uses customer_contact_tanks junction table
   */
  async findAssignedTanks(contactId: string): Promise<Tank[]> {
    // Step 1: Get assigned tank IDs
    const { data: assignments, error: assignmentsError } = await this.db
      .from('customer_contact_tanks')
      .select('agbot_location_id')
      .eq('customer_contact_id', contactId);

    if (assignmentsError) {
      throw new Error(`Failed to fetch tank assignments: ${assignmentsError.message}`);
    }

    if (!assignments || assignments.length === 0) {
      return [];
    }

    // Step 2: Fetch full tank data with assets
    const tankIds = assignments.map(a => a.agbot_location_id);
    const { data: tanks, error: tanksError } = await this.db
      .schema('great_southern_fuels').from('ta_agbot_locations')
      .select(`
        id,
        name,
        address,
        customer_name,
        calibrated_fill_level,
        last_telemetry_at,
        is_disabled,
        ta_agbot_assets (
          id,
          is_online,
          capacity_liters,
          daily_consumption_liters,
          days_remaining,
          device_serial,
          current_level_liters,
          ullage_liters,
          battery_voltage,
          commodity
        )
      `)
      .in('id', tankIds)
      .eq('is_disabled', false)
      .order('name', { ascending: true });

    if (tanksError) {
      throw new Error(`Failed to fetch assigned tanks: ${tanksError.message}`);
    }

    return (tanks || []) as Tank[];
  }

  /**
   * Find all tanks for a customer (fallback when no specific assignments)
   */
  async findByCustomerName(customerName: string): Promise<Tank[]> {
    const { data, error } = await this.db
      .schema('great_southern_fuels').from('ta_agbot_locations')
      .select(`
        id,
        name,
        address,
        customer_name,
        calibrated_fill_level,
        last_telemetry_at,
        is_disabled,
        ta_agbot_assets (
          id,
          is_online,
          capacity_liters,
          daily_consumption_liters,
          days_remaining,
          device_serial,
          current_level_liters,
          ullage_liters,
          battery_voltage,
          commodity
        )
      `)
      .eq('customer_name', customerName)
      .eq('is_disabled', false)
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch tanks by customer name: ${error.message}`);
    }

    return (data || []) as Tank[];
  }

  /**
   * Find tank by ID
   */
  async findById(tankId: string): Promise<Tank | null> {
    const { data, error } = await this.db
      .schema('great_southern_fuels').from('ta_agbot_locations')
      .select(`
        id,
        name,
        address,
        customer_name,
        calibrated_fill_level,
        last_telemetry_at,
        is_disabled,
        ta_agbot_assets (
          id,
          is_online,
          capacity_liters,
          daily_consumption_liters,
          days_remaining,
          device_serial,
          current_level_liters,
          ullage_liters,
          battery_voltage,
          commodity
        )
      `)
      .eq('id', tankId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch tank by ID: ${error.message}`);
    }

    return data as Tank;
  }

  /**
   * Find tanks with low fuel (below threshold)
   */
  async findLowFuelTanks(thresholdPercent: number = 30): Promise<Tank[]> {
    const { data, error } = await this.db
      .schema('great_southern_fuels').from('ta_agbot_locations')
      .select(`
        id,
        name,
        address,
        customer_name,
        calibrated_fill_level,
        last_telemetry_at,
        is_disabled,
        ta_agbot_assets (
          id,
          is_online,
          capacity_liters,
          daily_consumption_liters,
          days_remaining,
          device_serial,
          current_level_liters,
          ullage_liters,
          battery_voltage,
          commodity
        )
      `)
      .eq('is_disabled', false)
      .lt('calibrated_fill_level', thresholdPercent)
      .order('calibrated_fill_level', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch low fuel tanks: ${error.message}`);
    }

    return (data || []) as Tank[];
  }

  /**
   * Find tanks for a specific contact with hybrid logic:
   * 1. Try to get specifically assigned tanks
   * 2. Fallback to all tanks for that customer
   */
  async findTanksForContact(contactId: string, customerName: string): Promise<Tank[]> {
    console.log(`[TankRepo] Finding tanks for contact ${contactId}, customer: ${customerName}`);

    // Try specific assignments first
    const assignedTanks = await this.findAssignedTanks(contactId);

    if (assignedTanks.length > 0) {
      console.log(`[TankRepo] ✅ Found ${assignedTanks.length} assigned tanks`);
      return assignedTanks;
    }

    console.log(`[TankRepo] No assigned tanks found, falling back to customer_name query`);

    // Fallback to all customer tanks
    const customerTanks = await this.findByCustomerName(customerName);
    console.log(`[TankRepo] Fallback query returned ${customerTanks.length} tanks`);

    if (customerTanks.length === 0) {
      console.warn(`⚠️  [TankRepo] NO TANKS FOUND for ${customerName}`);
      console.warn(`   - Contact ID: ${contactId}`);
      console.warn(`   - Customer Name: "${customerName}"`);
      console.warn(`   - Possible cause: Data not migrated to ta_agbot_locations`);
      console.warn(`   - Action: Run database/migrations/migrate_agbot_data_to_ta.sql`);
    }

    return customerTanks;
  }

  /**
   * Get count of active tanks
   */
  async countActive(): Promise<number> {
    const { count, error } = await this.db
      .schema('great_southern_fuels').from('ta_agbot_locations')
      .select('*', { count: 'exact', head: true })
      .eq('is_disabled', false);

    if (error) {
      throw new Error(`Failed to count active tanks: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Get count of tanks by customer
   */
  async countByCustomer(customerName: string): Promise<number> {
    const { count, error } = await this.db
      .schema('great_southern_fuels').from('ta_agbot_locations')
      .select('*', { count: 'exact', head: true })
      .eq('customer_name', customerName)
      .eq('is_disabled', false);

    if (error) {
      throw new Error(`Failed to count tanks by customer: ${error.message}`);
    }

    return count || 0;
  }
}
