/**
 * Industry Intelligence Hook
 *
 * Main orchestration hook that combines all industry intelligence features
 * for mining and general/industrial customers.
 */

import { useMemo } from 'react';
import { useCustomerFeatures, type IndustryType } from './useCustomerFeatures';
import { useExtremeWeather, type ExtremeWeatherResult } from './useExtremeWeather';
import { useConsumptionAnomaly, type ConsumptionAnomalyResult } from './useConsumptionAnomaly';
import { useCostTracking, type CostTrackingResult } from './useCostTracking';
import { useRoadRiskProfile } from './useRoadRisk';
import {
  genericDeliveryRecommender,
  type GenericDeliveryRecommendation,
} from '@/services/industry/delivery-recommender-generic';
import type { CustomerTank } from './useCustomerAuth';
import type { RoadRiskAssessment } from '@/services/weather/road-risk-calculator';

export interface IndustryAlert {
  id: string;
  type: 'weather' | 'anomaly' | 'delivery' | 'budget';
  severity: 'info' | 'warning' | 'alert';
  title: string;
  description: string;
  actionLabel?: string;
  actionLink?: string;
}

export interface IndustryIntelligenceResult {
  // Feature-specific results
  extremeWeather: ExtremeWeatherResult;
  consumptionAnomaly: ConsumptionAnomalyResult;
  costTracking: CostTrackingResult;
  deliveryRecommendation: GenericDeliveryRecommendation | null;
  roadRisk: RoadRiskAssessment | null;

  // Consolidated alerts
  alerts: IndustryAlert[];
  hasActiveAlerts: boolean;
  highestAlertSeverity: 'info' | 'warning' | 'alert' | null;

  // Status
  isLoading: boolean;
  industryType: IndustryType;
}

/**
 * Main hook for industry intelligence
 *
 * Combines all intelligence features for a tank/customer
 */
export function useIndustryIntelligence(
  tank: CustomerTank | null,
  tanks: CustomerTank[] = []
): IndustryIntelligenceResult {
  const { industryType, proactiveDelivery, extremeWeatherAlerts, consumptionAnomalies, costTracking } =
    useCustomerFeatures();

  // Road risk profile
  const { data: roadProfile } = useRoadRiskProfile(tank?.location_id);

  // Extreme weather
  const extremeWeather = useExtremeWeather(tank?.lat, tank?.lng);

  // Consumption anomaly
  const consumptionAnomaly = useConsumptionAnomaly(
    tank?.asset_id,
    tank?.asset_profile_water_capacity
  );

  // Cost tracking (uses all tanks)
  const costTrackingResult = useCostTracking(tanks.length > 0 ? tanks : tank ? [tank] : []);

  // Delivery recommendation
  const deliveryRecommendation = useMemo(() => {
    if (!tank || !proactiveDelivery) return null;

    const currentLevelPct = tank.latest_calibrated_fill_percentage;
    const currentLevelLiters = tank.asset_current_level_liters;
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

    return genericDeliveryRecommender.calculateGenericRecommendation({
      currentLevelPct,
      currentLevelLiters: currentLevelLiters || (currentLevelPct / 100) * capacityLiters,
      capacityLiters,
      dailyConsumptionLiters,
      industryType,
      lat: tank.lat,
      lng: tank.lng,
      weatherEvents: extremeWeather.events,
      roadRisk: roadProfile || null,
    });
  }, [
    tank,
    proactiveDelivery,
    industryType,
    extremeWeather.events,
    roadProfile,
  ]);

  // Consolidate alerts
  const alerts = useMemo(() => {
    const result: IndustryAlert[] = [];

    // Weather alerts
    if (extremeWeatherAlerts && extremeWeather.events.length > 0) {
      for (const event of extremeWeather.events.slice(0, 2)) {
        result.push({
          id: `weather-${event.type}-${event.startDate.getTime()}`,
          type: 'weather',
          severity: event.severity === 'alert' ? 'alert' : event.severity === 'warning' ? 'warning' : 'info',
          title: getWeatherAlertTitle(event.type),
          description: event.impact.advisory,
          actionLabel: event.recommendations[0],
        });
      }
    }

    // Consumption anomaly
    if (consumptionAnomalies && consumptionAnomaly.currentAnomaly?.hasAnomaly) {
      const anomaly = consumptionAnomaly.currentAnomaly;
      result.push({
        id: `anomaly-${anomaly.type}`,
        type: 'anomaly',
        severity: anomaly.severity,
        title: anomaly.type === 'spike' ? 'Higher Than Usual' : 'Lower Than Expected',
        description: anomaly.recommendation,
      });
    }

    // Delivery recommendation
    if (proactiveDelivery && deliveryRecommendation && deliveryRecommendation.urgencyLevel !== 'good') {
      result.push({
        id: 'delivery-recommendation',
        type: 'delivery',
        severity: deliveryRecommendation.urgencyLevel === 'critical' ? 'alert' :
                  deliveryRecommendation.urgencyLevel === 'warning' ? 'warning' : 'info',
        title: 'Delivery Suggestion',
        description: deliveryRecommendation.reason,
        actionLabel: 'Schedule Delivery',
        actionLink: tank ? `/customer/request?tank=${tank.id}` : '/customer/request',
      });
    }

    // Budget alert
    if (costTracking && costTrackingResult.budgetSummary?.status === 'at_risk') {
      result.push({
        id: 'budget-at-risk',
        type: 'budget',
        severity: 'warning',
        title: 'Budget Alert',
        description: `Projected to exceed budget by ${Math.abs(costTrackingResult.budgetSummary.projectedOverUnder || 0).toFixed(0)}`,
      });
    } else if (costTracking && costTrackingResult.budgetSummary?.status === 'over_budget') {
      result.push({
        id: 'budget-over',
        type: 'budget',
        severity: 'alert',
        title: 'Over Budget',
        description: `Exceeded budget by ${Math.abs(costTrackingResult.budgetSummary.remainingAmount || 0).toFixed(0)}`,
      });
    }

    return result;
  }, [
    extremeWeatherAlerts,
    extremeWeather.events,
    consumptionAnomalies,
    consumptionAnomaly.currentAnomaly,
    proactiveDelivery,
    deliveryRecommendation,
    costTracking,
    costTrackingResult.budgetSummary,
    tank,
  ]);

  const hasActiveAlerts = alerts.length > 0;
  const highestAlertSeverity = useMemo(() => {
    if (alerts.some((a) => a.severity === 'alert')) return 'alert';
    if (alerts.some((a) => a.severity === 'warning')) return 'warning';
    if (alerts.some((a) => a.severity === 'info')) return 'info';
    return null;
  }, [alerts]);

  const isLoading =
    extremeWeather.isLoading ||
    consumptionAnomaly.isLoading ||
    costTrackingResult.isLoading;

  return {
    extremeWeather,
    consumptionAnomaly,
    costTracking: costTrackingResult,
    deliveryRecommendation,
    roadRisk: roadProfile || null,
    alerts,
    hasActiveAlerts,
    highestAlertSeverity,
    isLoading,
    industryType,
  };
}

/**
 * Get human-readable title for weather event type
 */
function getWeatherAlertTitle(type: string): string {
  switch (type) {
    case 'extreme_heat':
      return 'Extreme Heat Advisory';
    case 'cyclone':
      return 'Cyclone Warning';
    case 'storm':
      return 'Storm Warning';
    case 'heavy_rain':
      return 'Heavy Rain Expected';
    default:
      return 'Weather Alert';
  }
}

export default useIndustryIntelligence;
