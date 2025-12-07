/**
 * Delivery Recommender Service
 *
 * Calculates proactive delivery recommendations for farmers based on:
 * - Current tank level and consumption rate
 * - Upcoming predicted operations (harvest, seeding, spraying)
 * - Delivery lead time requirements
 * - Target tank level before operations
 *
 * Generates urgency-based recommendations with clear order-by dates.
 */

import { addDays, differenceInDays, format, isAfter, isBefore, startOfDay } from 'date-fns';

// Types
export type UrgencyLevel = 'critical' | 'warning' | 'normal' | 'good';

export interface UpcomingOperation {
  type: 'harvest' | 'seeding' | 'spraying' | 'livestock';
  startDate: Date;
  expectedDurationDays: number;
  expectedMultiplier: number;
  expectedDailyUsage: number; // liters
}

export interface DeliverySettings {
  leadTimeDays: number;
  targetLevelPct: number;
  spikeThresholdMultiplier: number;
}

export interface RecommendationInput {
  currentLevelPct: number;
  currentLevelLiters: number;
  capacityLiters: number;
  dailyConsumptionLiters: number;
  upcomingOperations: UpcomingOperation[];
  settings: DeliverySettings;
}

export interface DeliveryRecommendation {
  urgencyLevel: UrgencyLevel;
  orderByDate: Date;
  reason: string;
  litersNeeded: number;
  daysOfBuffer: number;
  operationType: string | null;
  operationStartDate: Date | null;
  calculationDetails: {
    currentLevelPct: number;
    currentLevelLiters: number;
    targetLevelPct: number;
    targetLevelLiters: number;
    dailyConsumptionLiters: number;
    operationConsumptionLiters: number | null;
    totalLitersNeeded: number;
    daysUntilEmpty: number;
    daysUntilOperation: number | null;
  };
}

// Default settings
const DEFAULT_SETTINGS: DeliverySettings = {
  leadTimeDays: 3,
  targetLevelPct: 70,
  spikeThresholdMultiplier: 2.0,
};

// Urgency thresholds (days of buffer)
const URGENCY_THRESHOLDS = {
  critical: 0, // Already past order date
  warning: 3, // Less than 3 days buffer
  normal: 7, // Less than 7 days buffer
  // 'good' = 7+ days buffer
};

/**
 * Calculate delivery recommendation based on current state and upcoming operations
 */
export function calculateRecommendation(
  input: RecommendationInput
): DeliveryRecommendation {
  const settings = { ...DEFAULT_SETTINGS, ...input.settings };
  const today = startOfDay(new Date());

  const {
    currentLevelPct,
    currentLevelLiters,
    capacityLiters,
    dailyConsumptionLiters,
    upcomingOperations,
  } = input;

  // Calculate target level
  const targetLevelLiters = (settings.targetLevelPct / 100) * capacityLiters;
  const litersToTarget = Math.max(0, targetLevelLiters - currentLevelLiters);

  // Find the nearest upcoming operation (within 14 days)
  const nearestOperation = findNearestOperation(upcomingOperations, today, 14);

  let orderByDate: Date;
  let reason: string;
  let operationConsumptionLiters: number | null = null;
  let daysUntilOperation: number | null = null;

  if (nearestOperation) {
    // Operation-based recommendation
    daysUntilOperation = differenceInDays(nearestOperation.startDate, today);

    // Calculate fuel needed during operation
    operationConsumptionLiters =
      nearestOperation.expectedDailyUsage * nearestOperation.expectedDurationDays;

    // Order-by date: operation start - lead time
    // But also ensure we don't run out before operation
    const operationOrderBy = addDays(nearestOperation.startDate, -settings.leadTimeDays);

    // Days until we'd hit low level (20%) at current consumption
    const lowLevelLiters = capacityLiters * 0.2;
    const litersAboveLow = currentLevelLiters - lowLevelLiters;
    const daysToLow = dailyConsumptionLiters > 0
      ? Math.floor(litersAboveLow / dailyConsumptionLiters)
      : 365;
    const lowLevelOrderBy = addDays(today, daysToLow - settings.leadTimeDays);

    // Use the earlier of the two dates
    orderByDate = isBefore(lowLevelOrderBy, operationOrderBy) ? lowLevelOrderBy : operationOrderBy;

    // Format reason
    const operationName = capitalize(nearestOperation.type);
    const operationDateStr = format(nearestOperation.startDate, 'MMM d');
    reason = `${operationName} starting ${operationDateStr}. Order by ${format(orderByDate, 'MMM d')} to ensure ${settings.targetLevelPct}% tank level.`;
  } else {
    // No upcoming operation - simple calculation based on consumption
    const lowLevelLiters = capacityLiters * 0.2;
    const litersAboveLow = currentLevelLiters - lowLevelLiters;
    const daysToLow = dailyConsumptionLiters > 0
      ? Math.floor(litersAboveLow / dailyConsumptionLiters)
      : 365;

    orderByDate = addDays(today, Math.max(0, daysToLow - settings.leadTimeDays));
    reason = `Based on current usage (${dailyConsumptionLiters.toFixed(0)}L/day), order by ${format(orderByDate, 'MMM d')} to maintain safe levels.`;
  }

  // Calculate buffer days
  const daysOfBuffer = differenceInDays(orderByDate, today);

  // Determine urgency
  const urgencyLevel = calculateUrgency(daysOfBuffer);

  // Calculate total liters needed
  const totalLitersNeeded = operationConsumptionLiters
    ? litersToTarget + operationConsumptionLiters
    : litersToTarget;

  // Days until empty at current consumption
  const daysUntilEmpty = dailyConsumptionLiters > 0
    ? Math.floor(currentLevelLiters / dailyConsumptionLiters)
    : 365;

  return {
    urgencyLevel,
    orderByDate,
    reason,
    litersNeeded: Math.round(totalLitersNeeded),
    daysOfBuffer,
    operationType: nearestOperation?.type || null,
    operationStartDate: nearestOperation?.startDate || null,
    calculationDetails: {
      currentLevelPct,
      currentLevelLiters,
      targetLevelPct: settings.targetLevelPct,
      targetLevelLiters,
      dailyConsumptionLiters,
      operationConsumptionLiters,
      totalLitersNeeded,
      daysUntilEmpty,
      daysUntilOperation,
    },
  };
}

/**
 * Find the nearest upcoming operation within a given window
 */
function findNearestOperation(
  operations: UpcomingOperation[],
  today: Date,
  windowDays: number
): UpcomingOperation | null {
  const windowEnd = addDays(today, windowDays);

  const upcoming = operations
    .filter((op) => {
      const opDate = startOfDay(op.startDate);
      return isAfter(opDate, today) && isBefore(opDate, windowEnd);
    })
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  return upcoming[0] || null;
}

/**
 * Calculate urgency level based on buffer days
 */
export function calculateUrgency(daysOfBuffer: number): UrgencyLevel {
  if (daysOfBuffer < URGENCY_THRESHOLDS.critical) return 'critical';
  if (daysOfBuffer < URGENCY_THRESHOLDS.warning) return 'warning';
  if (daysOfBuffer < URGENCY_THRESHOLDS.normal) return 'normal';
  return 'good';
}

/**
 * Get urgency color for UI
 */
export function getUrgencyColor(urgency: UrgencyLevel): {
  bg: string;
  text: string;
  border: string;
} {
  switch (urgency) {
    case 'critical':
      return {
        bg: 'bg-red-100 dark:bg-red-950/40',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
      };
    case 'warning':
      return {
        bg: 'bg-orange-100 dark:bg-orange-950/40',
        text: 'text-orange-700 dark:text-orange-400',
        border: 'border-orange-200 dark:border-orange-800',
      };
    case 'normal':
      return {
        bg: 'bg-blue-100 dark:bg-blue-950/40',
        text: 'text-blue-700 dark:text-blue-400',
        border: 'border-blue-200 dark:border-blue-800',
      };
    case 'good':
    default:
      return {
        bg: 'bg-green-100 dark:bg-green-950/40',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-200 dark:border-green-800',
      };
  }
}

/**
 * Get urgency label for UI
 */
export function getUrgencyLabel(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'critical':
      return 'Order Now';
    case 'warning':
      return 'Order Soon';
    case 'normal':
      return 'Plan Ahead';
    case 'good':
      return 'All Good';
  }
}

/**
 * Get urgency icon name (for lucide-react)
 */
export function getUrgencyIconName(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'critical':
      return 'AlertCircle';
    case 'warning':
      return 'AlertTriangle';
    case 'normal':
      return 'Clock';
    case 'good':
      return 'CheckCircle';
  }
}

/**
 * Convert operations from weather predictor to our format
 */
export function convertPredictedOperations(
  operations: Array<{
    operation: string;
    startDate: Date;
    endDate: Date;
    fuelImpact: {
      expectedMultiplier: number;
      estimatedDailyUsage: number;
    };
  }>
): UpcomingOperation[] {
  return operations.map((op) => ({
    type: op.operation as UpcomingOperation['type'],
    startDate: op.startDate,
    expectedDurationDays: Math.max(1, differenceInDays(op.endDate, op.startDate)),
    expectedMultiplier: op.fuelImpact.expectedMultiplier,
    expectedDailyUsage: op.fuelImpact.estimatedDailyUsage,
  }));
}

/**
 * Helper: Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Export singleton
export const deliveryRecommender = {
  calculateRecommendation,
  calculateUrgency,
  getUrgencyColor,
  getUrgencyLabel,
  getUrgencyIconName,
  convertPredictedOperations,
};

export default deliveryRecommender;
