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
      
      const { data: rawData, error } = await supabase
        .schema('great_southern_fuels').from('ta_agbot_readings')
        .select('level_percent, raw_percent, reading_at, is_online, created_at')
        .eq('asset_id', assetId)
        .gte('reading_at', daysAgo.toISOString())
        .order('reading_at', { ascending: true });

      // Map new column names to old interface
      const data = rawData?.map(r => ({
        calibrated_fill_percentage: r.level_percent,
        raw_fill_percentage: r.raw_percent,
        reading_timestamp: r.reading_at,
        device_online: r.is_online,
        created_at: r.created_at
      }));
      
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
  const assetId = mainAsset?.external_guid;
  
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
        location.calibrated_fill_level || 0,
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
// OPTIMIZED: Uses batch query instead of N+1 pattern, leverages pre-computed DB fields
export const useAgbotLocationsWithAnalytics = () => {
  return useQuery({
    queryKey: ['agbot-locations-with-analytics'],
    queryFn: async (): Promise<AgbotLocationWithAnalytics[]> => {
      // Step 1: Get all locations with assets (includes pre-computed fields)
      const { data: locations, error: locationsError } = await supabase
        .schema('great_southern_fuels').from('ta_agbot_locations')
        .select(`
          *,
          assets:ta_agbot_assets(
            id,
            capacity_liters,
            daily_consumption_liters,
            days_remaining,
            is_online,
            current_level_percent
          )
        `)
        .order('name');

      if (locationsError) {
        console.error('Error fetching agbot locations:', locationsError);
        throw locationsError;
      }

      if (!locations || locations.length === 0) {
        return [];
      }

      // Step 2: Collect all asset IDs for batch query
      const assetIds = locations
        .flatMap(loc => loc.assets?.map((a: any) => a.id) || [])
        .filter(Boolean);

      // Step 3: Single batch query for all readings (fixes N+1 pattern)
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - 30);

      let readingsByAsset = new Map<string, AgbotReading[]>();

      if (assetIds.length > 0) {
        const { data: allReadings } = await supabase
          .schema('great_southern_fuels').from('ta_agbot_readings')
          .select('asset_id, level_percent, raw_percent, reading_at, is_online, created_at')
          .in('asset_id', assetIds)
          .gte('reading_at', daysAgo.toISOString())
          .order('reading_at', { ascending: true });

        // Group readings by asset_id (O(n) instead of N queries)
        (allReadings || []).forEach((r: any) => {
          if (!readingsByAsset.has(r.asset_id)) {
            readingsByAsset.set(r.asset_id, []);
          }
          readingsByAsset.get(r.asset_id)!.push({
            calibrated_fill_percentage: r.level_percent,
            raw_fill_percentage: r.raw_percent,
            reading_timestamp: r.reading_at,
            device_online: r.is_online,
            created_at: r.created_at
          });
        });
      }

      // Step 4: Build analytics using pre-computed fields + batch readings
      const defaultAnalytics: AgbotAnalytics = {
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
      };

      return locations.map((location) => {
        const mainAsset = location.assets?.[0];
        if (!mainAsset) {
          return { ...location, analytics: defaultAnalytics };
        }

        const readings = readingsByAsset.get(mainAsset.id) || [];

        // Use pre-computed fields from database when available
        const dailyConsumptionLiters = mainAsset.daily_consumption_liters;
        const capacityLiters = mainAsset.capacity_liters;

        // Calculate rolling avg from pre-computed or fallback to calculation
        const rolling_avg_pct_per_day = (dailyConsumptionLiters && capacityLiters && capacityLiters > 0)
          ? (dailyConsumptionLiters / capacityLiters) * 100
          : (readings.length >= 2 ? calculateRollingAverage(readings) : 0);

        // Use pre-computed days_remaining from database
        const days_to_critical_level = mainAsset.days_remaining ??
          (readings.length >= 2 ? calculateDaysToCritical(
            location.calibrated_fill_level || 0,
            rolling_avg_pct_per_day,
            20
          ) : null);

        if (readings.length < 2) {
          return {
            ...location,
            analytics: {
              ...defaultAnalytics,
              rolling_avg_pct_per_day,
              days_to_critical_level,
              daily_avg_consumption: rolling_avg_pct_per_day,
              device_connectivity_alert: !mainAsset.is_online
            }
          };
        }

        // Calculate remaining metrics from readings
        const prev_day_pct_used = calculatePreviousDayConsumption(readings);
        const consumption_velocity = calculateConsumptionVelocity(readings);
        const data_reliability_score = calculateDataReliabilityScore(readings);
        const efficiency_score = calculateEfficiencyScore(rolling_avg_pct_per_day, 2.0);

        const refillAnalysis = analyzeRefillPattern(readings);
        const predicted_next_refill = refillAnalysis.lastRefillDate && refillAnalysis.refillFrequencyDays
          ? new Date(new Date(refillAnalysis.lastRefillDate).getTime() + (refillAnalysis.refillFrequencyDays * 24 * 60 * 60 * 1000)).toISOString()
          : null;

        const weekly_pattern = analyzeWeeklyPattern(readings);
        const consumption_trend = determineConsumptionTrend(readings);

        const alerts = generateAlerts({ rolling_avg_pct_per_day, data_reliability_score }, readings);

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
      });
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