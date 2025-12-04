import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  RefillPrediction,
  calculateUrgency,
  calculatePredictedRefillDate,
  determineConfidence,
  groupByRefillDate,
} from '@/lib/urgency-calculator';
import { useCustomerTanks } from './useCustomerAuth';

/**
 * Hook to get refill calendar predictions for all AgBot tanks
 * Used by GSF fleet-wide calendar
 */
export function useFleetRefillCalendar() {
  return useQuery<RefillPrediction[]>({
    queryKey: ['fleet-refill-calendar'],
    queryFn: async () => {
      // Fetch all active AgBot locations with their assets
      const { data: locations, error } = await supabase
        .from('ta_agbot_locations')
        .select(`
          id,
          external_guid,
          customer_name,
          name,
          address,
          state,
          calibrated_fill_level,
          is_disabled,
          ta_agbot_assets (
            id,
            serial_number,
            is_online,
            days_remaining,
            daily_consumption_liters,
            capacity_liters
          )
        `)
        .eq('is_disabled', false)
        .order('customer_name');

      if (error) {
        console.error('Error fetching fleet data:', error);
        return [];
      }

      // Transform to RefillPrediction format (map new column names)
      return (locations || []).map((loc) => {
        const asset = Array.isArray(loc.ta_agbot_assets) && loc.ta_agbot_assets[0];
        const daysRemaining = asset?.days_remaining ?? null;
        const dailyConsumption = asset?.daily_consumption_liters ?? null;
        const deviceOnline = asset?.is_online ?? false;

        return {
          tankId: loc.id,
          tankName: loc.name || loc.address || 'Unknown',
          customerName: loc.customer_name || 'Unknown Customer',
          locationId: loc.name || '',
          address: [loc.address, loc.state].filter(Boolean).join(', '),
          currentLevel: loc.calibrated_fill_level || 0,
          daysRemaining,
          predictedRefillDate: calculatePredictedRefillDate(daysRemaining),
          urgency: calculateUrgency(daysRemaining),
          confidence: determineConfidence(daysRemaining, dailyConsumption, deviceOnline),
          dailyConsumption,
          capacity: asset?.capacity_liters ?? null,
          deviceOnline,
        } as RefillPrediction;
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to get refill calendar predictions for customer's tanks only
 * Used by customer portal calendar
 */
export function useCustomerRefillCalendar() {
  const { data: customerTanks, isLoading: tanksLoading } = useCustomerTanks();

  return useQuery<RefillPrediction[]>({
    queryKey: ['customer-refill-calendar', customerTanks?.map(t => t.id).join(',')],
    queryFn: async () => {
      if (!customerTanks || customerTanks.length === 0) {
        return [];
      }

      // Transform customer tanks to RefillPrediction format
      return customerTanks.map((tank) => {
        const daysRemaining = tank.asset_days_remaining ?? null;
        const dailyConsumption = tank.asset_daily_consumption ?? null;
        const deviceOnline = tank.device_online ?? false;

        return {
          tankId: tank.id,
          tankName: tank.location_id || tank.address1 || 'Unknown',
          customerName: tank.customer_name || 'My Tank',
          locationId: tank.location_id || '',
          address: [tank.address1, tank.address2, tank.state].filter(Boolean).join(', '),
          currentLevel: tank.latest_calibrated_fill_percentage || 0,
          daysRemaining,
          predictedRefillDate: calculatePredictedRefillDate(daysRemaining),
          urgency: calculateUrgency(daysRemaining),
          confidence: determineConfidence(daysRemaining, dailyConsumption, deviceOnline),
          dailyConsumption,
          capacity: tank.asset_profile_water_capacity ?? null,
          deviceOnline,
        } as RefillPrediction;
      });
    },
    enabled: !tanksLoading && !!customerTanks,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to get calendar events grouped by date
 */
export function useRefillCalendarEvents(predictions: RefillPrediction[] | undefined) {
  return useQuery({
    queryKey: ['refill-calendar-events', predictions?.length],
    queryFn: () => {
      if (!predictions) return new Map();
      return groupByRefillDate(predictions);
    },
    enabled: !!predictions,
    staleTime: Infinity, // Derived data, doesn't need refetch
  });
}

/**
 * Get tanks needing refill this week
 */
export function getTanksNeedingRefillThisWeek(predictions: RefillPrediction[]): RefillPrediction[] {
  const today = new Date();
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return predictions.filter((p) => {
    if (!p.predictedRefillDate) return false;
    return p.predictedRefillDate >= today && p.predictedRefillDate <= weekEnd;
  });
}

/**
 * Get tanks by urgency level
 */
export function filterByUrgency(
  predictions: RefillPrediction[],
  urgency: 'critical' | 'warning' | 'normal' | 'unknown'
): RefillPrediction[] {
  return predictions.filter((p) => p.urgency === urgency);
}

/**
 * Get tanks by customer
 */
export function filterByCustomer(
  predictions: RefillPrediction[],
  customerName: string
): RefillPrediction[] {
  return predictions.filter(
    (p) => p.customerName.toLowerCase().includes(customerName.toLowerCase())
  );
}

/**
 * Get unique customers from predictions
 */
export function getUniqueCustomers(predictions: RefillPrediction[]): string[] {
  const customers = new Set(predictions.map((p) => p.customerName));
  return Array.from(customers).sort();
}
