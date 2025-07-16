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
  peakConsumptionValue: number;
  lowConsumptionDay: string;
  lowConsumptionValue: number;
  totalConsumedLast30Days: number;
  totalConsumedInPeriod: number;
  consumptionStabilityScore: number; // 0-100, higher is more stable
}

export interface RefuelAnalytics {
  totalRefuels: number;
  averageRefuelVolume: number;
  averageDaysBetweenRefuels: number;
  daysSinceLastRefuel: number;
  lastRefuelDate: string | null;
  nextPredictedRefuel: string | null;
  nextPredictedRefuelDays: number | null;
  refuelEfficiency: number; // percentage of tank capacity typically used
  mostEfficientRefuelVolume: number;
}

export interface TankPerformanceMetrics {
  averageFillPercentage: number;
  timeInZones: {
    critical: number; // <20%
    low: number; // 20-40%
    normal: number; // 40-70%
    high: number; // >70%
  };
  capacityUtilizationRate: number; // % of capacity effectively used
  operationalEfficiencyScore: number; // 0-100 score
  daysSinceLastCritical: number | null;
  lowestLevelReached: number;
  highestLevelReached: number;
}

export interface OperationalInsights {
  lowFuelEvents: {
    belowMinLevel: number;
    criticalLevel: number; // <20%
    lastOccurrence: string | null;
  };
  readingFrequency: {
    averagePerDay: number;
    averagePerWeek: number;
    consistencyScore: number; // 0-100
  };
  dataQuality: {
    completenessScore: number; // 0-100
    anomalyCount: number;
    largeVolumeChanges: number;
  };
  complianceScore: number; // 0-100 based on expected reading schedule
}

export interface FuelAnalyticsData {
  refuelEvents: RefuelEvent[];
  consumptionMetrics: FuelConsumptionMetrics;
  refuelAnalytics: RefuelAnalytics;
  tankPerformance: TankPerformanceMetrics;
  operationalInsights: OperationalInsights;
  insights: string[];
  alerts: string[];
}

interface UseFuelAnalyticsParams {
  tankId: string;
  enabled?: boolean;
  analysisRange?: number; // days to analyze, default 90
  dateFrom?: Date;
  dateTo?: Date;
}

export function useFuelAnalytics({ 
  tankId, 
  enabled = true, 
  analysisRange = 90,
  dateFrom,
  dateTo 
}: UseFuelAnalyticsParams) {
  // Get tank data for performance metrics
  const { data: tankData } = useQuery({
    queryKey: ['tank-data', tankId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fuel_tanks')
        .select('*')
        .eq('id', tankId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: enabled && !!tankId
  });

  // Get tank history for analysis
  const { data: historyData } = useTankHistory({
    tankId,
    enabled,
    days: dateFrom && dateTo ? undefined : analysisRange,
    dateFrom,
    dateTo,
    sortBy: 'created_at',
    sortOrder: 'asc', // Chronological order for analysis
    limit: 1000 // Get more data for analysis
  });

  return useQuery<FuelAnalyticsData>({
    queryKey: ['fuel-analytics', tankId, analysisRange, dateFrom, dateTo],
    queryFn: async () => {
      if (!historyData?.readings || historyData.readings.length < 2) {
        return {
          refuelEvents: [],
          consumptionMetrics: getEmptyConsumptionMetrics(),
          refuelAnalytics: getEmptyRefuelAnalytics(),
          tankPerformance: getEmptyTankPerformance(),
          operationalInsights: getEmptyOperationalInsights(),
          insights: ['Insufficient data for analysis'],
          alerts: []
        };
      }

      const readings = historyData.readings;
      
      // Detect refuel events
      const refuelEvents = detectRefuelEvents(readings);
      
      // Calculate consumption metrics
      const consumptionMetrics = calculateConsumptionMetrics(readings, dateFrom, dateTo);
      
      // Calculate refuel analytics
      const refuelAnalytics = calculateRefuelAnalytics(refuelEvents, readings);
      
      // Calculate tank performance
      const tankPerformance = calculateTankPerformance(readings, tankData);
      
      // Calculate operational insights
      const operationalInsights = calculateOperationalInsights(readings, tankData);
      
      // Generate insights
      const insights = generateInsights(refuelEvents, consumptionMetrics, refuelAnalytics, tankPerformance, operationalInsights);
      
      // Generate alerts
      const alerts = generateAlerts(refuelEvents, consumptionMetrics, refuelAnalytics, tankPerformance, operationalInsights);

      return {
        refuelEvents,
        consumptionMetrics,
        refuelAnalytics,
        tankPerformance,
        operationalInsights,
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
function calculateConsumptionMetrics(readings: any[], dateFrom?: Date, dateTo?: Date): FuelConsumptionMetrics {
  if (readings.length < 2) return getEmptyConsumptionMetrics();
  
  const dailyConsumption = new Map<string, number>();
  const weeklyConsumption = new Map<string, number>();
  const monthlyConsumption = new Map<string, number>();
  
  // Calculate consumption between readings
  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const curr = readings[i];
    const change = prev.value - curr.value; // Positive = consumption
    
    // Only include consumption (not refuels) - max 15,000L per day
    if (change > 0 && change < 15000) {
      const date = new Date(curr.created_at);
      const dayKey = date.toISOString().split('T')[0];
      const weekKey = getWeekKey(date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      dailyConsumption.set(dayKey, (dailyConsumption.get(dayKey) || 0) + change);
      weeklyConsumption.set(weekKey, (weeklyConsumption.get(weekKey) || 0) + change);
      monthlyConsumption.set(monthKey, (monthlyConsumption.get(monthKey) || 0) + change);
    }
  }
  
  const dailyValues = Array.from(dailyConsumption.values());
  if (dailyValues.length === 0) return getEmptyConsumptionMetrics();
  
  // Calculate true averages
  const dailyAvg = dailyValues.reduce((sum, val) => sum + val, 0) / dailyValues.length;
  const weeklyAvg = Array.from(weeklyConsumption.values()).reduce((sum, val) => sum + val, 0) / weeklyConsumption.size;
  const monthlyAvg = Array.from(monthlyConsumption.values()).reduce((sum, val) => sum + val, 0) / monthlyConsumption.size;
  
  // Calculate consumption stability (coefficient of variation)
  const stdDev = Math.sqrt(dailyValues.reduce((sum, val) => sum + Math.pow(val - dailyAvg, 2), 0) / dailyValues.length);
  const coefficientOfVariation = (stdDev / dailyAvg) * 100;
  const stabilityScore = Math.max(0, Math.min(100, 100 - coefficientOfVariation));
  
  // Find peak and low days
  let peakDay = { date: '', value: 0 };
  let lowDay = { date: '', value: Infinity };
  dailyConsumption.forEach((value, date) => {
    if (value > peakDay.value) peakDay = { date, value };
    if (value < lowDay.value) lowDay = { date, value };
  });
  
  // Calculate trend
  const sortedDays = Array.from(dailyConsumption.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const midPoint = Math.floor(sortedDays.length / 2);
  const firstHalf = sortedDays.slice(0, midPoint);
  const secondHalf = sortedDays.slice(midPoint);
  
  const firstHalfAvg = firstHalf.reduce((sum, [_, val]) => sum + val, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((sum, [_, val]) => sum + val, 0) / secondHalf.length;
  
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  const changePercent = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
  if (changePercent > 10) trend = 'increasing';
  else if (changePercent < -10) trend = 'decreasing';
  
  // Calculate total consumed in period
  const totalConsumed = dailyValues.reduce((sum, val) => sum + val, 0);
  
  // Calculate last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const last30Days = Array.from(dailyConsumption.entries())
    .filter(([date]) => new Date(date) >= thirtyDaysAgo)
    .reduce((sum, [_, val]) => sum + val, 0);
  
  return {
    dailyAverageConsumption: dailyAvg,
    weeklyAverageConsumption: weeklyAvg,
    monthlyAverageConsumption: monthlyAvg,
    consumptionTrend: trend,
    peakConsumptionDay: peakDay.date,
    peakConsumptionValue: peakDay.value,
    lowConsumptionDay: lowDay.date,
    lowConsumptionValue: lowDay.value,
    totalConsumedLast30Days: last30Days,
    totalConsumedInPeriod: totalConsumed,
    consumptionStabilityScore: stabilityScore
  };
}

// Helper to get week key
function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const daysSinceYearStart = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((daysSinceYearStart + firstDayOfYear.getDay() + 1) / 7);
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
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
  const now = new Date();
  const daysSinceLastRefuel = lastRefuel 
    ? Math.floor((now.getTime() - new Date(lastRefuel.date).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  
  // Predict next refuel based on average interval
  let nextPredictedRefuelDays: number | null = null;
  let nextPredictedRefuel: string | null = null;
  
  if (lastRefuel && averageInterval > 0) {
    nextPredictedRefuelDays = Math.max(0, Math.round(averageInterval - daysSinceLastRefuel));
    const nextDate = new Date(now.getTime() + (nextPredictedRefuelDays * 24 * 60 * 60 * 1000));
    nextPredictedRefuel = nextDate.toISOString();
  }
  
  // Calculate efficiency (how much of tank capacity is typically used)
  const tankCapacity = Math.max(...readings.map((r: any) => r.value));
  const efficiency = (averageVolume / tankCapacity) * 100;
  
  return {
    totalRefuels: refuelEvents.length,
    averageRefuelVolume: averageVolume,
    averageDaysBetweenRefuels: averageInterval,
    daysSinceLastRefuel,
    lastRefuelDate: lastRefuel?.date || null,
    nextPredictedRefuel,
    nextPredictedRefuelDays,
    refuelEfficiency: efficiency,
    mostEfficientRefuelVolume: Math.max(...refuelEvents.map(r => r.volumeAdded))
  };
}

// Calculate tank performance metrics
function calculateTankPerformance(readings: any[], tankData: any): TankPerformanceMetrics {
  if (!readings.length || !tankData) return getEmptyTankPerformance();
  
  const safeLevel = tankData.safe_level || 0;
  if (!safeLevel) return getEmptyTankPerformance();
  
  // Calculate fill percentages and time in zones
  const fillPercentages: number[] = [];
  const timeInZones = { critical: 0, low: 0, normal: 0, high: 0 };
  let lowestLevel = Infinity;
  let highestLevel = 0;
  let lastCriticalDate: Date | null = null;
  
  readings.forEach((reading, index) => {
    const fillPercent = (reading.value / safeLevel) * 100;
    fillPercentages.push(fillPercent);
    
    if (reading.value < lowestLevel) lowestLevel = reading.value;
    if (reading.value > highestLevel) highestLevel = reading.value;
    
    // Track time in zones (using time until next reading)
    if (index < readings.length - 1) {
      const hoursUntilNext = (new Date(readings[index + 1].created_at).getTime() - 
                              new Date(reading.created_at).getTime()) / (1000 * 60 * 60);
      
      if (fillPercent < 20) {
        timeInZones.critical += hoursUntilNext;
        lastCriticalDate = new Date(reading.created_at);
      } else if (fillPercent < 40) {
        timeInZones.low += hoursUntilNext;
      } else if (fillPercent < 70) {
        timeInZones.normal += hoursUntilNext;
      } else {
        timeInZones.high += hoursUntilNext;
      }
    }
  });
  
  const totalHours = Object.values(timeInZones).reduce((sum, hours) => sum + hours, 0);
  
  // Convert to percentages
  if (totalHours > 0) {
    Object.keys(timeInZones).forEach(zone => {
      timeInZones[zone as keyof typeof timeInZones] = (timeInZones[zone as keyof typeof timeInZones] / totalHours) * 100;
    });
  }
  
  // Calculate metrics
  const avgFillPercentage = fillPercentages.reduce((sum, p) => sum + p, 0) / fillPercentages.length;
  const capacityUtilization = ((highestLevel - lowestLevel) / safeLevel) * 100;
  
  // Operational efficiency score (0-100)
  // Based on: avoiding critical levels, maintaining good average, utilizing capacity
  const criticalPenalty = Math.min(30, timeInZones.critical * 3);
  const avgFillScore = Math.min(40, (avgFillPercentage / 100) * 40);
  const utilizationScore = Math.min(30, (capacityUtilization / 100) * 30);
  const efficiencyScore = Math.max(0, 100 - criticalPenalty + avgFillScore + utilizationScore) / 100 * 100;
  
  const daysSinceLastCritical = lastCriticalDate 
    ? Math.floor((new Date().getTime() - lastCriticalDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  
  return {
    averageFillPercentage: avgFillPercentage,
    timeInZones,
    capacityUtilizationRate: capacityUtilization,
    operationalEfficiencyScore: efficiencyScore,
    daysSinceLastCritical,
    lowestLevelReached: lowestLevel,
    highestLevelReached: highestLevel
  };
}

// Calculate operational insights
function calculateOperationalInsights(readings: any[], tankData: any): OperationalInsights {
  if (!readings.length) return getEmptyOperationalInsights();
  
  const minLevel = tankData?.min_level || 0;
  const safeLevel = tankData?.safe_level || 0;
  
  // Count low fuel events
  let belowMinCount = 0;
  let criticalCount = 0;
  let lastLowFuelDate: string | null = null;
  
  readings.forEach(reading => {
    if (minLevel && reading.value < minLevel) {
      belowMinCount++;
      lastLowFuelDate = reading.created_at;
    }
    if (safeLevel && (reading.value / safeLevel) * 100 < 20) {
      criticalCount++;
      if (!lastLowFuelDate || reading.created_at > lastLowFuelDate) {
        lastLowFuelDate = reading.created_at;
      }
    }
  });
  
  // Calculate reading frequency
  const timeSpan = readings.length > 1 
    ? (new Date(readings[readings.length - 1].created_at).getTime() - new Date(readings[0].created_at).getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  
  const avgPerDay = timeSpan > 0 ? readings.length / timeSpan : 0;
  const avgPerWeek = avgPerDay * 7;
  
  // Calculate consistency score based on reading intervals
  const intervals: number[] = [];
  for (let i = 1; i < readings.length; i++) {
    const interval = (new Date(readings[i].created_at).getTime() - 
                     new Date(readings[i - 1].created_at).getTime()) / (1000 * 60 * 60); // hours
    intervals.push(interval);
  }
  
  const avgInterval = intervals.length > 0 ? intervals.reduce((sum, i) => sum + i, 0) / intervals.length : 24;
  const intervalStdDev = intervals.length > 0 
    ? Math.sqrt(intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length)
    : 0;
  const consistencyScore = Math.max(0, Math.min(100, 100 - (intervalStdDev / avgInterval) * 100));
  
  // Data quality metrics
  let anomalyCount = 0;
  let largeChanges = 0;
  
  for (let i = 1; i < readings.length; i++) {
    const change = Math.abs(readings[i].value - readings[i - 1].value);
    const percentChange = (change / readings[i - 1].value) * 100;
    
    // Anomaly: extreme changes that aren't refuels
    if (percentChange > 50 && change > 1000) {
      anomalyCount++;
    }
    if (change > 5000) {
      largeChanges++;
    }
  }
  
  const completenessScore = Math.min(100, (avgPerDay / 1) * 100); // Expecting at least 1 reading per day
  const complianceScore = (consistencyScore + completenessScore) / 2;
  
  return {
    lowFuelEvents: {
      belowMinLevel: belowMinCount,
      criticalLevel: criticalCount,
      lastOccurrence: lastLowFuelDate
    },
    readingFrequency: {
      averagePerDay: avgPerDay,
      averagePerWeek: avgPerWeek,
      consistencyScore
    },
    dataQuality: {
      completenessScore,
      anomalyCount,
      largeVolumeChanges: largeChanges
    },
    complianceScore
  };
}

// Generate actionable insights
function generateInsights(
  refuelEvents: RefuelEvent[], 
  consumption: FuelConsumptionMetrics, 
  refuels: RefuelAnalytics,
  performance: TankPerformanceMetrics,
  operational: OperationalInsights
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
  refuels: RefuelAnalytics,
  performance: TankPerformanceMetrics,
  operational: OperationalInsights
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
    peakConsumptionValue: 0,
    lowConsumptionDay: '',
    lowConsumptionValue: 0,
    totalConsumedLast30Days: 0,
    totalConsumedInPeriod: 0,
    consumptionStabilityScore: 0
  };
}

function getEmptyRefuelAnalytics(): RefuelAnalytics {
  return {
    totalRefuels: 0,
    averageRefuelVolume: 0,
    averageDaysBetweenRefuels: 0,
    daysSinceLastRefuel: 0,
    lastRefuelDate: null,
    nextPredictedRefuel: null,
    nextPredictedRefuelDays: null,
    refuelEfficiency: 0,
    mostEfficientRefuelVolume: 0
  };
}

function getEmptyTankPerformance(): TankPerformanceMetrics {
  return {
    averageFillPercentage: 0,
    timeInZones: {
      critical: 0,
      low: 0,
      normal: 0,
      high: 0
    },
    capacityUtilizationRate: 0,
    operationalEfficiencyScore: 0,
    daysSinceLastCritical: null,
    lowestLevelReached: 0,
    highestLevelReached: 0
  };
}

function getEmptyOperationalInsights(): OperationalInsights {
  return {
    lowFuelEvents: {
      belowMinLevel: 0,
      criticalLevel: 0,
      lastOccurrence: null
    },
    readingFrequency: {
      averagePerDay: 0,
      averagePerWeek: 0,
      consistencyScore: 0
    },
    dataQuality: {
      completenessScore: 0,
      anomalyCount: 0,
      largeVolumeChanges: 0
    },
    complianceScore: 0
  };
}