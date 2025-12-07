/**
 * Proactive Delivery Hook
 *
 * Combines agricultural intelligence with consumption data to provide
 * actionable delivery recommendations for farming customers.
 */

import { useQuery } from '@tanstack/react-query';
import { useAgriculturalIntelligence } from './useAgriculturalIntelligence';
import { useCustomerAccount, type CustomerTank } from './useCustomerAuth';
import { useRoadRiskProfile } from './useRoadRisk';
import {
  deliveryRecommender,
  type DeliveryRecommendation,
  type DeliverySettings,
  type UpcomingOperation,
} from '@/services/agricultural';
import { supabase } from '@/lib/supabase';

export interface ProactiveDeliveryResult {
  recommendation: DeliveryRecommendation | null;
  hasUpcomingOperation: boolean;
  operationName: string | null;
  isLoading: boolean;
  error: Error | null;
}

// Default delivery settings
const DEFAULT_DELIVERY_SETTINGS: DeliverySettings = {
  leadTimeDays: 3,
  targetLevelPct: 70,
  spikeThresholdMultiplier: 2.0,
};

/**
 * Hook to get proactive delivery recommendation for a tank
 */
export function useProactiveDelivery(tank: CustomerTank | null): ProactiveDeliveryResult {
  const { data: customerAccount } = useCustomerAccount();
  const { data: roadProfile } = useRoadRiskProfile(tank?.location_id);

  // Get agricultural intelligence (includes predicted operations)
  const {
    data: intelligence,
    isLoading: intelligenceLoading,
    error: intelligenceError,
  } = useAgriculturalIntelligence(
    tank?.lat ?? undefined,
    tank?.lng ?? undefined,
    tank?.latest_calibrated_fill_percentage ?? undefined,
    tank?.asset_daily_consumption ?? undefined,
    tank?.asset_profile_water_capacity ?? undefined,
    roadProfile
  );

  // Fetch customer's delivery settings
  const { data: settings } = useQuery<DeliverySettings>({
    queryKey: ['delivery-settings', customerAccount?.id],
    queryFn: async () => {
      if (!customerAccount?.id) return DEFAULT_DELIVERY_SETTINGS;

      const { data, error } = await supabase
        .from('customer_accounts')
        .select('delivery_settings')
        .eq('id', customerAccount.id)
        .single();

      if (error || !data?.delivery_settings) {
        return DEFAULT_DELIVERY_SETTINGS;
      }

      return {
        leadTimeDays: data.delivery_settings.lead_time_days ?? 3,
        targetLevelPct: data.delivery_settings.target_level_pct ?? 70,
        spikeThresholdMultiplier: data.delivery_settings.spike_threshold_multiplier ?? 2.0,
      };
    },
    enabled: !!customerAccount?.id,
    staleTime: 1000 * 60 * 30, // 30 minutes
  });

  // Calculate recommendation
  const { data: recommendation, isLoading, error } = useQuery<DeliveryRecommendation | null>({
    queryKey: [
      'proactive-delivery',
      tank?.location_id,
      tank?.latest_calibrated_fill_percentage,
      tank?.asset_daily_consumption,
      intelligence?.operations?.length,
      settings,
    ],
    queryFn: async () => {
      if (!tank) return null;

      // Need basic tank data
      const currentLevelPct = tank.latest_calibrated_fill_percentage;
      const capacityLiters = tank.asset_profile_water_capacity;
      const dailyConsumptionLiters = tank.asset_daily_consumption;

      if (
        currentLevelPct === null ||
        currentLevelPct === undefined ||
        !capacityLiters ||
        !dailyConsumptionLiters
      ) {
        return null;
      }

      // Convert intelligence operations to our format
      const upcomingOperations: UpcomingOperation[] = intelligence?.operations
        ? deliveryRecommender.convertPredictedOperations(
            intelligence.operations.map((op) => ({
              operation: op.operation,
              startDate: op.startDate,
              endDate: op.endDate,
              fuelImpact: op.fuelImpact,
            }))
          )
        : [];

      // Calculate current level in liters
      const currentLevelLiters = (currentLevelPct / 100) * capacityLiters;

      // Calculate recommendation
      const recommendation = deliveryRecommender.calculateRecommendation({
        currentLevelPct,
        currentLevelLiters,
        capacityLiters,
        dailyConsumptionLiters,
        upcomingOperations,
        settings: settings ?? DEFAULT_DELIVERY_SETTINGS,
      });

      return recommendation;
    },
    enabled: !!tank && !!intelligence,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  const hasUpcomingOperation = !!recommendation?.operationType;
  const operationName = recommendation?.operationType
    ? capitalizeFirst(recommendation.operationType)
    : null;

  return {
    recommendation: recommendation ?? null,
    hasUpcomingOperation,
    operationName,
    isLoading: isLoading || intelligenceLoading,
    error: error || intelligenceError || null,
  };
}

/**
 * Hook to get delivery recommendations for all customer tanks
 */
export function useAllTanksDeliveryStatus(tanks: CustomerTank[]) {
  return useQuery({
    queryKey: ['all-tanks-delivery-status', tanks.map((t) => t.location_id).join(',')],
    queryFn: async () => {
      // For each tank, calculate basic urgency without full agricultural intelligence
      // This is a lightweight version for fleet overview
      const results = tanks.map((tank) => {
        const currentLevelPct = tank.latest_calibrated_fill_percentage;
        const capacityLiters = tank.asset_profile_water_capacity;
        const dailyConsumptionLiters = tank.asset_daily_consumption;

        if (!currentLevelPct || !capacityLiters || !dailyConsumptionLiters) {
          return { tankId: tank.location_id, urgency: null, daysRemaining: null };
        }

        const currentLevelLiters = (currentLevelPct / 100) * capacityLiters;
        const lowLevelLiters = capacityLiters * 0.2;
        const litersAboveLow = currentLevelLiters - lowLevelLiters;
        const daysToLow = dailyConsumptionLiters > 0
          ? Math.floor(litersAboveLow / dailyConsumptionLiters)
          : 365;

        const bufferDays = daysToLow - 3; // Subtract lead time
        const urgency = deliveryRecommender.calculateUrgency(bufferDays);

        return {
          tankId: tank.location_id,
          urgency,
          daysRemaining: daysToLow,
        };
      });

      // Count by urgency
      const criticalCount = results.filter((r) => r.urgency === 'critical').length;
      const warningCount = results.filter((r) => r.urgency === 'warning').length;

      return {
        tanks: results,
        criticalCount,
        warningCount,
        hasUrgent: criticalCount > 0 || warningCount > 0,
      };
    },
    enabled: tanks.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to acknowledge a delivery recommendation
 */
export function useAcknowledgeRecommendation() {
  return useQuery({
    queryKey: ['acknowledge-recommendation'],
    queryFn: async () => null, // Placeholder - will use mutation
    enabled: false,
  });
}

// Helper
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default useProactiveDelivery;
