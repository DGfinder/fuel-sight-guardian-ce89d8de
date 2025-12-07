/**
 * Cost Tracking Hook
 *
 * Fuel cost tracking and projections for all industry types.
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  costTrackerService,
  type CostProjection,
  type BudgetSummary,
  type CustomerBudget,
  type ConsumptionData,
} from '@/services/cost-tracker';
import { useCustomerAccount, type CustomerTank } from './useCustomerAuth';
import { useCustomerFeatures } from './useCustomerFeatures';

export interface CostTrackingResult {
  projection: CostProjection | null;
  budgetSummary: BudgetSummary | null;
  budget: CustomerBudget | null;
  pricePerLiter: number;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to get cost tracking data for a customer
 */
export function useCostTracking(
  tanks: CustomerTank[],
  pricePerLiterOverride?: number
): CostTrackingResult {
  const { data: customerAccount } = useCustomerAccount();
  const { costTracking } = useCustomerFeatures();

  // Fetch customer preferences for fuel price
  const { data: preferences } = useQuery({
    queryKey: ['customer-preferences', customerAccount?.id],
    queryFn: async () => {
      if (!customerAccount?.id) return null;

      const { data, error } = await supabase
        .from('customer_account_preferences')
        .select('default_fuel_price_per_liter, fuel_cost_tracking_enabled')
        .eq('customer_account_id', customerAccount.id)
        .single();

      if (error) {
        // If no preferences exist, return defaults
        return { default_fuel_price_per_liter: 1.80, fuel_cost_tracking_enabled: true };
      }

      return data;
    },
    enabled: !!customerAccount?.id && costTracking,
  });

  // Fetch active budget
  const { data: budget, isLoading: budgetLoading } = useQuery({
    queryKey: ['customer-budget', customerAccount?.id],
    queryFn: async () => {
      if (!customerAccount?.id) return null;

      const { data, error } = await supabase
        .from('customer_budgets')
        .select('*')
        .eq('customer_account_id', customerAccount.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        // No budget set - this is fine
        return null;
      }

      return {
        id: data.id,
        budgetPeriod: data.budget_period,
        budgetAmount: data.budget_amount,
        fuelPricePerLiter: data.fuel_price_per_liter,
        startDate: new Date(data.start_date),
        isActive: data.is_active,
      } as CustomerBudget;
    },
    enabled: !!customerAccount?.id && costTracking,
  });

  // Fetch consumption history for cost projection
  const { data: consumptionHistory, isLoading: consumptionLoading } = useQuery({
    queryKey: ['consumption-history-cost', tanks.map((t) => t.asset_id).join(',')],
    queryFn: async () => {
      if (tanks.length === 0) return [];

      const assetIds = tanks.map((t) => t.asset_id).filter(Boolean);
      if (assetIds.length === 0) return [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('ta_agbot_readings')
        .select('reading_at, level_liters, asset_id')
        .in('asset_id', assetIds)
        .gte('reading_at', thirtyDaysAgo.toISOString())
        .order('reading_at', { ascending: true });

      if (error) throw error;

      // Process readings into daily consumption
      const dailyConsumption = processDailyConsumption(data || []);
      return dailyConsumption;
    },
    enabled: tanks.length > 0 && costTracking,
    staleTime: 1000 * 60 * 15, // 15 minutes
  });

  // Calculate price per liter
  const pricePerLiter =
    pricePerLiterOverride ||
    budget?.fuelPricePerLiter ||
    preferences?.default_fuel_price_per_liter ||
    costTrackerService.DEFAULT_FUEL_PRICES.default;

  // Calculate projection
  const { data: projectionData, isLoading: projectionLoading } = useQuery({
    queryKey: ['cost-projection', consumptionHistory?.length, pricePerLiter, budget?.budgetPeriod],
    queryFn: async () => {
      if (!consumptionHistory || consumptionHistory.length === 0) {
        return { projection: null, budgetSummary: null };
      }

      const periodType = budget?.budgetPeriod || 'monthly';
      const projection = costTrackerService.calculateCostProjection(
        consumptionHistory,
        pricePerLiter,
        periodType
      );

      const budgetSummary = costTrackerService.calculateBudgetStatus(projection, budget || null);

      return { projection, budgetSummary };
    },
    enabled: !!consumptionHistory && consumptionHistory.length > 0 && costTracking,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isLoading = budgetLoading || consumptionLoading || projectionLoading;

  return {
    projection: projectionData?.projection || null,
    budgetSummary: projectionData?.budgetSummary || null,
    budget: budget || null,
    pricePerLiter,
    isLoading,
    error: null,
  };
}

/**
 * Process raw readings into daily consumption data
 */
function processDailyConsumption(
  readings: Array<{ reading_at: string; level_liters: number | null; asset_id: string }>
): ConsumptionData[] {
  // Group readings by date
  const byDate = new Map<string, number[]>();

  for (const reading of readings) {
    if (reading.level_liters === null) continue;

    const date = new Date(reading.reading_at).toISOString().split('T')[0];

    if (!byDate.has(date)) {
      byDate.set(date, []);
    }
    byDate.get(date)!.push(reading.level_liters);
  }

  // Calculate daily consumption (difference between max and min for each day)
  const result: ConsumptionData[] = [];
  const sortedDates = Array.from(byDate.keys()).sort();

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = sortedDates[i - 1];
    const currDate = sortedDates[i];

    const prevLevels = byDate.get(prevDate)!;
    const currLevels = byDate.get(currDate)!;

    // Get end of previous day and start of current day
    const prevEnd = Math.min(...prevLevels);
    const currEnd = Math.min(...currLevels);

    // Consumption = decrease in level (ignore refills)
    const consumption = prevEnd > currEnd ? prevEnd - currEnd : 0;

    if (consumption > 0) {
      result.push({
        date: new Date(currDate),
        litersConsumed: consumption,
      });
    }
  }

  return result;
}

/**
 * Hook to set/update a budget
 */
export function useSetBudget() {
  // This would typically be a mutation
  return {
    setBudget: async (budget: Omit<CustomerBudget, 'id' | 'isActive'>) => {
      // TODO: Implement budget setting
      console.log('Set budget:', budget);
    },
  };
}

export default useCostTracking;
