/**
 * AgBot Analytics Service
 * Fleet-wide and per-tank analytics for reporting
 *
 * Responsibilities:
 * - 24h/7d/30d consumption calculations
 * - Trend analysis
 * - Fleet summary statistics
 * - Sparkline data generation
 * - Efficiency scoring
 *
 * Migrated from: api/lib/agbot-email-analytics.ts (416 lines)
 *
 * Dependencies:
 * - ReadingsHistoryRepository (historical data)
 * - AgBotAssetRepository (asset data)
 * - AgBotLocationRepository (location data)
 */

import {
  ReadingsHistoryRepository,
  AgBotReading,
} from '../repositories/ReadingsHistoryRepository.js';
import { AgBotAssetRepository } from '../repositories/AgBotAssetRepository.js';
import { AgBotLocationRepository } from '../repositories/AgBotLocationRepository.js';

export interface TankConsumptionData {
  location_id: string;
  tank_name: string;
  current_level_pct: number;
  current_litres: number;
  capacity_litres: number;
  consumption_24h_litres: number;
  consumption_24h_pct: number;
  consumption_7d_litres: number;
  consumption_7d_pct: number;
  consumption_30d_litres: number | null;
  consumption_30d_pct: number | null;
  daily_avg_consumption_litres: number;
  trend_direction: 'increasing' | 'decreasing' | 'stable';
  trend_indicator: '↑' | '↓' | '→';
  days_remaining: number | null;
  estimated_refill_date: string | null;
  last_refill_date: string | null;
  vs_yesterday_pct: number;
  vs_7d_avg_pct: number;
  efficiency_score: number;
  sparkline_7d: number[];
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

export class AgBotAnalyticsService {
  constructor(
    private readingsRepo: ReadingsHistoryRepository,
    private assetRepo: AgBotAssetRepository,
    private locationRepo: AgBotLocationRepository
  ) {}

  /**
   * Get comprehensive analytics for a single tank
   */
  async getTankAnalytics(assetId: string): Promise<TankConsumptionData | null> {
    try {
      const asset = await this.assetRepo.findById(assetId);
      if (!asset) {
        return null;
      }

      // Fetch consumption metrics
      const consumption24h = await this.fetch24HourConsumption(assetId);
      const consumption7d = await this.fetch7DayConsumption(assetId);
      const consumption30d = await this.fetch30DayConsumption(assetId);

      // Calculate daily average
      const dailyAvg = consumption7d.daily_values.length > 0
        ? consumption7d.daily_values.reduce((sum, v) => sum + v, 0) / consumption7d.daily_values.length
        : 0;

      // Determine trend
      const trendDirection = this.calculateTrendDirection(consumption7d.daily_values);
      const trendIndicator = trendDirection === 'increasing' ? '↑' : trendDirection === 'decreasing' ? '↓' : '→';

      // Calculate efficiency score (0-100)
      const efficiencyScore = this.calculateEfficiencyScore(
        consumption24h.litres,
        dailyAvg,
        asset.current_level_percent || 0
      );

      // Get refill date estimate
      const daysRemaining = asset.days_remaining;
      const estimatedRefillDate = daysRemaining
        ? new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Detect last refill
      const refillEvents = await this.readingsRepo.detectRefillEvents(assetId, 30);
      const lastRefillDate = refillEvents.length > 0 ? refillEvents[0].reading_at : null;

      return {
        location_id: asset.location_id,
        tank_name: asset.name || 'Unknown Tank',
        current_level_pct: asset.current_level_percent || 0,
        current_litres: asset.current_level_liters || 0,
        capacity_litres: asset.capacity_liters || 0,
        consumption_24h_litres: consumption24h.litres,
        consumption_24h_pct: consumption24h.pct,
        consumption_7d_litres: consumption7d.litres,
        consumption_7d_pct: consumption7d.pct,
        consumption_30d_litres: consumption30d.litres,
        consumption_30d_pct: consumption30d.pct,
        daily_avg_consumption_litres: Math.round(dailyAvg),
        trend_direction: trendDirection,
        trend_indicator: trendIndicator,
        days_remaining: daysRemaining,
        estimated_refill_date: estimatedRefillDate,
        last_refill_date: lastRefillDate,
        vs_yesterday_pct: this.calculateVsYesterday(consumption7d.daily_values),
        vs_7d_avg_pct: this.calculateVs7dAvg(consumption24h.litres, dailyAvg),
        efficiency_score: efficiencyScore,
        sparkline_7d: consumption7d.daily_values,
      };
    } catch (error) {
      console.error('[AgBotAnalyticsService] Error getting tank analytics:', error);
      return null;
    }
  }

  /**
   * Get fleet-wide summary analytics
   */
  async getFleetSummary(): Promise<FleetSummary> {
    try {
      const assets = await this.assetRepo.findOnline();

      let total24h = 0;
      let total7d = 0;
      let total30d = 0;
      let efficiencySum = 0;
      let mostConsumedTank: string | null = null;
      let mostConsumedAmount = 0;
      const trendValues: number[] = [];

      for (const asset of assets) {
        const consumption24h = await this.fetch24HourConsumption(asset.id);
        const consumption7d = await this.fetch7DayConsumption(asset.id);
        const consumption30d = await this.fetch30DayConsumption(asset.id);

        total24h += consumption24h.litres;
        total7d += consumption7d.litres;
        if (consumption30d.litres !== null) {
          total30d += consumption30d.litres;
        }

        // Track most consumed tank
        if (consumption24h.litres > mostConsumedAmount) {
          mostConsumedAmount = consumption24h.litres;
          mostConsumedTank = asset.name || 'Unknown';
        }

        // Calculate efficiency
        const dailyAvg = consumption7d.daily_values.length > 0
          ? consumption7d.daily_values.reduce((sum, v) => sum + v, 0) / consumption7d.daily_values.length
          : 0;
        efficiencySum += this.calculateEfficiencyScore(
          consumption24h.litres,
          dailyAvg,
          asset.current_level_percent || 0
        );

        // Collect trend data
        trendValues.push(...consumption7d.daily_values);
      }

      const avgConsumption24h = assets.length > 0 ? total24h / assets.length : 0;
      const efficiencyAvg = assets.length > 0 ? efficiencySum / assets.length : 0;
      const fleetTrend = this.calculateTrendDirection(trendValues);

      return {
        total_consumption_24h: Math.round(total24h),
        total_consumption_7d: Math.round(total7d),
        total_consumption_30d: total30d > 0 ? Math.round(total30d) : null,
        avg_consumption_per_tank_24h: Math.round(avgConsumption24h),
        fleet_trend: fleetTrend,
        most_consumed_tank: mostConsumedTank,
        most_consumed_amount: Math.round(mostConsumedAmount),
        efficiency_avg: Math.round(efficiencyAvg),
      };
    } catch (error) {
      console.error('[AgBotAnalyticsService] Error getting fleet summary:', error);
      return {
        total_consumption_24h: 0,
        total_consumption_7d: 0,
        total_consumption_30d: null,
        avg_consumption_per_tank_24h: 0,
        fleet_trend: 'stable',
        most_consumed_tank: null,
        most_consumed_amount: 0,
        efficiency_avg: 0,
      };
    }
  }

  /**
   * Fetch 24-hour consumption data
   */
  private async fetch24HourConsumption(
    assetId: string
  ): Promise<{ litres: number; pct: number }> {
    const readings = await this.readingsRepo.findRecentReadings(assetId, 24);

    if (readings.length < 2) {
      return { litres: 0, pct: 0 };
    }

    const oldest = readings[0]; // Oldest is first (ascending order)
    const newest = readings[readings.length - 1];

    const pctConsumed = Math.max(0, (oldest.level_percent || 0) - (newest.level_percent || 0));
    const litresConsumed =
      oldest.level_liters && newest.level_liters
        ? Math.max(0, oldest.level_liters - newest.level_liters)
        : 0;

    return {
      litres: Math.round(litresConsumed),
      pct: Number(pctConsumed.toFixed(1)),
    };
  }

  /**
   * Fetch 7-day consumption data with daily sparkline values
   */
  private async fetch7DayConsumption(
    assetId: string
  ): Promise<{ litres: number; pct: number; daily_values: number[] }> {
    const readings = await this.readingsRepo.findRecentReadings(assetId, 7 * 24);

    if (readings.length < 2) {
      return { litres: 0, pct: 0, daily_values: new Array(7).fill(0) };
    }

    const oldest = readings[0]; // Oldest is first (ascending order)
    const newest = readings[readings.length - 1];

    const pctConsumed = Math.max(0, (oldest.level_percent || 0) - (newest.level_percent || 0));
    const litresConsumed =
      oldest.level_liters && newest.level_liters
        ? Math.max(0, oldest.level_liters - newest.level_liters)
        : 0;

    // Calculate daily values for sparkline
    const daily_values: number[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayReadings = readings.filter((r) => {
        const t = new Date(r.reading_at);
        return t >= dayStart && t < dayEnd;
      });

      if (dayReadings.length >= 2) {
        const dayOldest = dayReadings[dayReadings.length - 1];
        const dayNewest = dayReadings[0];
        const dayConsumption =
          dayOldest.level_liters && dayNewest.level_liters
            ? Math.max(0, dayOldest.level_liters - dayNewest.level_liters)
            : 0;
        daily_values.push(Math.round(dayConsumption));
      } else {
        daily_values.push(0);
      }
    }

    return {
      litres: Math.round(litresConsumed),
      pct: Number(pctConsumed.toFixed(1)),
      daily_values,
    };
  }

  /**
   * Fetch 30-day consumption data
   */
  private async fetch30DayConsumption(
    assetId: string
  ): Promise<{ litres: number | null; pct: number | null }> {
    const readings = await this.readingsRepo.findRecentReadings(assetId, 30 * 24);

    if (readings.length < 2) {
      return { litres: null, pct: null };
    }

    const oldest = readings[0]; // Oldest is first (ascending order)
    const newest = readings[readings.length - 1];

    const pctConsumed = Math.max(0, (oldest.level_percent || 0) - (newest.level_percent || 0));
    const litresConsumed =
      oldest.level_liters && newest.level_liters
        ? Math.max(0, oldest.level_liters - newest.level_liters)
        : 0;

    return {
      litres: litresConsumed > 0 ? Math.round(litresConsumed) : null,
      pct: pctConsumed > 0 ? Number(pctConsumed.toFixed(1)) : null,
    };
  }

  /**
   * Calculate trend direction from time-series data
   */
  private calculateTrendDirection(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 3) return 'stable';

    const mid = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, mid);
    const secondHalf = values.slice(mid);

    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / (firstAvg || 1)) * 100;

    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate efficiency score (0-100)
   */
  private calculateEfficiencyScore(
    consumption24h: number,
    dailyAvg: number,
    currentLevel: number
  ): number {
    // Base score on consistency (low variation = high score)
    const variation = dailyAvg > 0 ? Math.abs(consumption24h - dailyAvg) / dailyAvg : 0;
    const consistencyScore = Math.max(0, 100 - variation * 100);

    // Penalize low fuel levels
    const levelPenalty = currentLevel < 25 ? (25 - currentLevel) * 2 : 0;

    return Math.max(0, Math.min(100, consistencyScore - levelPenalty));
  }

  /**
   * Calculate percentage change vs yesterday
   */
  private calculateVsYesterday(dailyValues: number[]): number {
    if (dailyValues.length < 2) return 0;

    const today = dailyValues[dailyValues.length - 1];
    const yesterday = dailyValues[dailyValues.length - 2];

    if (yesterday === 0) return 0;

    return Number((((today - yesterday) / yesterday) * 100).toFixed(1));
  }

  /**
   * Calculate percentage change vs 7-day average
   */
  private calculateVs7dAvg(consumption24h: number, avg7d: number): number {
    if (avg7d === 0) return 0;

    return Number((((consumption24h - avg7d) / avg7d) * 100).toFixed(1));
  }

  /**
   * Get sparkline data for visualization
   */
  async getSparklineData(assetId: string, days: number): Promise<number[]> {
    const consumption = await this.fetch7DayConsumption(assetId);
    return consumption.daily_values;
  }
}
