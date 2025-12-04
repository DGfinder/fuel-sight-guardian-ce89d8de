/**
 * Readings History Repository
 * Data access layer for ta_agbot_readings table
 *
 * Responsibilities:
 * - All queries to ta_agbot_readings table
 * - Historical reading CRUD operations
 * - Time-series queries
 * - Aggregation queries for analytics
 *
 * Tables Accessed:
 * - ta_agbot_readings (primary)
 *
 * Zero business logic - pure data access only
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface AgBotReading {
  id: string;
  asset_id: string;
  level_liters: number | null;
  level_percent: number | null;
  raw_percent: number | null;
  depth_m: number | null;
  pressure_bar: number | null;
  is_online: boolean | null;
  battery_voltage: number | null;
  temperature_c: number | null;
  device_state: string | null;
  daily_consumption: number | null;
  days_remaining: number | null;
  reading_at: string;
  telemetry_epoch: number | null;
  created_at: string;
}

export interface ReadingCreateInput {
  asset_id: string;
  level_liters?: number;
  level_percent?: number;
  raw_percent?: number;
  depth_m?: number;
  pressure_bar?: number;
  is_online?: boolean;
  battery_voltage?: number;
  temperature_c?: number;
  device_state?: string;
  daily_consumption?: number;
  days_remaining?: number;
  reading_at: string;
  telemetry_epoch?: number;
}

export interface TrendData {
  timestamps: string[];
  levels: number[];
  slope: number;
  direction: 'increasing' | 'decreasing' | 'stable';
}

export class ReadingsHistoryRepository {
  constructor(private db: SupabaseClient) {}

  /**
   * Finds all readings for an asset with optional limit
   */
  async findByAsset(assetId: string, limit?: number): Promise<AgBotReading[]> {
    let query = this.db
      .schema('great_southern_fuels').from('ta_agbot_readings')
      .select('*')
      .eq('asset_id', assetId)
      .order('reading_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch readings by asset: ${error.message}`);
    }

    return (data || []) as AgBotReading[];
  }

  /**
   * Finds readings within a date range
   */
  async findByDateRange(assetId: string, startDate: Date, endDate: Date): Promise<AgBotReading[]> {
    const { data, error } = await this.db
      .schema('great_southern_fuels').from('ta_agbot_readings')
      .select('*')
      .eq('asset_id', assetId)
      .gte('reading_at', startDate.toISOString())
      .lte('reading_at', endDate.toISOString())
      .order('reading_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch readings by date range: ${error.message}`);
    }

    return (data || []) as AgBotReading[];
  }

  /**
   * Finds recent readings within the last N hours
   */
  async findRecentReadings(assetId: string, hours: number): Promise<AgBotReading[]> {
    const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

    const { data, error } = await this.db
      .schema('great_southern_fuels').from('ta_agbot_readings')
      .select('*')
      .eq('asset_id', assetId)
      .gte('reading_at', cutoffDate.toISOString())
      .order('reading_at', { ascending: true }); // Ascending order for consumption calculations

    if (error) {
      throw new Error(`Failed to fetch recent readings: ${error.message}`);
    }

    return (data || []) as AgBotReading[];
  }

  /**
   * Finds the latest reading for an asset
   */
  async findLatest(assetId: string): Promise<AgBotReading | null> {
    const { data, error } = await this.db
      .schema('great_southern_fuels').from('ta_agbot_readings')
      .select('*')
      .eq('asset_id', assetId)
      .order('reading_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch latest reading: ${error.message}`);
    }

    return data as AgBotReading;
  }

  /**
   * Finds readings for multiple assets at once
   */
  async findByAssets(assetIds: string[], limit?: number): Promise<Map<string, AgBotReading[]>> {
    if (assetIds.length === 0) {
      return new Map();
    }

    let query = this.db
      .schema('great_southern_fuels').from('ta_agbot_readings')
      .select('*')
      .in('asset_id', assetIds)
      .order('reading_at', { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch readings by assets: ${error.message}`);
    }

    // Group by asset_id
    const readingsMap = new Map<string, AgBotReading[]>();
    assetIds.forEach((id) => readingsMap.set(id, []));

    (data || []).forEach((reading: AgBotReading) => {
      const assetReadings = readingsMap.get(reading.asset_id) || [];
      assetReadings.push(reading);
      readingsMap.set(reading.asset_id, assetReadings);
    });

    return readingsMap;
  }

  /**
   * Gets consumption trend data for an asset over N days
   */
  async getConsumptionTrend(assetId: string, days: number): Promise<TrendData> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const readings = await this.findByDateRange(assetId, startDate, new Date());

    if (readings.length < 2) {
      return {
        timestamps: [],
        levels: [],
        slope: 0,
        direction: 'stable',
      };
    }

    const timestamps = readings.map((r) => r.reading_at);
    const levels = readings.map((r) => r.level_percent || 0);

    // Calculate linear regression slope
    const n = readings.length;
    const sumX = readings.reduce((sum, _, i) => sum + i, 0);
    const sumY = levels.reduce((sum, level) => sum + level, 0);
    const sumXY = readings.reduce((sum, r, i) => sum + i * (r.level_percent || 0), 0);
    const sumX2 = readings.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (slope > 0.5) {
      direction = 'increasing';
    } else if (slope < -0.5) {
      direction = 'decreasing';
    }

    return {
      timestamps,
      levels,
      slope,
      direction,
    };
  }

  /**
   * Gets average level over N days
   */
  async getAverageLevel(assetId: string, days: number): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const readings = await this.findByDateRange(assetId, startDate, new Date());

    if (readings.length === 0) {
      return 0;
    }

    const sum = readings.reduce((acc, r) => acc + (r.level_percent || 0), 0);
    return sum / readings.length;
  }

  /**
   * Gets minimum level over N days
   */
  async getMinimumLevel(assetId: string, days: number): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const readings = await this.findByDateRange(assetId, startDate, new Date());

    if (readings.length === 0) {
      return 0;
    }

    return Math.min(...readings.map((r) => r.level_percent || 0));
  }

  /**
   * Gets maximum level over N days
   */
  async getMaximumLevel(assetId: string, days: number): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const readings = await this.findByDateRange(assetId, startDate, new Date());

    if (readings.length === 0) {
      return 0;
    }

    return Math.max(...readings.map((r) => r.level_percent || 0));
  }

  /**
   * Detects refill events (significant level increases)
   */
  async detectRefillEvents(assetId: string, days: number, thresholdPercent: number = 10): Promise<AgBotReading[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const readings = await this.findByDateRange(assetId, startDate, new Date());

    const refills: AgBotReading[] = [];

    for (let i = 1; i < readings.length; i++) {
      const current = readings[i];
      const previous = readings[i - 1];

      const levelIncrease = (current.level_percent || 0) - (previous.level_percent || 0);

      if (levelIncrease >= thresholdPercent) {
        refills.push(current);
      }
    }

    return refills;
  }

  /**
   * Creates a new reading
   */
  async create(input: ReadingCreateInput): Promise<AgBotReading> {
    const { data, error } = await this.db
      .schema('great_southern_fuels').from('ta_agbot_readings')
      .insert({
        asset_id: input.asset_id,
        level_liters: input.level_liters,
        level_percent: input.level_percent,
        raw_percent: input.raw_percent,
        depth_m: input.depth_m,
        pressure_bar: input.pressure_bar,
        is_online: input.is_online,
        battery_voltage: input.battery_voltage,
        temperature_c: input.temperature_c,
        device_state: input.device_state,
        daily_consumption: input.daily_consumption,
        days_remaining: input.days_remaining,
        reading_at: input.reading_at,
        telemetry_epoch: input.telemetry_epoch,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create reading: ${error.message}`);
    }

    return data as AgBotReading;
  }

  /**
   * Bulk inserts multiple readings
   */
  async bulkInsert(inputs: ReadingCreateInput[]): Promise<number> {
    if (inputs.length === 0) {
      return 0;
    }

    const records = inputs.map((input) => ({
      asset_id: input.asset_id,
      level_liters: input.level_liters,
      level_percent: input.level_percent,
      raw_percent: input.raw_percent,
      depth_m: input.depth_m,
      pressure_bar: input.pressure_bar,
      is_online: input.is_online,
      battery_voltage: input.battery_voltage,
      temperature_c: input.temperature_c,
      device_state: input.device_state,
      daily_consumption: input.daily_consumption,
      days_remaining: input.days_remaining,
      reading_at: input.reading_at,
      telemetry_epoch: input.telemetry_epoch,
    }));

    const { data, error } = await this.db
      .schema('great_southern_fuels').from('ta_agbot_readings')
      .insert(records)
      .select('id');

    if (error) {
      throw new Error(`Failed to bulk insert readings: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Deletes readings older than a specific date
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const { data, error } = await this.db
      .schema('great_southern_fuels').from('ta_agbot_readings')
      .delete()
      .lt('reading_at', date.toISOString())
      .select('id');

    if (error) {
      throw new Error(`Failed to delete old readings: ${error.message}`);
    }

    return data?.length || 0;
  }

  /**
   * Counts total readings for an asset
   */
  async countByAsset(assetId: string): Promise<number> {
    const { count, error } = await this.db
      .schema('great_southern_fuels').from('ta_agbot_readings')
      .select('*', { count: 'exact', head: true })
      .eq('asset_id', assetId);

    if (error) {
      throw new Error(`Failed to count readings: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Gets reading statistics for an asset
   */
  async getStatistics(
    assetId: string,
    days: number
  ): Promise<{
    count: number;
    avgLevel: number;
    minLevel: number;
    maxLevel: number;
    avgBattery: number;
    avgTemperature: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const readings = await this.findByDateRange(assetId, startDate, new Date());

    if (readings.length === 0) {
      return {
        count: 0,
        avgLevel: 0,
        minLevel: 0,
        maxLevel: 0,
        avgBattery: 0,
        avgTemperature: 0,
      };
    }

    const levels = readings.map((r) => r.level_percent || 0);
    const batteries = readings.filter((r) => r.battery_voltage !== null).map((r) => r.battery_voltage!);
    const temperatures = readings.filter((r) => r.temperature_c !== null).map((r) => r.temperature_c!);

    return {
      count: readings.length,
      avgLevel: levels.reduce((sum, l) => sum + l, 0) / levels.length,
      minLevel: Math.min(...levels),
      maxLevel: Math.max(...levels),
      avgBattery: batteries.length > 0 ? batteries.reduce((sum, b) => sum + b, 0) / batteries.length : 0,
      avgTemperature: temperatures.length > 0 ? temperatures.reduce((sum, t) => sum + t, 0) / temperatures.length : 0,
    };
  }
}
