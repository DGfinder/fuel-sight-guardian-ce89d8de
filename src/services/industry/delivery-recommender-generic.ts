/**
 * Generic Delivery Recommender Service
 *
 * Calculates proactive delivery recommendations for mining and general/industrial customers.
 * Adapts the agricultural recommender patterns but without harvest/seeding context.
 *
 * Considers:
 * - Current tank level and consumption rate
 * - Weather-based access windows (road closures, storms)
 * - Extreme weather events (heat affecting consumption)
 * - Delivery lead time requirements
 */

import { addDays, differenceInDays, format, isBefore, startOfDay } from 'date-fns';
import type { IndustryType } from '@/hooks/useCustomerFeatures';
import type { ExtremeWeatherEvent } from '@/services/weather/extreme-weather';
import type { RoadRiskAssessment } from '@/services/weather/road-risk-calculator';
import {
  shouldShowWeatherDeliveryAlerts,
  hasRoadClosureRisk as regionHasRoadClosureRisk,
} from '@/lib/region-detector';

// Types
export type UrgencyLevel = 'critical' | 'warning' | 'normal' | 'good';

export interface WeatherWindow {
  type: 'road_closure' | 'storm' | 'cyclone' | 'heavy_rain';
  startDate: Date;
  endDate: Date;
  severity: string;
  description: string;
}

export interface GenericDeliverySettings {
  leadTimeDays: number;
  targetLevelPct: number;
  lowLevelPct: number;
}

export interface GenericRecommendationInput {
  currentLevelPct: number;
  currentLevelLiters: number;
  capacityLiters: number;
  dailyConsumptionLiters: number;
  industryType: IndustryType;
  lat?: number;
  lng?: number;
  weatherEvents?: ExtremeWeatherEvent[];
  roadRisk?: RoadRiskAssessment | null;
  settings?: Partial<GenericDeliverySettings>;
}

export interface GenericDeliveryRecommendation {
  urgencyLevel: UrgencyLevel;
  orderByDate: Date;
  reason: string;
  litersNeeded: number;
  daysOfBuffer: number;
  weatherContext: string | null;
  calculationDetails: {
    currentLevelPct: number;
    currentLevelLiters: number;
    targetLevelPct: number;
    targetLevelLiters: number;
    dailyConsumptionLiters: number;
    daysUntilLow: number;
    weatherImpact: string | null;
  };
}

// Default settings
const DEFAULT_SETTINGS: GenericDeliverySettings = {
  leadTimeDays: 3,
  targetLevelPct: 70,
  lowLevelPct: 20,
};

// Urgency thresholds (days of buffer)
const URGENCY_THRESHOLDS = {
  critical: 0,
  warning: 3,
  normal: 7,
};

/**
 * Calculate generic delivery recommendation for mining/general customers
 */
export function calculateGenericRecommendation(
  input: GenericRecommendationInput
): GenericDeliveryRecommendation {
  const settings: GenericDeliverySettings = {
    ...DEFAULT_SETTINGS,
    ...input.settings,
  };

  const today = startOfDay(new Date());
  const {
    currentLevelPct,
    currentLevelLiters,
    capacityLiters,
    dailyConsumptionLiters,
    industryType,
    lat,
    lng,
    weatherEvents = [],
    roadRisk,
  } = input;

  // Region-aware checks - only show weather alerts where they matter
  const regionShowsWeatherAlerts = shouldShowWeatherDeliveryAlerts(lat, lng);
  const regionHasRoadRisk = regionHasRoadClosureRisk(lat, lng);

  // Calculate target and low levels
  const targetLevelLiters = (settings.targetLevelPct / 100) * capacityLiters;
  const lowLevelLiters = (settings.lowLevelPct / 100) * capacityLiters;
  const litersToTarget = Math.max(0, targetLevelLiters - currentLevelLiters);
  const litersAboveLow = currentLevelLiters - lowLevelLiters;

  // Days until we hit low level at current consumption
  const daysToLow = dailyConsumptionLiters > 0
    ? Math.floor(litersAboveLow / dailyConsumptionLiters)
    : 365;

  // Base order-by date without weather consideration
  let orderByDate = addDays(today, Math.max(0, daysToLow - settings.leadTimeDays));
  let weatherContext: string | null = null;
  let weatherImpact: string | null = null;

  // Check for weather events that should affect ordering
  // Only consider weather if this region cares about weather-based delivery alerts
  const relevantWeatherEvent = regionShowsWeatherAlerts
    ? findRelevantWeatherEvent(weatherEvents, orderByDate, industryType)
    : null;
  const hasRoadClosureRisk = roadRisk && roadRisk.riskLevel !== 'low';

  // Mining: Consider road closure risk ONLY for regions where road closures are a real concern
  // (Kalgoorlie, Pilbara - NOT Perth, Geraldton, Wheatbelt farms)
  if (industryType === 'mining' && regionHasRoadRisk && hasRoadClosureRisk && roadRisk) {
    const closureDate = roadRisk.estimatedClosureDate;

    if (closureDate && isBefore(closureDate, orderByDate)) {
      // Road will close before we need to order - order sooner!
      const orderBeforeClosure = addDays(closureDate, -1);
      if (isBefore(orderBeforeClosure, orderByDate)) {
        orderByDate = orderBeforeClosure;
        weatherContext = `Road closure expected ${format(closureDate, 'MMM d')}. Order before access is lost.`;
        weatherImpact = 'road_closure';
      }
    }
  }

  // Check for severe weather events
  if (relevantWeatherEvent) {
    const eventOrderBy = addDays(relevantWeatherEvent.startDate, -settings.leadTimeDays);

    if (isBefore(eventOrderBy, orderByDate)) {
      orderByDate = eventOrderBy;

      switch (relevantWeatherEvent.type) {
        case 'cyclone':
          weatherContext = `Cyclone expected ${format(relevantWeatherEvent.startDate, 'MMM d')}. Order before site closure.`;
          weatherImpact = 'cyclone';
          break;
        case 'storm':
          weatherContext = `Storm conditions expected ${format(relevantWeatherEvent.startDate, 'MMM d')}. Consider scheduling delivery beforehand.`;
          weatherImpact = 'storm';
          break;
        case 'heavy_rain':
          weatherContext = industryType === 'mining'
            ? `Heavy rain (${relevantWeatherEvent.peakValue.toFixed(0)}mm) forecast. May affect access roads.`
            : `Heavy rain forecast ${format(relevantWeatherEvent.startDate, 'MMM d')}. May affect deliveries.`;
          weatherImpact = 'heavy_rain';
          break;
        case 'extreme_heat':
          // Heat doesn't require ordering sooner, but note the consumption impact
          weatherContext = `Extreme heat (${relevantWeatherEvent.peakValue.toFixed(0)}°C) expected. Consumption may increase.`;
          weatherImpact = 'extreme_heat';
          break;
      }
    }
  }

  // Calculate buffer days
  const daysOfBuffer = differenceInDays(orderByDate, today);

  // Determine urgency
  const urgencyLevel = calculateGenericUrgency(daysOfBuffer);

  // Generate reason
  let reason: string;
  if (weatherContext) {
    reason = weatherContext;
  } else if (daysOfBuffer <= 0) {
    reason = 'Tank level is low. Consider ordering fuel soon.';
  } else {
    reason = `Based on current usage (${dailyConsumptionLiters.toFixed(0)}L/day), ordering by ${format(orderByDate, 'MMM d')} would maintain comfortable levels.`;
  }

  return {
    urgencyLevel,
    orderByDate,
    reason,
    litersNeeded: Math.round(litersToTarget),
    daysOfBuffer,
    weatherContext,
    calculationDetails: {
      currentLevelPct,
      currentLevelLiters,
      targetLevelPct: settings.targetLevelPct,
      targetLevelLiters,
      dailyConsumptionLiters,
      daysUntilLow: daysToLow,
      weatherImpact,
    },
  };
}

/**
 * Find relevant weather event that should affect ordering
 */
function findRelevantWeatherEvent(
  events: ExtremeWeatherEvent[],
  orderByDate: Date,
  industryType: IndustryType
): ExtremeWeatherEvent | null {
  const now = new Date();
  const lookAheadDays = 14;
  const cutoffDate = addDays(now, lookAheadDays);

  // Priority: cyclone > storm > heavy_rain > extreme_heat
  const priority: Record<string, number> = {
    cyclone: 1,
    storm: 2,
    heavy_rain: 3,
    extreme_heat: 4,
  };

  const relevant = events
    .filter((e) => {
      // Event must be within our look-ahead window
      if (e.startDate > cutoffDate) return false;

      // For mining: all event types are relevant
      if (industryType === 'mining') return true;

      // For general: storms and heavy rain are relevant
      return ['storm', 'heavy_rain'].includes(e.type);
    })
    .sort((a, b) => {
      // Sort by priority, then by start date
      const priorityDiff = (priority[a.type] || 99) - (priority[b.type] || 99);
      if (priorityDiff !== 0) return priorityDiff;
      return a.startDate.getTime() - b.startDate.getTime();
    });

  return relevant[0] || null;
}

/**
 * Calculate urgency level
 */
export function calculateGenericUrgency(daysOfBuffer: number): UrgencyLevel {
  if (daysOfBuffer < URGENCY_THRESHOLDS.critical) return 'critical';
  if (daysOfBuffer < URGENCY_THRESHOLDS.warning) return 'warning';
  if (daysOfBuffer < URGENCY_THRESHOLDS.normal) return 'normal';
  return 'good';
}

/**
 * Get gentle urgency label for UI (non-alarming)
 */
export function getGenericUrgencyLabel(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'critical':
      return 'Action Recommended';
    case 'warning':
      return 'Plan Ahead';
    case 'normal':
      return 'Suggestion';
    case 'good':
      return 'All Good';
  }
}

/**
 * Get urgency styling for UI (gentle colors)
 */
export function getGenericUrgencyStyle(urgency: UrgencyLevel): {
  bg: string;
  border: string;
  text: string;
  badgeBg: string;
  badgeText: string;
} {
  switch (urgency) {
    case 'critical':
      return {
        bg: 'bg-amber-50/80 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-700',
        text: 'text-amber-800 dark:text-amber-200',
        badgeBg: 'bg-amber-100 dark:bg-amber-900/40',
        badgeText: 'text-amber-700 dark:text-amber-300',
      };
    case 'warning':
      return {
        bg: 'bg-blue-50/60 dark:bg-blue-900/15',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-800 dark:text-blue-200',
        badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
        badgeText: 'text-blue-700 dark:text-blue-300',
      };
    case 'normal':
    default:
      return {
        bg: 'bg-gray-50/60 dark:bg-gray-800/30',
        border: 'border-gray-200 dark:border-gray-700',
        text: 'text-gray-700 dark:text-gray-300',
        badgeBg: 'bg-gray-100 dark:bg-gray-800',
        badgeText: 'text-gray-600 dark:text-gray-400',
      };
  }
}

// Export service
export const genericDeliveryRecommender = {
  calculateGenericRecommendation,
  calculateGenericUrgency,
  getGenericUrgencyLabel,
  getGenericUrgencyStyle,
};

export default genericDeliveryRecommender;
