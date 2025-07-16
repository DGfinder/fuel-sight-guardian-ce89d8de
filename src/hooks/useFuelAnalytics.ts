import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useTankHistory } from './useTankHistory';

export interface RefuelEvent {
  id: string;
  date: string;
  volumeAdded: number;
  beforeLevel: number;
  afterLevel: number;
  timeSinceLast?: number; // days
  efficiency?: number; // volume per day since last refuel
}

export interface FuelConsumptionMetrics {
  dailyAverageConsumption: number;
  weeklyAverageConsumption: number;
  monthlyAverageConsumption: number;
  consumptionTrend: 'increasing' | 'decreasing' | 'stable';
  peakConsumptionDay: string;
  lowConsumptionDay: string;
  totalConsumedLast30Days: number;
}

export interface RefuelAnalytics {
  totalRefuels: number;
  averageRefuelVolume: number;
  averageDaysBetweenRefuels: number;
  lastRefuelDate: string | null;
  nextPredictedRefuel: string | null;
  refuelEfficiency: number; // percentage of tank capacity typically used
  mostEfficientRefuelVolume: number;
}

export interface FuelAnalyticsData {
  refuelEvents: RefuelEvent[];
  consumptionMetrics: FuelConsumptionMetrics;
  refuelAnalytics: RefuelAnalytics;
  insights: string[];
  alerts: string[];
}

interface UseFuelAnalyticsParams {
  tankId: string;
  enabled?: boolean;
  analysisRange?: number; // days to analyze, default 90
}

export function useFuelAnalytics({ 
  tankId, 
  enabled = true, 
  analysisRange = 90 
}: UseFuelAnalyticsParams) {
  // Get tank history for analysis
  const { data: historyData } = useTankHistory({
    tankId,
    enabled,
    days: analysisRange,
    sortBy: 'created_at',
    sortOrder: 'asc', // Chronological order for analysis
    limit: 1000 // Get more data for analysis
  });

  return useQuery<FuelAnalyticsData>({
    queryKey: ['fuel-analytics', tankId, analysisRange],
    queryFn: async () => {
      if (!historyData?.readings || historyData.readings.length < 2) {
        return {
          refuelEvents: [],
          consumptionMetrics: getEmptyConsumptionMetrics(),
          refuelAnalytics: getEmptyRefuelAnalytics(),
          insights: ['Insufficient data for analysis'],
          alerts: []
        };
      }

      const readings = historyData.readings;
      
      // Detect refuel events
      const refuelEvents = detectRefuelEvents(readings);
      
      // Calculate consumption metrics
      const consumptionMetrics = calculateConsumptionMetrics(readings);
      
      // Calculate refuel analytics
      const refuelAnalytics = calculateRefuelAnalytics(refuelEvents, readings);
      
      // Generate insights
      const insights = generateInsights(refuelEvents, consumptionMetrics, refuelAnalytics);
      
      // Generate alerts
      const alerts = generateAlerts(refuelEvents, consumptionMetrics, refuelAnalytics);

      return {
        refuelEvents,
        consumptionMetrics,
        refuelAnalytics,
        insights,
        alerts
      };
    },
    enabled: enabled && !!tankId && !!historyData?.readings,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Refuel detection algorithm
function detectRefuelEvents(readings: any[]): RefuelEvent[] {
  const refuels: RefuelEvent[] = [];
  
  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const curr = readings[i];
    
    // Detect significant increase in fuel level (likely refuel)
    const volumeIncrease = curr.value - prev.value;
    const percentageIncrease = (volumeIncrease / prev.value) * 100;
    
    // Consider it a refuel if:
    // 1. Volume increased by more than 100L OR
    // 2. Volume increased by more than 20% AND more than 50L
    if (volumeIncrease > 100 || (percentageIncrease > 20 && volumeIncrease > 50)) {
      // Calculate time since last refuel
      const timeSinceLast = refuels.length > 0 
        ? (new Date(curr.created_at).getTime() - new Date(refuels[refuels.length - 1].date).getTime()) / (1000 * 60 * 60 * 24)
        : undefined;
      
      // Calculate efficiency (fuel used per day since last refuel)
      const efficiency = timeSinceLast && i > 1 
        ? (prev.value - (refuels.length > 0 ? refuels[refuels.length - 1].afterLevel : readings[0].value)) / timeSinceLast
        : undefined;
      
      refuels.push({
        id: curr.id,
        date: curr.created_at,
        volumeAdded: volumeIncrease,
        beforeLevel: prev.value,
        afterLevel: curr.value,
        timeSinceLast,
        efficiency
      });
    }
  }
  
  return refuels;
}

// Calculate consumption metrics
function calculateConsumptionMetrics(readings: any[]): FuelConsumptionMetrics {
  if (readings.length < 2) return getEmptyConsumptionMetrics();
  
  const dailyChanges: { date: string; consumption: number }[] = [];
  let filteredCount = 0;
  let totalFilteredVolume = 0;
  
  // Calculate daily consumption (excluding refuel days)
  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const curr = readings[i];
    const change = prev.value - curr.value; // Positive = consumption
    
    // Only include if it's consumption (not a refuel)
    // Increased limit to 15,000L to match database logic for realistic consumption rates (3000-5000L/day typical)
    if (change > 0 && change < 15000) { // Max 15,000L per day - aligns with database view logic
      dailyChanges.push({
        date: curr.created_at.split('T')[0],
        consumption: change
      });
    } else if (change > 0) {
      // Log filtered high consumption values (potential refuels)
      filteredCount++;
      totalFilteredVolume += change;
    }
  }
  
  // Debug logging
  console.log(`Fuel Analytics Debug: Found ${dailyChanges.length} consumption days, filtered ${filteredCount} high-volume changes (${totalFilteredVolume.toLocaleString()}L total)`);
  
  if (dailyChanges.length === 0) return getEmptyConsumptionMetrics();
  
  const totalConsumption = dailyChanges.reduce((sum, day) => sum + day.consumption, 0);
  const averageDailyConsumption = totalConsumption / dailyChanges.length;
  
  // Calculate trend
  const firstHalf = dailyChanges.slice(0, Math.floor(dailyChanges.length / 2));
  const secondHalf = dailyChanges.slice(Math.floor(dailyChanges.length / 2));
  const firstHalfAvg = firstHalf.reduce((sum, day) => sum + day.consumption, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, day) => sum + day.consumption, 0) / secondHalf.length;
  
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
  if (changePercent > 10) trend = 'increasing';
  else if (changePercent < -10) trend = 'decreasing';
  
  // Find peak and low consumption days
  const sortedByConsumption = [...dailyChanges].sort((a, b) => b.consumption - a.consumption);
  
  const result = {
    dailyAverageConsumption: averageDailyConsumption,
    weeklyAverageConsumption: averageDailyConsumption * 7,
    monthlyAverageConsumption: averageDailyConsumption * 30,
    consumptionTrend: trend,
    peakConsumptionDay: sortedByConsumption[0]?.date || '',
    lowConsumptionDay: sortedByConsumption[sortedByConsumption.length - 1]?.date || '',
    totalConsumedLast30Days: dailyChanges
      .filter(day => {
        const dayDate = new Date(day.date);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return dayDate >= thirtyDaysAgo;
      })
      .reduce((sum, day) => sum + day.consumption, 0)
  };
  
  // Debug logging for final calculated metrics
  console.log(`Fuel Analytics Result: Daily avg: ${Math.round(result.dailyAverageConsumption)}L, Trend: ${result.consumptionTrend}, Total last 30d: ${Math.round(result.totalConsumedLast30Days)}L`);
  
  return result;
}

// Calculate refuel analytics
function calculateRefuelAnalytics(refuelEvents: RefuelEvent[], readings: any[]): RefuelAnalytics {
  if (refuelEvents.length === 0) return getEmptyRefuelAnalytics();
  
  const totalVolume = refuelEvents.reduce((sum, refuel) => sum + refuel.volumeAdded, 0);
  const averageVolume = totalVolume / refuelEvents.length;
  
  const refuelIntervals = refuelEvents
    .filter(refuel => refuel.timeSinceLast)
    .map(refuel => refuel.timeSinceLast!);
  
  const averageInterval = refuelIntervals.length > 0 
    ? refuelIntervals.reduce((sum, interval) => sum + interval, 0) / refuelIntervals.length
    : 0;
  
  const lastRefuel = refuelEvents[refuelEvents.length - 1];
  const daysSinceLastRefuel = lastRefuel 
    ? (new Date().getTime() - new Date(lastRefuel.date).getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  
  // Predict next refuel based on average interval
  const nextPredictedRefuel = lastRefuel && averageInterval > 0
    ? new Date(new Date(lastRefuel.date).getTime() + (averageInterval * 24 * 60 * 60 * 1000)).toISOString()
    : null;
  
  // Calculate efficiency (how much of tank capacity is typically used)
  const tankCapacity = Math.max(...readings.map((r: any) => r.value));
  const efficiency = averageVolume / tankCapacity * 100;
  
  return {
    totalRefuels: refuelEvents.length,
    averageRefuelVolume: averageVolume,
    averageDaysBetweenRefuels: averageInterval,
    lastRefuelDate: lastRefuel?.date || null,
    nextPredictedRefuel,
    refuelEfficiency: efficiency,
    mostEfficientRefuelVolume: Math.max(...refuelEvents.map(r => r.volumeAdded))
  };
}

// Generate actionable insights
function generateInsights(
  refuelEvents: RefuelEvent[], 
  consumption: FuelConsumptionMetrics, 
  refuels: RefuelAnalytics
): string[] {
  const insights: string[] = [];
  
  if (refuelEvents.length >= 3) {
    insights.push(`Tank is refueled every ${Math.round(refuels.averageDaysBetweenRefuels)} days on average`);
    insights.push(`Average refuel volume is ${Math.round(refuels.averageRefuelVolume)}L`);
  }
  
  if (consumption.consumptionTrend === 'increasing') {
    insights.push('Fuel consumption is trending upward - consider investigating equipment efficiency');
  } else if (consumption.consumptionTrend === 'decreasing') {
    insights.push('Fuel consumption is trending downward - good efficiency improvements');
  }
  
  if (consumption.dailyAverageConsumption > 0) {
    insights.push(`Daily average consumption: ${Math.round(consumption.dailyAverageConsumption)}L`);
  }
  
  if (refuels.nextPredictedRefuel) {
    const daysUntilRefuel = Math.round((new Date(refuels.nextPredictedRefuel).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    insights.push(`Next refuel predicted in ${daysUntilRefuel} days`);
  }
  
  return insights;
}

// Generate alerts for business attention
function generateAlerts(
  refuelEvents: RefuelEvent[], 
  consumption: FuelConsumptionMetrics, 
  refuels: RefuelAnalytics
): string[] {
  const alerts: string[] = [];
  
  // Alert if no recent refuels
  if (refuelEvents.length > 0) {
    const lastRefuel = refuelEvents[refuelEvents.length - 1];
    const daysSinceLastRefuel = (new Date().getTime() - new Date(lastRefuel.date).getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastRefuel > refuels.averageDaysBetweenRefuels * 1.5) {
      alerts.push('⚠️ Refuel overdue - tank may need attention');
    }
  }
  
  // Alert for consumption anomalies
  if (consumption.consumptionTrend === 'increasing') {
    alerts.push('📈 Fuel consumption increasing - review equipment efficiency');
  }
  
  // Alert for low efficiency
  if (refuels.refuelEfficiency > 90) {
    alerts.push('⛽ Tank frequently filled to capacity - consider larger refuel intervals');
  }
  
  return alerts;
}

// Helper functions for empty data
function getEmptyConsumptionMetrics(): FuelConsumptionMetrics {
  return {
    dailyAverageConsumption: 0,
    weeklyAverageConsumption: 0,
    monthlyAverageConsumption: 0,
    consumptionTrend: 'stable',
    peakConsumptionDay: '',
    lowConsumptionDay: '',
    totalConsumedLast30Days: 0
  };
}

function getEmptyRefuelAnalytics(): RefuelAnalytics {
  return {
    totalRefuels: 0,
    averageRefuelVolume: 0,
    averageDaysBetweenRefuels: 0,
    lastRefuelDate: null,
    nextPredictedRefuel: null,
    refuelEfficiency: 0,
    mostEfficientRefuelVolume: 0
  };
}