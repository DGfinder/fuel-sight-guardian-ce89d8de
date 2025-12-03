/**
 * Consumption Analysis Service
 * Statistical analysis of fuel consumption patterns
 *
 * Responsibilities:
 * - Linear regression analysis on historical readings
 * - Daily consumption rate calculation
 * - Days remaining forecasting
 * - Refill event detection
 * - Trend analysis
 *
 * Migrated from: api/lib/consumption-calculator.ts (401 lines)
 *
 * Dependencies:
 * - ReadingsHistoryRepository (historical data access)
 * - AgBotAssetRepository (asset updates)
 */

import {
  ReadingsHistoryRepository,
  AgBotReading,
} from '../repositories/ReadingsHistoryRepository.js';
import { AgBotAssetRepository } from '../repositories/AgBotAssetRepository.js';

export interface ConsumptionResult {
  daily_consumption_litres: number | null;
  daily_consumption_percentage: number | null;
  days_remaining: number | null;
  trend: 'increasing' | 'decreasing' | 'stable' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  data_points: number;
}

interface RegressionResult {
  slope: number;
  r2: number;
}

interface RecalculationResult {
  processed: number;
  updated: number;
  failed: number;
}

export class ConsumptionAnalysisService {
  constructor(
    private readingsRepo: ReadingsHistoryRepository,
    private assetRepo: AgBotAssetRepository
  ) {}

  /**
   * Calculate daily consumption rate from historical readings
   * Uses linear regression for accurate trend analysis
   */
  async calculateConsumption(
    assetId: string,
    currentLevel: number,
    tankCapacity: number | null,
    daysToAnalyze: number = 7
  ): Promise<ConsumptionResult> {
    try {
      // Fetch historical readings
      const readings = await this.readingsRepo.findRecentReadings(assetId, daysToAnalyze * 24);

      if (!readings || readings.length < 3) {
        return this.getEmptyResult(readings?.length || 0);
      }

      // Filter out refill events
      const filteredReadings = this.filterRefillEvents(readings);

      if (filteredReadings.length < 3) {
        return this.getEmptyResult(filteredReadings.length);
      }

      // Determine data reliability
      const usePercentData = this.isPercentDataReliable(filteredReadings);
      const useLitersData = this.isLitersDataReliable(filteredReadings);

      let dailyConsumptionPercentage: number = 0;
      let dailyConsumptionLitres: number | null = null;
      let daysRemaining: number | null = null;
      let r2: number = 0;

      if (usePercentData) {
        // Use percentage-based regression
        const regression = this.calculateLinearRegression(filteredReadings, 'percent');
        dailyConsumptionPercentage = Math.abs(regression.slope);
        r2 = regression.r2;

        // Calculate consumption in litres if capacity known
        if (tankCapacity && tankCapacity > 0) {
          dailyConsumptionLitres = (dailyConsumptionPercentage / 100) * tankCapacity;
        }

        // Calculate days remaining from percentage
        if (dailyConsumptionPercentage > 0.1) {
          daysRemaining = currentLevel / dailyConsumptionPercentage;
        }
      } else if (useLitersData && tankCapacity && tankCapacity > 0) {
        // Use liters-based regression (fallback when percent data is unreliable)
        console.log(`[ConsumptionAnalysisService] Using liters-based calculation for asset ${assetId}`);
        const regression = this.calculateLinearRegression(filteredReadings, 'liters');
        dailyConsumptionLitres = Math.abs(regression.slope);
        r2 = regression.r2;

        // Calculate percentage consumption from liters
        dailyConsumptionPercentage = (dailyConsumptionLitres / tankCapacity) * 100;

        // Calculate days remaining from current liters
        const currentLevelLiters = filteredReadings[filteredReadings.length - 1]?.level_liters;
        if (dailyConsumptionLitres > 0 && currentLevelLiters && currentLevelLiters > 0) {
          daysRemaining = currentLevelLiters / dailyConsumptionLitres;
        }
      } else {
        // No reliable data available
        return this.getEmptyResult(filteredReadings.length);
      }

      // Cap days remaining at reasonable maximum
      if (daysRemaining !== null && daysRemaining > 365) {
        daysRemaining = 365;
      }

      // Ensure days remaining is at least 0
      if (daysRemaining !== null && daysRemaining < 0) {
        daysRemaining = 0;
      }

      // Determine trend and confidence
      const trend = this.determineTrend(-dailyConsumptionPercentage, filteredReadings);
      const confidence = this.determineConfidence(filteredReadings.length, r2, daysToAnalyze);

      return {
        daily_consumption_litres: dailyConsumptionLitres
          ? Math.round(dailyConsumptionLitres * 100) / 100
          : null,
        daily_consumption_percentage: Math.round(dailyConsumptionPercentage * 100) / 100,
        days_remaining: daysRemaining !== null ? Math.round(daysRemaining) : null,
        trend,
        confidence,
        data_points: filteredReadings.length,
      };
    } catch (error) {
      console.error('[ConsumptionAnalysisService] Error calculating consumption:', error);
      return this.getEmptyResult(0);
    }
  }

  /**
   * Recalculate consumption for all active assets
   * Used by scheduled jobs
   */
  async recalculateAll(): Promise<RecalculationResult> {
    try {
      // Fetch all active assets
      const allAssets = await this.assetRepo.findOnline();
      const result: RecalculationResult = {
        processed: 0,
        updated: 0,
        failed: 0,
      };

      for (const asset of allAssets) {
        result.processed++;

        try {
          const consumption = await this.calculateConsumption(
            asset.id,
            asset.current_level_percent || 0,
            asset.capacity_liters
          );

          await this.assetRepo.updateConsumption(asset.id, {
            daily_consumption_liters: consumption.daily_consumption_litres || 0,
            days_remaining: consumption.days_remaining || 0,
          });

          result.updated++;
        } catch (error) {
          console.error(`[ConsumptionAnalysisService] Failed to recalculate asset ${asset.id}:`, error);
          result.failed++;
        }
      }

      console.log(
        `[ConsumptionAnalysisService] Recalculation complete: ${result.updated} updated, ${result.failed} failed, ${result.processed} total`
      );

      return result;
    } catch (error) {
      console.error('[ConsumptionAnalysisService] Error in recalculateAll:', error);
      return { processed: 0, updated: 0, failed: 0 };
    }
  }

  /**
   * Detect refill events in an asset's history
   */
  async detectRefillEvents(assetId: string, days: number, thresholdPercent: number = 10): Promise<AgBotReading[]> {
    return this.readingsRepo.detectRefillEvents(assetId, days, thresholdPercent);
  }

  /**
   * Get consumption trend for an asset
   */
  async getTrendDirection(assetId: string, days: number = 7): Promise<'increasing' | 'decreasing' | 'stable'> {
    const trendData = await this.readingsRepo.getConsumptionTrend(assetId, days);
    return trendData.direction;
  }

  /**
   * Filter out refill events (sudden increases in fuel level)
   */
  private filterRefillEvents(readings: AgBotReading[]): AgBotReading[] {
    if (readings.length < 2) return readings;

    const filtered: AgBotReading[] = [readings[0]];

    for (let i = 1; i < readings.length; i++) {
      const prev = readings[i - 1];
      const current = readings[i];
      const change = (current.level_percent || 0) - (prev.level_percent || 0);

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
   * Returns slope (per day) and R² (quality of fit)
   */
  private calculateLinearRegression(
    readings: AgBotReading[],
    mode: 'percent' | 'liters' = 'percent'
  ): RegressionResult {
    // Convert timestamps to days since first reading
    const firstTime = new Date(readings[0].reading_at).getTime();
    const points: { x: number; y: number }[] = readings
      .filter((r) => (mode === 'percent' ? true : r.level_liters !== null))
      .map((r) => ({
        x: (new Date(r.reading_at).getTime() - firstTime) / (1000 * 60 * 60 * 24),
        y: mode === 'percent' ? r.level_percent || 0 : r.level_liters || 0,
      }));

    if (points.length < 2) {
      return { slope: 0, r2: 0 };
    }

    // Calculate means
    const pointsCount = points.length;
    const meanX = points.reduce((sum, p) => sum + p.x, 0) / pointsCount;
    const meanY = points.reduce((sum, p) => sum + p.y, 0) / pointsCount;

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
  private determineTrend(
    slope: number,
    readings: AgBotReading[]
  ): 'increasing' | 'decreasing' | 'stable' | 'unknown' {
    if (readings.length < 3) return 'unknown';

    // Compare first half to second half of readings
    const mid = Math.floor(readings.length / 2);
    const firstHalfAvg =
      readings.slice(0, mid).reduce((sum, r) => sum + (r.level_percent || 0), 0) / mid;
    const secondHalfAvg =
      readings.slice(mid).reduce((sum, r) => sum + (r.level_percent || 0), 0) /
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
   * Check if level_percent data is reliable (not mostly zeros)
   */
  private isPercentDataReliable(readings: AgBotReading[]): boolean {
    if (readings.length === 0) return false;
    const nonZeroCount = readings.filter((r) => (r.level_percent || 0) > 0).length;
    return nonZeroCount / readings.length >= 0.5;
  }

  /**
   * Check if level_liters data is reliable (has enough non-null values)
   */
  private isLitersDataReliable(readings: AgBotReading[]): boolean {
    if (readings.length === 0) return false;
    const validCount = readings.filter((r) => r.level_liters !== null && (r.level_liters || 0) > 0).length;
    return validCount / readings.length >= 0.5;
  }

  /**
   * Return empty result structure
   */
  private getEmptyResult(dataPoints: number = 0): ConsumptionResult {
    return {
      daily_consumption_litres: null,
      daily_consumption_percentage: null,
      days_remaining: null,
      trend: 'unknown',
      confidence: 'low',
      data_points: dataPoints,
    };
  }
}
