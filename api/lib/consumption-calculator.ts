// Consumption Calculator for AgBot Tank Monitoring
// Analyzes historical readings to calculate daily consumption rates and days remaining

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

interface Reading {
  calibrated_fill_percentage: number;
  reading_timestamp: string;
  asset_reported_litres: number | null;
}

interface ConsumptionResult {
  daily_consumption_litres: number | null;
  daily_consumption_percentage: number | null;
  days_remaining: number | null;
  trend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  data_points: number;
}

/**
 * Calculate daily consumption rate from historical readings
 * Uses linear regression for more accurate trend analysis
 */
export async function calculateConsumption(
  assetId: string,
  currentLevel: number,
  tankCapacity: number | null,
  daysToAnalyze: number = 7
): Promise<ConsumptionResult> {
  try {
    // Fetch historical readings for the specified period
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToAnalyze);

    const { data: readings, error } = await supabase
      .from('agbot_readings_history')
      .select('calibrated_fill_percentage, reading_timestamp, asset_reported_litres')
      .eq('asset_id', assetId)
      .gte('reading_timestamp', startDate.toISOString())
      .order('reading_timestamp', { ascending: true });

    if (error) {
      console.error('Failed to fetch readings for consumption calc:', error);
      return getEmptyResult();
    }

    if (!readings || readings.length < 3) {
      // Need at least 3 data points for meaningful calculation
      return {
        ...getEmptyResult(),
        data_points: readings?.length || 0,
        confidence: 'low'
      };
    }

    const typedReadings = readings as Reading[];

    // Filter out any refill events (sudden increases > 10%)
    const filteredReadings = filterRefillEvents(typedReadings);

    if (filteredReadings.length < 3) {
      return {
        ...getEmptyResult(),
        data_points: filteredReadings.length,
        confidence: 'low'
      };
    }

    // Calculate consumption using linear regression
    const regression = calculateLinearRegression(filteredReadings);

    // Calculate daily consumption in percentage
    const dailyConsumptionPercentage = Math.abs(regression.slope);

    // Calculate daily consumption in litres (if capacity known)
    let dailyConsumptionLitres: number | null = null;
    if (tankCapacity && tankCapacity > 0) {
      dailyConsumptionLitres = (dailyConsumptionPercentage / 100) * tankCapacity;
    }

    // Calculate days remaining
    let daysRemaining: number | null = null;
    if (dailyConsumptionPercentage > 0.1) {
      // Only calculate if consumption is meaningful (> 0.1% per day)
      daysRemaining = currentLevel / dailyConsumptionPercentage;
      // Cap at reasonable maximum (e.g., 365 days)
      if (daysRemaining > 365) {
        daysRemaining = 365;
      }
    }

    // Determine trend
    const trend = determineTrend(regression.slope, filteredReadings);

    // Determine confidence based on data quality
    const confidence = determineConfidence(
      filteredReadings.length,
      regression.r2,
      daysToAnalyze
    );

    return {
      daily_consumption_litres: dailyConsumptionLitres,
      daily_consumption_percentage: dailyConsumptionPercentage,
      days_remaining: daysRemaining,
      trend,
      confidence,
      data_points: filteredReadings.length
    };
  } catch (error) {
    console.error('Error calculating consumption:', error);
    return getEmptyResult();
  }
}

/**
 * Filter out refill events (sudden increases in fuel level)
 */
function filterRefillEvents(readings: Reading[]): Reading[] {
  if (readings.length < 2) return readings;

  const filtered: Reading[] = [readings[0]];

  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const current = readings[i];
    const change = current.calibrated_fill_percentage - prev.calibrated_fill_percentage;

    // Skip if this looks like a refill (increase > 10%)
    if (change > 10) {
      continue;
    }

    filtered.push(current);
  }

  return filtered;
}

/**
 * Calculate linear regression to find consumption trend
 * Returns slope (percentage per day) and R² (quality of fit)
 */
function calculateLinearRegression(readings: Reading[]): { slope: number; r2: number } {
  const n = readings.length;

  // Convert timestamps to days since first reading
  const firstTime = new Date(readings[0].reading_timestamp).getTime();
  const points: { x: number; y: number }[] = readings.map((r) => ({
    x: (new Date(r.reading_timestamp).getTime() - firstTime) / (1000 * 60 * 60 * 24),
    y: r.calibrated_fill_percentage
  }));

  // Calculate means
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;

  // Calculate slope and R²
  let numerator = 0;
  let denominatorX = 0;
  let denominatorY = 0;

  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    numerator += dx * dy;
    denominatorX += dx * dx;
    denominatorY += dy * dy;
  }

  const slope = numerator / denominatorX;
  const r2 = (numerator * numerator) / (denominatorX * denominatorY);

  return { slope, r2 };
}

/**
 * Determine consumption trend
 */
function determineTrend(
  slope: number,
  readings: Reading[]
): 'increasing' | 'decreasing' | 'stable' | 'unknown' {
  if (readings.length < 3) return 'unknown';

  // Compare first half to second half of readings
  const mid = Math.floor(readings.length / 2);
  const firstHalfAvg =
    readings.slice(0, mid).reduce((sum, r) => sum + r.calibrated_fill_percentage, 0) / mid;
  const secondHalfAvg =
    readings.slice(mid).reduce((sum, r) => sum + r.calibrated_fill_percentage, 0) /
    (readings.length - mid);

  const change = secondHalfAvg - firstHalfAvg;

  if (Math.abs(slope) < 0.5) return 'stable';
  if (change < -5) return 'increasing'; // Consumption increasing (level decreasing faster)
  if (change > 5) return 'decreasing'; // Consumption decreasing (level decreasing slower)

  return slope < 0 ? 'stable' : 'unknown';
}

/**
 * Determine confidence level based on data quality
 */
function determineConfidence(
  dataPoints: number,
  r2: number,
  daysAnalyzed: number
): 'high' | 'medium' | 'low' {
  // High confidence: Many data points, good fit, full analysis period
  if (dataPoints >= 7 && r2 > 0.7 && daysAnalyzed >= 7) return 'high';

  // Medium confidence: Decent data but not ideal
  if (dataPoints >= 5 && r2 > 0.5) return 'medium';

  // Low confidence: Limited data or poor fit
  return 'low';
}

/**
 * Return empty result structure
 */
function getEmptyResult(): ConsumptionResult {
  return {
    daily_consumption_litres: null,
    daily_consumption_percentage: null,
    days_remaining: null,
    trend: 'unknown',
    confidence: 'low',
    data_points: 0
  };
}

/**
 * Update asset with calculated consumption values
 */
export async function updateAssetConsumption(
  assetId: string,
  consumption: ConsumptionResult
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('agbot_assets')
      .update({
        asset_daily_consumption: consumption.daily_consumption_litres,
        asset_days_remaining: consumption.days_remaining,
        updated_at: new Date().toISOString()
      })
      .eq('id', assetId);

    if (error) {
      console.error('Failed to update asset consumption:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating asset consumption:', error);
    return false;
  }
}

/**
 * Calculate and update consumption for all active assets
 * Used by scheduled job to keep calculations fresh
 */
export async function recalculateAllAssets(): Promise<{
  processed: number;
  updated: number;
  failed: number;
}> {
  try {
    // Fetch all active assets with current levels and capacity
    const { data: assets, error } = await supabase
      .from('agbot_assets')
      .select(
        `
        id,
        latest_calibrated_fill_percentage,
        asset_profile_water_capacity,
        agbot_locations!inner (
          disabled
        )
      `
      )
      .eq('agbot_locations.disabled', false);

    if (error) {
      console.error('Failed to fetch assets for recalculation:', error);
      return { processed: 0, updated: 0, failed: 0 };
    }

    let processed = 0;
    let updated = 0;
    let failed = 0;

    for (const asset of assets || []) {
      processed++;

      try {
        const consumption = await calculateConsumption(
          asset.id,
          asset.latest_calibrated_fill_percentage || 0,
          asset.asset_profile_water_capacity
        );

        const success = await updateAssetConsumption(asset.id, consumption);

        if (success) {
          updated++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to recalculate asset ${asset.id}:`, error);
        failed++;
      }
    }

    console.log(
      `Consumption recalculation complete: ${updated} updated, ${failed} failed, ${processed} total`
    );

    return { processed, updated, failed };
  } catch (error) {
    console.error('Error in recalculateAllAssets:', error);
    return { processed: 0, updated: 0, failed: 0 };
  }
}
