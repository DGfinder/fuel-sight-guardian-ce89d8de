/**
 * Consumption Anomaly Hook
 *
 * Detects unusual consumption patterns for all industry types.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  consumptionAnomalyService,
  type AnomalyResult,
} from '@/services/consumption-anomaly';
import {
  baselineCalculator,
  type BaselineResult,
  type TankReading,
} from '@/services/agricultural/baseline-calculator';
import { useCustomerFeatures, type IndustryType } from './useCustomerFeatures';

export interface ConsumptionAnomalyResult {
  currentAnomaly: AnomalyResult | null;
  baseline: BaselineResult | null;
  recentConsumption: number | null; // L/day
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to detect consumption anomalies for a tank
 */
export function useConsumptionAnomaly(
  assetId: string | undefined,
  capacityLiters: number | undefined,
  industryTypeOverride?: IndustryType
): ConsumptionAnomalyResult {
  const { industryType: customerIndustryType, consumptionAnomalies } = useCustomerFeatures();
  const industryType = industryTypeOverride || customerIndustryType;

  // Fetch readings for baseline calculation (90 days)
  const { data: readings, isLoading: readingsLoading } = useQuery({
    queryKey: ['tank-readings-baseline', assetId],
    queryFn: async () => {
      if (!assetId) return [];

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const { data, error } = await supabase
        .from('ta_agbot_readings')
        .select('reading_at, level_percent, level_liters')
        .eq('asset_id', assetId)
        .gte('reading_at', ninetyDaysAgo.toISOString())
        .order('reading_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((r) => ({
        reading_at: r.reading_at,
        level_percent: r.level_percent,
        level_liters: r.level_liters,
      })) as TankReading[];
    },
    enabled: !!assetId && consumptionAnomalies,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  // Fetch recent readings (7 days) for current consumption
  const { data: recentReadings, isLoading: recentLoading } = useQuery({
    queryKey: ['tank-readings-recent', assetId],
    queryFn: async () => {
      if (!assetId) return [];

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('ta_agbot_readings')
        .select('reading_at, level_percent, level_liters')
        .eq('asset_id', assetId)
        .gte('reading_at', sevenDaysAgo.toISOString())
        .order('reading_at', { ascending: true });

      if (error) throw error;

      return (data || []).map((r) => ({
        reading_at: r.reading_at,
        level_percent: r.level_percent,
        level_liters: r.level_liters,
      })) as TankReading[];
    },
    enabled: !!assetId && consumptionAnomalies,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Calculate baseline and detect anomaly
  const { data: anomalyData, isLoading: anomalyLoading } = useQuery({
    queryKey: ['consumption-anomaly', assetId, readings?.length, recentReadings?.length],
    queryFn: async () => {
      if (!readings || readings.length < 7 || !recentReadings || recentReadings.length < 2) {
        return { anomaly: null, baseline: null, recentConsumption: null };
      }

      // Calculate baseline from historical readings
      const baseline = baselineCalculator.calculateBaseline(
        readings,
        capacityLiters || null
      );

      if (!baseline) {
        return { anomaly: null, baseline: null, recentConsumption: null };
      }

      // Calculate recent daily consumption
      const recentDaily = baselineCalculator.calculateDailyConsumptions(
        recentReadings,
        capacityLiters || null
      );

      // Filter to actual consumption days (not refills)
      const consumptionDays = recentDaily.filter((d) => !d.isRefillDay && d.consumptionPct > 0.5);

      if (consumptionDays.length === 0) {
        return { anomaly: null, baseline, recentConsumption: null };
      }

      // Calculate average recent consumption
      const avgRecentPct =
        consumptionDays.reduce((sum, d) => sum + d.consumptionPct, 0) / consumptionDays.length;
      const recentConsumption = baseline.baselineLitersPerDay
        ? (avgRecentPct / baseline.baselinePctPerDay) * baseline.baselineLitersPerDay
        : null;

      // Detect anomaly
      const anomaly = consumptionAnomalyService.detectAnomaly(
        recentConsumption || avgRecentPct * (capacityLiters || 1) / 100,
        baseline,
        industryType
      );

      return {
        anomaly,
        baseline,
        recentConsumption,
      };
    },
    enabled: !!readings && readings.length > 0 && !!recentReadings && consumptionAnomalies,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  const isLoading = readingsLoading || recentLoading || anomalyLoading;

  return {
    currentAnomaly: anomalyData?.anomaly || null,
    baseline: anomalyData?.baseline || null,
    recentConsumption: anomalyData?.recentConsumption || null,
    isLoading,
    error: null,
  };
}

/**
 * Acknowledge an anomaly (dismiss the alert)
 */
export function useAcknowledgeAnomaly() {
  // This would typically be a mutation to update the consumption_anomaly_logs table
  // For now, we'll just return a placeholder function
  return {
    acknowledge: async (anomalyId: string) => {
      // TODO: Implement acknowledgment
      console.log('Acknowledge anomaly:', anomalyId);
    },
  };
}

export default useConsumptionAnomaly;
