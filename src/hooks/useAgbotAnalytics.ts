import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { 
  AgbotAnalytics, 
  AgbotReading,
  calculateRollingAverage,
  calculatePreviousDayConsumption,
  calculateDaysToCritical,
  calculateConsumptionVelocity,
  calculateDataReliabilityScore,
  calculateEfficiencyScore,
  analyzeRefillPattern,
  analyzeWeeklyPattern,
  determineConsumptionTrend,
  generateAlerts
} from '@/utils/agbotAnalytics';
import { AgbotLocation } from '@/services/agbot-api';

// Enhanced AgbotLocation with analytics
export interface AgbotLocationWithAnalytics extends AgbotLocation {
  analytics: AgbotAnalytics;
}

// Hook to get historical readings for an asset
export const useAgbotReadingsHistory = (assetId: string, days: number = 30) => {
  return useQuery({
    queryKey: ['agbot-readings-history', assetId, days],
    queryFn: async (): Promise<AgbotReading[]> => {
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      
      const { data, error } = await supabase
        .from('agbot_readings_history')
        .select('calibrated_fill_percentage, raw_fill_percentage, reading_timestamp, device_online, created_at')
        .eq('asset_id', assetId)
        .gte('reading_timestamp', daysAgo.toISOString())
        .order('reading_timestamp', { ascending: true });
      
      if (error) {
        console.error('Error fetching agbot readings history:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!assetId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Hook to calculate analytics for a specific agbot location
export const useAgbotLocationAnalytics = (location: AgbotLocation | null) => {
  const mainAsset = location?.assets?.[0];
  const assetId = mainAsset?.asset_guid;
  
  const { data: readings, isLoading, error } = useAgbotReadingsHistory(assetId || '', 30);
  
  return useQuery({
    queryKey: ['agbot-location-analytics', location?.id, readings],
    queryFn: async (): Promise<AgbotAnalytics> => {
      if (!readings || readings.length < 2 || !location) {
        // Return default analytics for insufficient data
        return {
          rolling_avg_pct_per_day: 0,
          prev_day_pct_used: 0,
          days_to_critical_level: null,
          consumption_velocity: 0,
          efficiency_score: 100,
          data_reliability_score: 0,
          last_refill_date: null,
          refill_frequency_days: null,
          predicted_next_refill: null,
          daily_avg_consumption: 0,
          weekly_pattern: new Array(7).fill(0),
          consumption_trend: 'stable',
          unusual_consumption_alert: false,
          potential_leak_alert: false,
          device_connectivity_alert: true
        };
      }
      
      // Calculate core metrics
      const rolling_avg_pct_per_day = calculateRollingAverage(readings);
      const prev_day_pct_used = calculatePreviousDayConsumption(readings);
      const days_to_critical_level = calculateDaysToCritical(
        location.latest_calibrated_fill_percentage || 0,
        rolling_avg_pct_per_day,
        20 // Critical threshold at 20%
      );
      
      // Calculate advanced metrics
      const consumption_velocity = calculateConsumptionVelocity(readings);
      const data_reliability_score = calculateDataReliabilityScore(readings);
      const efficiency_score = calculateEfficiencyScore(rolling_avg_pct_per_day, 2.0); // 2% per day baseline
      
      // Analyze refill patterns
      const refillAnalysis = analyzeRefillPattern(readings);
      const predicted_next_refill = refillAnalysis.lastRefillDate && refillAnalysis.refillFrequencyDays
        ? new Date(new Date(refillAnalysis.lastRefillDate).getTime() + (refillAnalysis.refillFrequencyDays * 24 * 60 * 60 * 1000)).toISOString()
        : null;
      
      // Analyze patterns
      const weekly_pattern = analyzeWeeklyPattern(readings);
      const consumption_trend = determineConsumptionTrend(readings);
      const daily_avg_consumption = rolling_avg_pct_per_day;
      
      // Generate alerts
      const partialAnalytics = {
        rolling_avg_pct_per_day,
        data_reliability_score
      };
      const alerts = generateAlerts(partialAnalytics, readings);
      
      return {
        rolling_avg_pct_per_day,
        prev_day_pct_used,
        days_to_critical_level,
        consumption_velocity,
        efficiency_score,
        data_reliability_score,
        last_refill_date: refillAnalysis.lastRefillDate,
        refill_frequency_days: refillAnalysis.refillFrequencyDays,
        predicted_next_refill,
        daily_avg_consumption,
        weekly_pattern,
        consumption_trend,
        ...alerts
      };
    },
    enabled: !!readings && readings.length >= 2 && !!location,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Hook to get analytics for all agbot locations
export const useAgbotLocationsWithAnalytics = () => {
  return useQuery({
    queryKey: ['agbot-locations-with-analytics'],
    queryFn: async (): Promise<AgbotLocationWithAnalytics[]> => {
      // First get all locations
      const { data: locations, error: locationsError } = await supabase
        .from('agbot_locations')
        .select(`
          *,
          assets:agbot_assets(*)
        `)
        .order('location_id');
      
      if (locationsError) {
        console.error('Error fetching agbot locations:', locationsError);
        throw locationsError;
      }
      
      if (!locations || locations.length === 0) {
        return [];
      }
      
      // Get analytics for each location
      const locationsWithAnalytics = await Promise.all(
        locations.map(async (location) => {
          const mainAsset = location.assets?.[0];
          if (!mainAsset) {
            // Return location with default analytics if no assets
            return {
              ...location,
              analytics: {
                rolling_avg_pct_per_day: 0,
                prev_day_pct_used: 0,
                days_to_critical_level: null,
                consumption_velocity: 0,
                efficiency_score: 100,
                data_reliability_score: 0,
                last_refill_date: null,
                refill_frequency_days: null,
                predicted_next_refill: null,
                daily_avg_consumption: 0,
                weekly_pattern: new Array(7).fill(0),
                consumption_trend: 'stable' as const,
                unusual_consumption_alert: false,
                potential_leak_alert: false,
                device_connectivity_alert: true
              }
            };
          }
          
          // Get historical readings for this asset
          const daysAgo = new Date();
          daysAgo.setDate(daysAgo.getDate() - 30);
          
          const { data: readings } = await supabase
            .from('agbot_readings_history')
            .select('calibrated_fill_percentage, raw_fill_percentage, reading_timestamp, device_online, created_at')
            .eq('asset_id', mainAsset.asset_guid)
            .gte('reading_timestamp', daysAgo.toISOString())
            .order('reading_timestamp', { ascending: true });
          
          if (!readings || readings.length < 2) {
            // Return default analytics for insufficient data
            return {
              ...location,
              analytics: {
                rolling_avg_pct_per_day: 0,
                prev_day_pct_used: 0,
                days_to_critical_level: null,
                consumption_velocity: 0,
                efficiency_score: 100,
                data_reliability_score: 0,
                last_refill_date: null,
                refill_frequency_days: null,
                predicted_next_refill: null,
                daily_avg_consumption: 0,
                weekly_pattern: new Array(7).fill(0),
                consumption_trend: 'stable' as const,
                unusual_consumption_alert: false,
                potential_leak_alert: false,
                device_connectivity_alert: true
              }
            };
          }
          
          // Calculate analytics
          const rolling_avg_pct_per_day = calculateRollingAverage(readings);
          const prev_day_pct_used = calculatePreviousDayConsumption(readings);
          const days_to_critical_level = calculateDaysToCritical(
            location.latest_calibrated_fill_percentage || 0,
            rolling_avg_pct_per_day,
            20
          );
          
          const consumption_velocity = calculateConsumptionVelocity(readings);
          const data_reliability_score = calculateDataReliabilityScore(readings);
          const efficiency_score = calculateEfficiencyScore(rolling_avg_pct_per_day, 2.0);
          
          const refillAnalysis = analyzeRefillPattern(readings);
          const predicted_next_refill = refillAnalysis.lastRefillDate && refillAnalysis.refillFrequencyDays
            ? new Date(new Date(refillAnalysis.lastRefillDate).getTime() + (refillAnalysis.refillFrequencyDays * 24 * 60 * 60 * 1000)).toISOString()
            : null;
          
          const weekly_pattern = analyzeWeeklyPattern(readings);
          const consumption_trend = determineConsumptionTrend(readings);
          
          const partialAnalytics = {
            rolling_avg_pct_per_day,
            data_reliability_score
          };
          const alerts = generateAlerts(partialAnalytics, readings);
          
          return {
            ...location,
            analytics: {
              rolling_avg_pct_per_day,
              prev_day_pct_used,
              days_to_critical_level,
              consumption_velocity,
              efficiency_score,
              data_reliability_score,
              last_refill_date: refillAnalysis.lastRefillDate,
              refill_frequency_days: refillAnalysis.refillFrequencyDays,
              predicted_next_refill,
              daily_avg_consumption: rolling_avg_pct_per_day,
              weekly_pattern,
              consumption_trend,
              ...alerts
            }
          };
        })
      );
      
      return locationsWithAnalytics;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Hook to get summary analytics across all agbot locations
export const useAgbotAnalyticsSummary = () => {
  const { data: locationsWithAnalytics, isLoading, error } = useAgbotLocationsWithAnalytics();
  
  return useQuery({
    queryKey: ['agbot-analytics-summary', locationsWithAnalytics],
    queryFn: async () => {
      if (!locationsWithAnalytics || locationsWithAnalytics.length === 0) {
        return {
          totalLocations: 0,
          locationsWithData: 0,
          avgConsumptionRate: 0,
          avgEfficiencyScore: 100,
          avgReliabilityScore: 0,
          locationsNeedingAttention: 0,
          upcomingRefills: 0,
          alertsCount: {
            unusual_consumption: 0,
            potential_leak: 0,
            device_connectivity: 0
          }
        };
      }
      
      const locationsWithData = locationsWithAnalytics.filter(
        loc => loc.analytics.rolling_avg_pct_per_day > 0
      );
      
      const avgConsumptionRate = locationsWithData.length > 0
        ? locationsWithData.reduce((sum, loc) => sum + loc.analytics.rolling_avg_pct_per_day, 0) / locationsWithData.length
        : 0;
      
      const avgEfficiencyScore = locationsWithAnalytics.length > 0
        ? locationsWithAnalytics.reduce((sum, loc) => sum + loc.analytics.efficiency_score, 0) / locationsWithAnalytics.length
        : 100;
      
      const avgReliabilityScore = locationsWithAnalytics.length > 0
        ? locationsWithAnalytics.reduce((sum, loc) => sum + loc.analytics.data_reliability_score, 0) / locationsWithAnalytics.length
        : 0;
      
      const locationsNeedingAttention = locationsWithAnalytics.filter(
        loc => loc.analytics.days_to_critical_level !== null && loc.analytics.days_to_critical_level <= 7
      ).length;
      
      const upcomingRefills = locationsWithAnalytics.filter(
        loc => {
          if (!loc.analytics.predicted_next_refill) return false;
          const nextRefill = new Date(loc.analytics.predicted_next_refill);
          const inTwoWeeks = new Date();
          inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
          return nextRefill <= inTwoWeeks;
        }
      ).length;
      
      const alertsCount = {
        unusual_consumption: locationsWithAnalytics.filter(loc => loc.analytics.unusual_consumption_alert).length,
        potential_leak: locationsWithAnalytics.filter(loc => loc.analytics.potential_leak_alert).length,
        device_connectivity: locationsWithAnalytics.filter(loc => loc.analytics.device_connectivity_alert).length
      };
      
      return {
        totalLocations: locationsWithAnalytics.length,
        locationsWithData: locationsWithData.length,
        avgConsumptionRate: Number(avgConsumptionRate.toFixed(2)),
        avgEfficiencyScore: Number(avgEfficiencyScore.toFixed(1)),
        avgReliabilityScore: Number(avgReliabilityScore.toFixed(1)),
        locationsNeedingAttention,
        upcomingRefills,
        alertsCount
      };
    },
    enabled: !!locationsWithAnalytics,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};