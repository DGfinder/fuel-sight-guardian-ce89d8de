/**
 * AgBot Email Analytics - Server-side analytics for email reports
 * Fetches and calculates consumption metrics for daily/weekly/monthly emails
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/types/supabase.js';
import { ConsumptionAnalysisService } from '../services/ConsumptionAnalysisService.js';
import { ReadingsHistoryRepository } from '../repositories/ReadingsHistoryRepository.js';
import { AgBotAssetRepository } from '../repositories/AgBotAssetRepository.js';

export interface TankConsumptionData {
  location_id: string;
  tank_name: string;

  // Current status
  current_level_pct: number;
  current_litres: number;
  capacity_litres: number;

  // Consumption metrics
  consumption_24h_litres: number;
  consumption_24h_pct: number;
  consumption_7d_litres: number;
  consumption_7d_pct: number;
  consumption_30d_litres: number | null;
  consumption_30d_pct: number | null;

  // Trends
  daily_avg_consumption_litres: number;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
  trend_indicator: '↑' | '↓' | '→';

  // Forecasting
  days_remaining: number | null;
  estimated_refill_date: string | null;
  last_refill_date: string | null;

  // Historical comparison
  vs_yesterday_pct: number; // +5% means consuming 5% more than yesterday
  vs_7d_avg_pct: number;

  // Efficiency
  efficiency_score: number;

  // 7-day sparkline data (for visualization)
  sparkline_7d: (number | null)[]; // Array of 7 daily consumption values (null for missing data)
}

export interface FleetSummary {
  total_consumption_24h: number;
  total_consumption_7d: number;
  total_consumption_30d: number | null;
  avg_consumption_per_tank_24h: number;
  fleet_trend: 'increasing' | 'decreasing' | 'stable';
  most_consumed_tank: string | null;
  most_consumed_amount: number;
  efficiency_avg: number;
}

/**
 * Fetch 24-hour consumption data for a tank using ConsumptionAnalysisService
 * Now uses linear regression and refill filtering for accurate results
 */
export async function fetch24HourConsumption(
  supabase: SupabaseClient<Database>,
  assetId: string,
  currentLevel: number,
  tankCapacity: number | null,
  refillThreshold: number = 10.0
): Promise<{ litres: number; pct: number }> {
  const readingsRepo = new ReadingsHistoryRepository(supabase);
  const assetRepo = new AgBotAssetRepository(supabase);
  const consumptionService = new ConsumptionAnalysisService(readingsRepo, assetRepo);

  const result = await consumptionService.calculateConsumption(
    assetId,
    currentLevel,
    tankCapacity,
    1, // 1 day for 24-hour calculation
    refillThreshold
  );

  return {
    litres: result.daily_consumption_litres || 0,
    pct: result.daily_consumption_percentage || 0,
  };
}

/**
 * Fetch 7-day consumption data for a tank using ConsumptionAnalysisService
 * Now uses linear regression and refill filtering for accurate results
 */
export async function fetch7DayConsumption(
  supabase: SupabaseClient<Database>,
  assetId: string,
  currentLevel: number,
  tankCapacity: number | null,
  refillThreshold: number = 10.0
): Promise<{ litres: number; pct: number; daily_values: (number | null)[] }> {
  const readingsRepo = new ReadingsHistoryRepository(supabase);
  const assetRepo = new AgBotAssetRepository(supabase);
  const consumptionService = new ConsumptionAnalysisService(readingsRepo, assetRepo);

  const result = await consumptionService.calculateConsumption(
    assetId,
    currentLevel,
    tankCapacity,
    7, // 7 days for weekly calculation
    refillThreshold
  );

  const dailyConsumption = result.daily_consumption_litres || 0;

  // Calculate sparkline values by querying each day's consumption individually
  const now = new Date();
  const daily_values: (number | null)[] = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);

    // Query for readings during this specific day
    const { data } = await supabase
      .from('ta_agbot_readings')
      .select('level_liters, level_percent, reading_at')
      .eq('asset_id', assetId)
      .gte('reading_at', dayStart.toISOString())
      .lt('reading_at', new Date(dayStart.getTime() + 24 * 60 * 60 * 1000).toISOString())
      .order('reading_at', { ascending: true });

    if (data && data.length >= 2) {
      // Use simple calculation for sparkline (no refill filtering needed for single day)
      const oldest = data[0];
      const newest = data[data.length - 1];
      const dayConsumption = oldest.level_liters && newest.level_liters
        ? Math.max(0, oldest.level_liters - newest.level_liters)
        : 0;
      daily_values.push(Math.round(dayConsumption));
    } else {
      daily_values.push(null);
    }
  }

  return {
    litres: dailyConsumption * 7, // Total weekly consumption
    pct: (result.daily_consumption_percentage || 0) * 7,
    daily_values,
  };
}

/**
 * Fetch 30-day consumption data for a tank using ConsumptionAnalysisService
 * Now uses linear regression and refill filtering for accurate results
 */
export async function fetch30DayConsumption(
  supabase: SupabaseClient<Database>,
  assetId: string,
  currentLevel: number,
  tankCapacity: number | null,
  refillThreshold: number = 10.0
): Promise<{ litres: number; pct: number } | null> {
  const readingsRepo = new ReadingsHistoryRepository(supabase);
  const assetRepo = new AgBotAssetRepository(supabase);
  const consumptionService = new ConsumptionAnalysisService(readingsRepo, assetRepo);

  const result = await consumptionService.calculateConsumption(
    assetId,
    currentLevel,
    tankCapacity,
    30, // 30 days for monthly calculation
    refillThreshold
  );

  if (!result.daily_consumption_litres) {
    return null;
  }

  return {
    litres: result.daily_consumption_litres * 30, // Total monthly consumption
    pct: (result.daily_consumption_percentage || 0) * 30,
  };
}

/**
 * Calculate trend direction based on recent consumption
 */
export function calculateTrendDirection(
  daily_values: number[]
): { direction: 'increasing' | 'decreasing' | 'stable'; indicator: '↑' | '↓' | '→' } {
  if (daily_values.length < 4) {
    return { direction: 'stable', indicator: '→' };
  }

  // Compare first half vs second half
  const midpoint = Math.floor(daily_values.length / 2);
  const firstHalf = daily_values.slice(0, midpoint);
  const secondHalf = daily_values.slice(midpoint);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const change = ((secondAvg - firstAvg) / (firstAvg || 1)) * 100;

  if (Math.abs(change) < 10) {
    return { direction: 'stable', indicator: '→' };
  }

  if (change > 0) {
    return { direction: 'increasing', indicator: '↑' };
  }

  return { direction: 'decreasing', indicator: '↓' };
}

/**
 * Get comprehensive consumption analytics for a tank
 */
export async function getTankConsumptionAnalytics(
  supabase: SupabaseClient<Database>,
  location: {
    location_id: string;
    asset_id?: string; // UUID of the asset for querying readings history
    address1: string;
    latest_calibrated_fill_percentage: number;
    asset_profile_water_capacity: number | null;
    asset_reported_litres: number | null;
    asset_daily_consumption: number | null;
    asset_days_remaining: number | null;
    asset_refill_detection_threshold?: number | null;
  }
): Promise<TankConsumptionData> {
  // If no asset_id provided, return empty analytics
  if (!location.asset_id) {
    return {
      location_id: location.location_id,
      tank_name: location.address1,
      current_level_pct: location.latest_calibrated_fill_percentage,
      current_litres: location.asset_reported_litres || 0,
      capacity_litres: location.asset_profile_water_capacity || 0,
      consumption_24h_litres: 0,
      consumption_24h_pct: 0,
      consumption_7d_litres: 0,
      consumption_7d_pct: 0,
      consumption_30d_litres: null,
      consumption_30d_pct: null,
      daily_avg_consumption_litres: 0,
      trend_direction: 'stable',
      trend_indicator: '→',
      days_remaining: location.asset_days_remaining,
      estimated_refill_date: null,
      last_refill_date: null,
      vs_7d_avg_pct: 0,
      efficiency_score: 100,
      sparkline_7d: new Array(7).fill(null),
    };
  }

  // Use asset-specific refill threshold or default to 10%
  const refillThreshold = location.asset_refill_detection_threshold || 10.0;

  // Fetch consumption data in parallel using asset_id with proper parameters
  const [consumption24h, consumption7d, consumption30d] = await Promise.all([
    fetch24HourConsumption(
      supabase,
      location.asset_id,
      location.latest_calibrated_fill_percentage,
      location.asset_profile_water_capacity,
      refillThreshold
    ),
    fetch7DayConsumption(
      supabase,
      location.asset_id,
      location.latest_calibrated_fill_percentage,
      location.asset_profile_water_capacity,
      refillThreshold
    ),
    fetch30DayConsumption(
      supabase,
      location.asset_id,
      location.latest_calibrated_fill_percentage,
      location.asset_profile_water_capacity,
      refillThreshold
    ),
  ]);

  // Calculate trend
  const trend = calculateTrendDirection(consumption7d.daily_values);

  // Calculate daily average from non-zero values for more accurate results
  const nonZeroDays = consumption7d.daily_values.filter(v => v > 0);
  const dailyAvg = nonZeroDays.length > 0
    ? nonZeroDays.reduce((a, b) => a + b, 0) / nonZeroDays.length
    : 0;

  // Only compare to average if we have meaningful data
  const vs7DAvg =
    dailyAvg > 0 && consumption24h.litres > 0
      ? Math.max(-999, Math.min(999, ((consumption24h.litres - dailyAvg) / dailyAvg) * 100))
      : 0;

  // Calculate efficiency score (baseline 2% per day)
  const consumption_rate_pct = consumption7d.pct / 7;
  const efficiency_score =
    consumption_rate_pct > 0 ? Math.min(200, (2.0 / consumption_rate_pct) * 100) : 100;

  // Estimate refill date
  let estimated_refill_date: string | null = null;
  if (location.asset_days_remaining && location.asset_days_remaining > 0) {
    const refillDate = new Date();
    refillDate.setDate(refillDate.getDate() + Math.round(location.asset_days_remaining));
    estimated_refill_date = refillDate.toISOString().split('T')[0];
  }

  return {
    location_id: location.location_id,
    tank_name: location.address1,

    current_level_pct: location.latest_calibrated_fill_percentage,
    current_litres: location.asset_reported_litres || 0,
    capacity_litres: location.asset_profile_water_capacity || 0,

    consumption_24h_litres: consumption24h.litres,
    consumption_24h_pct: consumption24h.pct,
    consumption_7d_litres: consumption7d.litres,
    consumption_7d_pct: consumption7d.pct,
    consumption_30d_litres: consumption30d?.litres || null,
    consumption_30d_pct: consumption30d?.pct || null,

    daily_avg_consumption_litres: Math.round(dailyAvg),
    trend_direction: trend.direction,
    trend_indicator: trend.indicator,

    days_remaining: location.asset_days_remaining,
    estimated_refill_date,
    last_refill_date: null, // TODO: Implement refill detection

    vs_7d_avg_pct: Math.round(vs7DAvg),

    efficiency_score: Math.round(efficiency_score),

    sparkline_7d: consumption7d.daily_values,
  };
}

/**
 * Get fleet-wide summary analytics
 */
export async function getFleetSummaryAnalytics(
  tanksData: TankConsumptionData[]
): Promise<FleetSummary> {
  if (tanksData.length === 0) {
    return {
      total_consumption_24h: 0,
      total_consumption_7d: 0,
      total_consumption_30d: null,
      avg_consumption_per_tank_24h: 0,
      fleet_trend: 'stable',
      most_consumed_tank: null,
      most_consumed_amount: 0,
      efficiency_avg: 100,
    };
  }

  const total_consumption_24h = tanksData.reduce((sum, t) => sum + t.consumption_24h_litres, 0);
  const total_consumption_7d = tanksData.reduce((sum, t) => sum + t.consumption_7d_litres, 0);

  const thirtyDayData = tanksData.filter((t) => t.consumption_30d_litres !== null);
  const total_consumption_30d =
    thirtyDayData.length > 0
      ? thirtyDayData.reduce((sum, t) => sum + (t.consumption_30d_litres || 0), 0)
      : null;

  const avg_consumption_per_tank_24h = Math.round(total_consumption_24h / tanksData.length);

  // Find most consumed tank
  const mostConsumed = tanksData.reduce(
    (max, t) => (t.consumption_24h_litres > max.consumption_24h_litres ? t : max),
    tanksData[0]
  );

  // Calculate fleet trend
  const increasing = tanksData.filter((t) => t.trend_direction === 'increasing').length;
  const decreasing = tanksData.filter((t) => t.trend_direction === 'decreasing').length;
  let fleet_trend: 'increasing' | 'decreasing' | 'stable' = 'stable';

  if (increasing > decreasing * 1.5) {
    fleet_trend = 'increasing';
  } else if (decreasing > increasing * 1.5) {
    fleet_trend = 'decreasing';
  }

  // Average efficiency
  const efficiency_avg = Math.round(
    tanksData.reduce((sum, t) => sum + t.efficiency_score, 0) / tanksData.length
  );

  return {
    total_consumption_24h: Math.round(total_consumption_24h),
    total_consumption_7d: Math.round(total_consumption_7d),
    total_consumption_30d: total_consumption_30d ? Math.round(total_consumption_30d) : null,
    avg_consumption_per_tank_24h,
    fleet_trend,
    most_consumed_tank: mostConsumed.tank_name,
    most_consumed_amount: Math.round(mostConsumed.consumption_24h_litres),
    efficiency_avg,
  };
}
