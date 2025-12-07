/**
 * Cost Tracker Service
 *
 * Fuel cost tracking and projections for all industry types:
 * - Weekly/monthly cost estimates
 * - Budget tracking and variance
 * - Cost trend analysis
 */

import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInDays, addDays } from 'date-fns';

export type BudgetPeriod = 'weekly' | 'monthly' | 'quarterly';
export type BudgetStatus = 'on_track' | 'at_risk' | 'over_budget' | 'no_budget';
export type CostTrend = 'up' | 'down' | 'stable';

export interface CostProjection {
  periodType: BudgetPeriod;
  periodStart: Date;
  periodEnd: Date;
  daysInPeriod: number;
  daysElapsed: number;
  daysRemaining: number;

  // Consumption
  consumptionToDate: number; // Liters consumed so far this period
  projectedConsumption: number; // Projected total for period
  dailyAverage: number; // Average L/day

  // Costs
  pricePerLiter: number;
  costToDate: number;
  projectedCost: number;

  // Trend
  trend: CostTrend;
  trendPercent: number; // vs previous period

  // Confidence
  confidence: 'high' | 'medium' | 'low';
}

export interface BudgetSummary {
  budget: CustomerBudget | null;
  status: BudgetStatus;
  budgetAmount: number | null;
  spentAmount: number;
  remainingAmount: number | null;
  projectedOverUnder: number | null; // Positive = under budget
  percentUsed: number | null;
  daysRemaining: number;
}

export interface CustomerBudget {
  id: string;
  budgetPeriod: BudgetPeriod;
  budgetAmount: number;
  fuelPricePerLiter: number | null;
  startDate: Date;
  isActive: boolean;
}

export interface ConsumptionData {
  date: Date;
  litersConsumed: number;
}

// Default fuel prices (AUD per liter)
const DEFAULT_FUEL_PRICES = {
  diesel: 1.85,
  petrol: 1.95,
  default: 1.80,
};

/**
 * Calculate cost projection for current period
 */
export function calculateCostProjection(
  consumptionHistory: ConsumptionData[],
  pricePerLiter: number = DEFAULT_FUEL_PRICES.default,
  periodType: BudgetPeriod = 'monthly',
  previousPeriodConsumption?: number
): CostProjection {
  const now = new Date();

  // Get period bounds
  const { periodStart, periodEnd } = getPeriodBounds(now, periodType);
  const daysInPeriod = differenceInDays(periodEnd, periodStart) + 1;
  const daysElapsed = Math.min(differenceInDays(now, periodStart) + 1, daysInPeriod);
  const daysRemaining = daysInPeriod - daysElapsed;

  // Filter consumption to current period
  const periodConsumption = consumptionHistory.filter(
    (c) => c.date >= periodStart && c.date <= now
  );

  // Calculate totals
  const consumptionToDate = periodConsumption.reduce((sum, c) => sum + c.litersConsumed, 0);
  const dailyAverage = daysElapsed > 0 ? consumptionToDate / daysElapsed : 0;
  const projectedConsumption = dailyAverage * daysInPeriod;

  // Calculate costs
  const costToDate = consumptionToDate * pricePerLiter;
  const projectedCost = projectedConsumption * pricePerLiter;

  // Calculate trend vs previous period
  let trend: CostTrend = 'stable';
  let trendPercent = 0;

  if (previousPeriodConsumption && previousPeriodConsumption > 0) {
    const previousDailyAvg = previousPeriodConsumption / daysInPeriod;
    trendPercent = ((dailyAverage - previousDailyAvg) / previousDailyAvg) * 100;

    if (trendPercent > 10) {
      trend = 'up';
    } else if (trendPercent < -10) {
      trend = 'down';
    }
  }

  // Determine confidence
  let confidence: CostProjection['confidence'] = 'low';
  if (daysElapsed >= 14) {
    confidence = 'high';
  } else if (daysElapsed >= 7) {
    confidence = 'medium';
  }

  return {
    periodType,
    periodStart,
    periodEnd,
    daysInPeriod,
    daysElapsed,
    daysRemaining,
    consumptionToDate,
    projectedConsumption: Math.round(projectedConsumption),
    dailyAverage: Math.round(dailyAverage * 10) / 10,
    pricePerLiter,
    costToDate: Math.round(costToDate * 100) / 100,
    projectedCost: Math.round(projectedCost * 100) / 100,
    trend,
    trendPercent: Math.round(trendPercent),
    confidence,
  };
}

/**
 * Calculate budget status
 */
export function calculateBudgetStatus(
  projection: CostProjection,
  budget: CustomerBudget | null
): BudgetSummary {
  if (!budget || !budget.isActive) {
    return {
      budget: null,
      status: 'no_budget',
      budgetAmount: null,
      spentAmount: projection.costToDate,
      remainingAmount: null,
      projectedOverUnder: null,
      percentUsed: null,
      daysRemaining: projection.daysRemaining,
    };
  }

  const spentAmount = projection.costToDate;
  const remainingAmount = budget.budgetAmount - spentAmount;
  const projectedOverUnder = budget.budgetAmount - projection.projectedCost;
  const percentUsed = (spentAmount / budget.budgetAmount) * 100;

  // Determine status
  let status: BudgetStatus = 'on_track';

  if (spentAmount >= budget.budgetAmount) {
    status = 'over_budget';
  } else if (projectedOverUnder < 0) {
    // Projected to go over budget
    status = 'at_risk';
  } else if (percentUsed > (projection.daysElapsed / projection.daysInPeriod) * 100 * 1.1) {
    // Spending faster than days elapsed (>10% ahead)
    status = 'at_risk';
  }

  return {
    budget,
    status,
    budgetAmount: budget.budgetAmount,
    spentAmount: Math.round(spentAmount * 100) / 100,
    remainingAmount: Math.round(remainingAmount * 100) / 100,
    projectedOverUnder: Math.round(projectedOverUnder * 100) / 100,
    percentUsed: Math.round(percentUsed * 10) / 10,
    daysRemaining: projection.daysRemaining,
  };
}

/**
 * Get period bounds based on period type
 */
export function getPeriodBounds(
  date: Date,
  periodType: BudgetPeriod
): { periodStart: Date; periodEnd: Date } {
  switch (periodType) {
    case 'weekly':
      return {
        periodStart: startOfWeek(date, { weekStartsOn: 1 }), // Monday
        periodEnd: endOfWeek(date, { weekStartsOn: 1 }),
      };
    case 'monthly':
      return {
        periodStart: startOfMonth(date),
        periodEnd: endOfMonth(date),
      };
    case 'quarterly':
      const quarter = Math.floor(date.getMonth() / 3);
      const quarterStart = new Date(date.getFullYear(), quarter * 3, 1);
      const quarterEnd = new Date(date.getFullYear(), quarter * 3 + 3, 0);
      return {
        periodStart: quarterStart,
        periodEnd: quarterEnd,
      };
    default:
      return {
        periodStart: startOfMonth(date),
        periodEnd: endOfMonth(date),
      };
  }
}

/**
 * Format cost for display
 */
export function formatCost(amount: number, currency: string = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Get budget status message
 */
export function getBudgetStatusMessage(summary: BudgetSummary): {
  message: string;
  severity: 'success' | 'warning' | 'error' | 'info';
} {
  switch (summary.status) {
    case 'on_track':
      return {
        message: `On track - ${formatCost(summary.remainingAmount!)} remaining`,
        severity: 'success',
      };
    case 'at_risk':
      return {
        message: `At risk of exceeding budget by ${formatCost(Math.abs(summary.projectedOverUnder!))}`,
        severity: 'warning',
      };
    case 'over_budget':
      return {
        message: `Over budget by ${formatCost(Math.abs(summary.remainingAmount!))}`,
        severity: 'error',
      };
    case 'no_budget':
    default:
      return {
        message: 'No budget set',
        severity: 'info',
      };
  }
}

/**
 * Calculate cost efficiency metrics
 */
export function calculateEfficiencyMetrics(
  currentProjection: CostProjection,
  previousPeriodData?: { consumption: number; cost: number }
): {
  costPerLiter: number;
  litersPerDay: number;
  costPerDay: number;
  vsLastPeriod: {
    costChange: number;
    consumptionChange: number;
  } | null;
} {
  const costPerLiter = currentProjection.pricePerLiter;
  const litersPerDay = currentProjection.dailyAverage;
  const costPerDay = litersPerDay * costPerLiter;

  let vsLastPeriod = null;
  if (previousPeriodData && previousPeriodData.consumption > 0) {
    const prevDailyConsumption = previousPeriodData.consumption / currentProjection.daysInPeriod;
    const prevDailyCost = prevDailyConsumption * costPerLiter;

    vsLastPeriod = {
      costChange: ((costPerDay - prevDailyCost) / prevDailyCost) * 100,
      consumptionChange: ((litersPerDay - prevDailyConsumption) / prevDailyConsumption) * 100,
    };
  }

  return {
    costPerLiter,
    litersPerDay: Math.round(litersPerDay * 10) / 10,
    costPerDay: Math.round(costPerDay * 100) / 100,
    vsLastPeriod: vsLastPeriod
      ? {
          costChange: Math.round(vsLastPeriod.costChange),
          consumptionChange: Math.round(vsLastPeriod.consumptionChange),
        }
      : null,
  };
}

// Export service
export const costTrackerService = {
  calculateCostProjection,
  calculateBudgetStatus,
  getPeriodBounds,
  formatCost,
  getBudgetStatusMessage,
  calculateEfficiencyMetrics,
  DEFAULT_FUEL_PRICES,
};

export default costTrackerService;
