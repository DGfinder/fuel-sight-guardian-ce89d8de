/**
 * SmartFill Consumption Analysis Service
 * Calculates daily consumption and days remaining for SmartFill tanks
 *
 * Similar to AgBot's ConsumptionAnalysisService but adapted for SmartFill data structure.
 * Uses linear regression on historical readings to calculate consumption rates.
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface SmartFillReading {
  id: string;
  tank_id: string;
  volume: number | null;
  volume_percent: number | null;
  reading_at: string;
  is_refill: boolean;
}

export interface ConsumptionResult {
  daily_consumption_liters: number | null;
  daily_consumption_percent: number | null;
  days_remaining: number | null;
  estimated_empty_date: string | null;
  trend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  data_points: number;
}

export interface TankConsumptionUpdate {
  tank_id: string;
  avg_daily_consumption: number | null;
  days_remaining: number | null;
  estimated_empty_date: string | null;
  consumption_trend: string | null;
}

export class SmartFillConsumptionService {
  constructor(private db: SupabaseClient) {}

  /**
   * Calculate consumption for a single tank
   */
  async calculateTankConsumption(
    tankId: string,
    currentVolumePercent: number | null,
    capacity: number | null,
    daysToAnalyze: number = 7,
    refillThreshold: number = 10.0
  ): Promise<ConsumptionResult> {
    try {
      // Fetch historical readings for this tank
      const cutoffDate = new Date(Date.now() - daysToAnalyze * 24 * 60 * 60 * 1000);

      const { data: readings, error } = await this.db
        .from('ta_smartfill_readings')
        .select('id, tank_id, volume, volume_percent, reading_at, is_refill')
        .eq('tank_id', tankId)
        .gte('reading_at', cutoffDate.toISOString())
        .order('reading_at', { ascending: true });

      if (error) {
        console.warn(`[SmartFill Consumption] Error fetching readings for tank ${tankId}: ${error.message}`);
        return this.getEmptyResult(0);
      }

      if (!readings || readings.length < 3) {
        return this.getEmptyResult(readings?.length || 0);
      }

      // Filter out refill events
      const filteredReadings = this.filterRefillEvents(readings as SmartFillReading[], refillThreshold);

      if (filteredReadings.length < 3) {
        return this.getEmptyResult(filteredReadings.length);
      }

      // Calculate linear regression on volume_percent
      const regression = this.calculateLinearRegression(filteredReadings);

      // Slope is in percent per day (negative = consuming fuel)
      const dailyConsumptionPercent = Math.abs(regression.slope);

      // Convert to liters if capacity is known
      let dailyConsumptionLiters: number | null = null;
      if (capacity && capacity > 0) {
        dailyConsumptionLiters = (dailyConsumptionPercent / 100) * capacity;
      }

      // Calculate days remaining
      let daysRemaining: number | null = null;
      if (currentVolumePercent !== null && dailyConsumptionPercent > 0.1) {
        daysRemaining = Math.round(currentVolumePercent / dailyConsumptionPercent);
        // Cap at reasonable maximum
        if (daysRemaining > 365) daysRemaining = 365;
        if (daysRemaining < 0) daysRemaining = 0;
      }

      // Calculate estimated empty date
      let estimatedEmptyDate: string | null = null;
      if (daysRemaining !== null && daysRemaining < 365) {
        const emptyDate = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000);
        estimatedEmptyDate = emptyDate.toISOString().split('T')[0];
      }

      // Determine trend and confidence
      const trend = this.determineTrend(regression.slope, filteredReadings);
      const confidence = this.determineConfidence(filteredReadings.length, regression.r2, daysToAnalyze);

      return {
        daily_consumption_liters: dailyConsumptionLiters !== null
          ? Math.round(dailyConsumptionLiters * 100) / 100
          : null,
        daily_consumption_percent: Math.round(dailyConsumptionPercent * 100) / 100,
        days_remaining: daysRemaining,
        estimated_empty_date: estimatedEmptyDate,
        trend,
        confidence,
        data_points: filteredReadings.length,
      };
    } catch (error) {
      console.error(`[SmartFill Consumption] Error calculating for tank ${tankId}:`, error);
      return this.getEmptyResult(0);
    }
  }

  /**
   * Calculate consumption for multiple tanks and update them in the database
   */
  async calculateAndUpdateTanks(tankIds: string[]): Promise<{
    processed: number;
    updated: number;
    failed: number;
  }> {
    const result = { processed: 0, updated: 0, failed: 0 };

    for (const tankId of tankIds) {
      result.processed++;

      try {
        // Get current tank data
        const { data: tank, error: tankError } = await this.db
          .from('ta_smartfill_tanks')
          .select('id, current_volume_percent, capacity')
          .eq('id', tankId)
          .single();

        if (tankError || !tank) {
          result.failed++;
          continue;
        }

        // Calculate consumption
        const consumption = await this.calculateTankConsumption(
          tankId,
          tank.current_volume_percent,
          tank.capacity
        );

        // Update tank with consumption data
        const { error: updateError } = await this.db
          .from('ta_smartfill_tanks')
          .update({
            avg_daily_consumption: consumption.daily_consumption_liters,
            days_remaining: consumption.days_remaining,
            estimated_empty_date: consumption.estimated_empty_date,
            consumption_trend: consumption.trend,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tankId);

        if (updateError) {
          console.warn(`[SmartFill Consumption] Failed to update tank ${tankId}: ${updateError.message}`);
          result.failed++;
        } else {
          result.updated++;
        }
      } catch (error) {
        console.error(`[SmartFill Consumption] Error processing tank ${tankId}:`, error);
        result.failed++;
      }
    }

    return result;
  }

  /**
   * Calculate consumption for all active tanks of a customer
   */
  async calculateForCustomer(customerId: string): Promise<TankConsumptionUpdate[]> {
    const updates: TankConsumptionUpdate[] = [];

    // Get all active tanks for this customer
    const { data: tanks, error } = await this.db
      .from('ta_smartfill_tanks')
      .select('id, current_volume_percent, capacity')
      .eq('customer_id', customerId)
      .eq('is_active', true);

    if (error || !tanks) {
      console.warn(`[SmartFill Consumption] Failed to fetch tanks for customer ${customerId}`);
      return updates;
    }

    for (const tank of tanks) {
      const consumption = await this.calculateTankConsumption(
        tank.id,
        tank.current_volume_percent,
        tank.capacity
      );

      updates.push({
        tank_id: tank.id,
        avg_daily_consumption: consumption.daily_consumption_liters,
        days_remaining: consumption.days_remaining,
        estimated_empty_date: consumption.estimated_empty_date,
        consumption_trend: consumption.trend,
      });
    }

    return updates;
  }

  /**
   * Filter out refill events (sudden increases in fuel level)
   */
  private filterRefillEvents(readings: SmartFillReading[], threshold: number = 10.0): SmartFillReading[] {
    if (readings.length < 2) return readings;

    const filtered: SmartFillReading[] = [readings[0]];

    for (let i = 1; i < readings.length; i++) {
      const prev = filtered[filtered.length - 1];
      const current = readings[i];

      // Skip if marked as refill
      if (current.is_refill) continue;

      // Skip if looks like a refill (volume percent increased significantly)
      const prevPercent = prev.volume_percent || 0;
      const currPercent = current.volume_percent || 0;
      const change = currPercent - prevPercent;

      if (change > threshold) {
        continue; // Skip refill
      }

      filtered.push(current);
    }

    return filtered;
  }

  /**
   * Calculate linear regression on volume_percent over time
   * Returns slope (percent per day) and R² (quality of fit)
   */
  private calculateLinearRegression(readings: SmartFillReading[]): { slope: number; r2: number } {
    if (readings.length < 2) {
      return { slope: 0, r2: 0 };
    }

    // Convert to data points: x = days since first reading, y = volume_percent
    const firstTime = new Date(readings[0].reading_at).getTime();
    const points = readings
      .filter(r => r.volume_percent !== null)
      .map(r => ({
        x: (new Date(r.reading_at).getTime() - firstTime) / (1000 * 60 * 60 * 24),
        y: r.volume_percent || 0,
      }));

    if (points.length < 2) {
      return { slope: 0, r2: 0 };
    }

    // Calculate means
    const n = points.length;
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

    if (denominatorX === 0) {
      return { slope: 0, r2: 0 };
    }

    const slope = numerator / denominatorX;
    const r2 = denominatorY === 0 ? 0 : (numerator * numerator) / (denominatorX * denominatorY);

    return { slope, r2 };
  }

  /**
   * Determine consumption trend
   */
  private determineTrend(
    slope: number,
    readings: SmartFillReading[]
  ): 'increasing' | 'decreasing' | 'stable' | 'unknown' {
    if (readings.length < 3) return 'unknown';

    // slope < 0 means fuel level is decreasing (consuming)
    // We care about the rate of consumption, not the direction of level change

    if (Math.abs(slope) < 0.5) return 'stable'; // Less than 0.5% per day

    // Compare first half to second half to detect acceleration
    const mid = Math.floor(readings.length / 2);
    const firstHalfAvg = readings.slice(0, mid).reduce((sum, r) => sum + (r.volume_percent || 0), 0) / mid;
    const secondHalfAvg = readings.slice(mid).reduce((sum, r) => sum + (r.volume_percent || 0), 0) / (readings.length - mid);

    const avgChange = secondHalfAvg - firstHalfAvg;

    // If level is dropping faster in second half, consumption is increasing
    if (avgChange < -5) return 'increasing';
    if (avgChange > 5) return 'decreasing';

    return 'stable';
  }

  /**
   * Determine confidence level based on data quality
   */
  private determineConfidence(
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
  private getEmptyResult(dataPoints: number = 0): ConsumptionResult {
    return {
      daily_consumption_liters: null,
      daily_consumption_percent: null,
      days_remaining: null,
      estimated_empty_date: null,
      trend: 'unknown',
      confidence: 'low',
      data_points: dataPoints,
    };
  }
}
