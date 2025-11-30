/**
 * Fuel Analytics Edge Function
 *
 * Performs heavy analytics calculations server-side:
 * - Refuel event detection
 * - Consumption metrics (daily/weekly/monthly averages, trends)
 * - Tank performance metrics
 * - Seasonal analysis
 * - Operational insights
 * - Alert generation
 *
 * Reduces client-side computation by moving 800+ lines of calculations server-side
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// TYPES
// ============================================

interface DipReading {
  id: string;
  tank_id: string;
  value: number;
  created_at: string;
  recorded_by?: string;
  notes?: string;
}

interface TankData {
  id: string;
  safe_level: number | null;
  min_level: number | null;
  name?: string;
}

interface RefuelEvent {
  id: string;
  date: string;
  volumeAdded: number;
  beforeLevel: number;
  afterLevel: number;
  timeSinceLast?: number;
  efficiency?: number;
}

interface ConsumptionMetrics {
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
  consumptionStabilityScore: number;
}

interface RefuelAnalytics {
  totalRefuels: number;
  averageRefuelVolume: number;
  averageDaysBetweenRefuels: number;
  daysSinceLastRefuel: number;
  lastRefuelDate: string | null;
  nextPredictedRefuel: string | null;
  nextPredictedRefuelDays: number | null;
  refuelEfficiency: number;
  mostEfficientRefuelVolume: number;
}

interface TankPerformance {
  averageFillPercentage: number;
  timeInZones: {
    critical: number;
    low: number;
    normal: number;
    high: number;
  };
  capacityUtilisationRate: number;
  operationalEfficiencyScore: number;
  daysSinceLastCritical: number | null;
  lowestLevelReached: number;
  highestLevelReached: number;
}

interface OperationalInsights {
  lowFuelEvents: {
    belowMinLevel: number;
    criticalLevel: number;
    lastOccurrence: string | null;
  };
  readingFrequency: {
    averagePerDay: number;
    averagePerWeek: number;
    consistencyScore: number;
  };
  dataQuality: {
    completenessScore: number;
    anomalyCount: number;
    largeVolumeChanges: number;
  };
  complianceScore: number;
}

interface SeasonalAnalysis {
  monthlyConsumption: { month: string; average: number; total: number }[];
  seasonalConsumption: { season: string; average: number; total: number }[];
  highestConsumptionMonth: { month: string; value: number };
  lowestConsumptionMonth: { month: string; value: number };
  monthlyVariation: number;
  seasonalPattern: string;
}

interface FuelAnalyticsResult {
  tankId: string;
  refuelEvents: RefuelEvent[];
  consumptionMetrics: ConsumptionMetrics;
  refuelAnalytics: RefuelAnalytics;
  tankPerformance: TankPerformance;
  operationalInsights: OperationalInsights;
  seasonalAnalysis: SeasonalAnalysis;
  insights: string[];
  alerts: string[];
  calculatedAt: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getWeekKey(date: Date): string {
  const year = date.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const daysSinceYearStart = Math.floor((date.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.ceil((daysSinceYearStart + firstDayOfYear.getDay() + 1) / 7);
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

function getSeason(month: number): string {
  // Southern Hemisphere (Australia)
  if (month >= 2 && month <= 4) return 'Autumn';
  if (month >= 5 && month <= 7) return 'Winter';
  if (month >= 8 && month <= 10) return 'Spring';
  return 'Summer';
}

function getMonthNumber(monthName: string): number {
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return months.indexOf(monthName);
}

function getSeasonOrder(season: string): number {
  const seasons = ['Summer', 'Autumn', 'Winter', 'Spring'];
  return seasons.indexOf(season);
}

// ============================================
// CALCULATION FUNCTIONS
// ============================================

function detectRefuelEvents(readings: DipReading[]): RefuelEvent[] {
  const refuels: RefuelEvent[] = [];

  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const curr = readings[i];

    const volumeIncrease = curr.value - prev.value;
    const percentageIncrease = (volumeIncrease / prev.value) * 100;

    // Refuel detection: Volume increased by >100L OR (>20% AND >50L)
    if (volumeIncrease > 100 || (percentageIncrease > 20 && volumeIncrease > 50)) {
      const timeSinceLast = refuels.length > 0
        ? (new Date(curr.created_at).getTime() - new Date(refuels[refuels.length - 1].date).getTime()) / (1000 * 60 * 60 * 24)
        : undefined;

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

function calculateConsumptionMetrics(readings: DipReading[]): ConsumptionMetrics {
  const empty: ConsumptionMetrics = {
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

  if (readings.length < 2) return empty;

  const dailyConsumption = new Map<string, number>();
  const weeklyConsumption = new Map<string, number>();
  const monthlyConsumption = new Map<string, number>();

  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const curr = readings[i];
    const change = prev.value - curr.value;

    // Only consumption (not refuels) - max 15,000L per day
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
  if (dailyValues.length === 0) return empty;

  const dailyAvg = dailyValues.reduce((sum, val) => sum + val, 0) / dailyValues.length;
  const weeklyAvg = Array.from(weeklyConsumption.values()).reduce((sum, val) => sum + val, 0) / weeklyConsumption.size;
  const monthlyAvg = Array.from(monthlyConsumption.values()).reduce((sum, val) => sum + val, 0) / monthlyConsumption.size;

  // Calculate stability score (coefficient of variation)
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

  const firstHalfAvg = firstHalf.reduce((sum, [_, val]) => sum + val, 0) / (firstHalf.length || 1);
  const secondHalfAvg = secondHalf.reduce((sum, [_, val]) => sum + val, 0) / (secondHalf.length || 1);

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  const changePercent = ((secondHalfAvg - firstHalfAvg) / (firstHalfAvg || 1)) * 100;
  if (changePercent > 10) trend = 'increasing';
  else if (changePercent < -10) trend = 'decreasing';

  const totalConsumed = dailyValues.reduce((sum, val) => sum + val, 0);

  // Calculate last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const last30Days = Array.from(dailyConsumption.entries())
    .filter(([date]) => new Date(date) >= thirtyDaysAgo)
    .reduce((sum, [_, val]) => sum + val, 0);

  return {
    dailyAverageConsumption: dailyAvg,
    weeklyAverageConsumption: weeklyAvg || 0,
    monthlyAverageConsumption: monthlyAvg || 0,
    consumptionTrend: trend,
    peakConsumptionDay: peakDay.date,
    peakConsumptionValue: peakDay.value,
    lowConsumptionDay: lowDay.date,
    lowConsumptionValue: lowDay.value === Infinity ? 0 : lowDay.value,
    totalConsumedLast30Days: last30Days,
    totalConsumedInPeriod: totalConsumed,
    consumptionStabilityScore: stabilityScore
  };
}

function calculateRefuelAnalytics(refuelEvents: RefuelEvent[], readings: DipReading[]): RefuelAnalytics {
  const empty: RefuelAnalytics = {
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

  if (refuelEvents.length === 0) return empty;

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

  let nextPredictedRefuelDays: number | null = null;
  let nextPredictedRefuel: string | null = null;

  if (lastRefuel && averageInterval > 0) {
    nextPredictedRefuelDays = Math.max(0, Math.round(averageInterval - daysSinceLastRefuel));
    const nextDate = new Date(now.getTime() + (nextPredictedRefuelDays * 24 * 60 * 60 * 1000));
    nextPredictedRefuel = nextDate.toISOString();
  }

  const tankCapacity = Math.max(...readings.map(r => r.value));
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

function calculateTankPerformance(readings: DipReading[], tankData: TankData | null): TankPerformance {
  const empty: TankPerformance = {
    averageFillPercentage: 0,
    timeInZones: { critical: 0, low: 0, normal: 0, high: 0 },
    capacityUtilisationRate: 0,
    operationalEfficiencyScore: 0,
    daysSinceLastCritical: null,
    lowestLevelReached: 0,
    highestLevelReached: 0
  };

  if (!readings.length || !tankData) return empty;

  const safeLevel = tankData.safe_level || 0;
  const minLevel = tankData.min_level || 0;

  if (!safeLevel || !minLevel || safeLevel <= minLevel) return empty;

  const fillPercentages: number[] = [];
  const timeInZones = { critical: 0, low: 0, normal: 0, high: 0 };
  let lowestLevel = Infinity;
  let highestLevel = 0;
  let lastCriticalDate: Date | null = null;

  readings.forEach((reading, index) => {
    const usableCapacity = safeLevel - minLevel;
    const levelAboveMin = Math.max(0, reading.value - minLevel);
    const fillPercent = (levelAboveMin / usableCapacity) * 100;
    fillPercentages.push(fillPercent);

    if (reading.value < lowestLevel) lowestLevel = reading.value;
    if (reading.value > highestLevel) highestLevel = reading.value;

    if (index < readings.length - 1) {
      const hoursUntilNext = (new Date(readings[index + 1].created_at).getTime() -
                              new Date(reading.created_at).getTime()) / (1000 * 60 * 60);

      if (fillPercent < 10) {
        timeInZones.critical += hoursUntilNext;
        lastCriticalDate = new Date(reading.created_at);
      } else if (fillPercent <= 25) {
        timeInZones.low += hoursUntilNext;
      } else if (fillPercent <= 70) {
        timeInZones.normal += hoursUntilNext;
      } else {
        timeInZones.high += hoursUntilNext;
      }
    }
  });

  const totalHours = Object.values(timeInZones).reduce((sum, hours) => sum + hours, 0);

  if (totalHours > 0) {
    Object.keys(timeInZones).forEach(zone => {
      timeInZones[zone as keyof typeof timeInZones] = (timeInZones[zone as keyof typeof timeInZones] / totalHours) * 100;
    });
  }

  const avgFillPercentage = fillPercentages.reduce((sum, p) => sum + p, 0) / fillPercentages.length;
  const usableCapacity = safeLevel - minLevel;
  const capacityUtilization = ((highestLevel - lowestLevel) / usableCapacity) * 100;

  const criticalPenalty = Math.min(30, timeInZones.critical * 3);
  const avgFillScore = Math.min(40, (avgFillPercentage / 100) * 40);
  const utilisationScore = Math.min(30, (capacityUtilization / 100) * 30);
  const efficiencyScore = Math.max(0, Math.min(100, 100 - criticalPenalty + avgFillScore + utilisationScore));

  const daysSinceLastCritical = lastCriticalDate
    ? Math.floor((new Date().getTime() - lastCriticalDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return {
    averageFillPercentage: avgFillPercentage,
    timeInZones,
    capacityUtilisationRate: capacityUtilization,
    operationalEfficiencyScore: efficiencyScore,
    daysSinceLastCritical,
    lowestLevelReached: lowestLevel === Infinity ? 0 : lowestLevel,
    highestLevelReached: highestLevel
  };
}

function calculateSeasonalAnalysis(readings: DipReading[]): SeasonalAnalysis {
  const empty: SeasonalAnalysis = {
    monthlyConsumption: [],
    seasonalConsumption: [],
    highestConsumptionMonth: { month: '', value: 0 },
    lowestConsumptionMonth: { month: '', value: 0 },
    monthlyVariation: 0,
    seasonalPattern: 'Insufficient data'
  };

  if (readings.length < 2) return empty;

  const monthlyData = new Map<string, { total: number; count: number }>();
  const seasonalData = new Map<string, { total: number; count: number }>();

  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const curr = readings[i];
    const change = prev.value - curr.value;

    if (change > 0 && change < 15000) {
      const date = new Date(curr.created_at);
      const monthKey = date.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });
      const season = getSeason(date.getMonth());

      const monthData = monthlyData.get(monthKey) || { total: 0, count: 0 };
      monthData.total += change;
      monthData.count += 1;
      monthlyData.set(monthKey, monthData);

      const seasonData = seasonalData.get(season) || { total: 0, count: 0 };
      seasonData.total += change;
      seasonData.count += 1;
      seasonalData.set(season, seasonData);
    }
  }

  const monthlyConsumption = Array.from(monthlyData.entries()).map(([month, data]) => ({
    month: month.split(' ')[0],
    average: data.count > 0 ? data.total / data.count : 0,
    total: data.total
  })).sort((a, b) => getMonthNumber(a.month) - getMonthNumber(b.month));

  const seasonalConsumption = Array.from(seasonalData.entries()).map(([season, data]) => ({
    season,
    average: data.count > 0 ? data.total / data.count : 0,
    total: data.total
  })).sort((a, b) => getSeasonOrder(a.season) - getSeasonOrder(b.season));

  let highestPeriod = { month: '', value: 0 };
  let lowestPeriod = { month: '', value: Infinity };

  monthlyConsumption.forEach(m => {
    if (m.average > highestPeriod.value) highestPeriod = { month: m.month, value: m.average };
    if (m.average > 0 && m.average < lowestPeriod.value) lowestPeriod = { month: m.month, value: m.average };
  });

  const allAverages = monthlyConsumption.map(m => m.average).filter(a => a > 0);
  const overallAverage = allAverages.length > 0 ? allAverages.reduce((sum, avg) => sum + avg, 0) / allAverages.length : 0;
  const variations = overallAverage > 0 ? allAverages.map(avg => Math.abs((avg - overallAverage) / overallAverage * 100)) : [0];
  const monthlyVariation = variations.length > 0 ? variations.reduce((sum, v) => sum + v, 0) / variations.length : 0;

  const sortedSeasonal = [...seasonalConsumption].sort((a, b) => b.average - a.average);
  const seasonalPattern = sortedSeasonal.length >= 2
    ? `Peak: ${sortedSeasonal[0]?.season || ''}, Low: ${sortedSeasonal[sortedSeasonal.length - 1]?.season || ''}`
    : 'Insufficient data';

  return {
    monthlyConsumption,
    seasonalConsumption,
    highestConsumptionMonth: highestPeriod,
    lowestConsumptionMonth: { month: lowestPeriod.month, value: lowestPeriod.value === Infinity ? 0 : lowestPeriod.value },
    monthlyVariation,
    seasonalPattern
  };
}

function calculateOperationalInsights(readings: DipReading[], tankData: TankData | null): OperationalInsights {
  const empty: OperationalInsights = {
    lowFuelEvents: { belowMinLevel: 0, criticalLevel: 0, lastOccurrence: null },
    readingFrequency: { averagePerDay: 0, averagePerWeek: 0, consistencyScore: 0 },
    dataQuality: { completenessScore: 0, anomalyCount: 0, largeVolumeChanges: 0 },
    complianceScore: 0
  };

  if (!readings.length) return empty;

  const minLevel = tankData?.min_level || 0;
  const safeLevel = tankData?.safe_level || 0;

  let belowMinCount = 0;
  let criticalCount = 0;
  let lastLowFuelDate: string | null = null;

  readings.forEach(reading => {
    if (minLevel && reading.value < minLevel) {
      belowMinCount++;
      lastLowFuelDate = reading.created_at;
    }
    if (safeLevel && minLevel && safeLevel > minLevel) {
      const usableCapacity = safeLevel - minLevel;
      const levelAboveMin = Math.max(0, reading.value - minLevel);
      const fillPercent = (levelAboveMin / usableCapacity) * 100;

      if (fillPercent < 10) {
        criticalCount++;
        if (!lastLowFuelDate || reading.created_at > lastLowFuelDate) {
          lastLowFuelDate = reading.created_at;
        }
      }
    }
  });

  // Calculate reading frequency (weekdays only)
  const weekdayReadings = readings.filter(reading => {
    const date = new Date(reading.created_at);
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  });

  const timeSpan = weekdayReadings.length > 1
    ? (new Date(weekdayReadings[weekdayReadings.length - 1].created_at).getTime() - new Date(weekdayReadings[0].created_at).getTime()) / (1000 * 60 * 60 * 24)
    : 0;

  const weekdaysInSpan = timeSpan > 0 ? Math.floor(timeSpan / 7) * 5 + Math.min(5, timeSpan % 7) : 0;

  const avgPerDay = weekdaysInSpan > 0 ? weekdayReadings.length / weekdaysInSpan : 0;
  const avgPerWeek = avgPerDay * 5;

  // Calculate consistency score
  const weekdayIntervals: number[] = [];
  for (let i = 1; i < weekdayReadings.length; i++) {
    const interval = (new Date(weekdayReadings[i].created_at).getTime() -
                     new Date(weekdayReadings[i - 1].created_at).getTime()) / (1000 * 60 * 60);
    weekdayIntervals.push(interval);
  }

  const avgInterval = weekdayIntervals.length > 0 ? weekdayIntervals.reduce((sum, i) => sum + i, 0) / weekdayIntervals.length : 24;
  const intervalStdDev = weekdayIntervals.length > 0
    ? Math.sqrt(weekdayIntervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / weekdayIntervals.length)
    : 0;
  const consistencyScore = Math.max(0, Math.min(100, 100 - (intervalStdDev / avgInterval) * 100));

  // Data quality metrics
  let anomalyCount = 0;
  let largeChanges = 0;

  for (let i = 1; i < readings.length; i++) {
    const change = Math.abs(readings[i].value - readings[i - 1].value);
    const percentChange = (change / readings[i - 1].value) * 100;

    if (percentChange > 50 && change > 1000) {
      anomalyCount++;
    }
    if (change > 5000) {
      largeChanges++;
    }
  }

  const completenessScore = Math.min(100, (avgPerDay / 1) * 100);
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

function generateInsights(
  refuelEvents: RefuelEvent[],
  consumption: ConsumptionMetrics,
  refuels: RefuelAnalytics,
  seasonal: SeasonalAnalysis
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

  if (seasonal.highestConsumptionMonth.month && seasonal.lowestConsumptionMonth.month) {
    insights.push(`Highest consumption: ${seasonal.highestConsumptionMonth.month} (${Math.round(seasonal.highestConsumptionMonth.value)}L/day avg)`);
    insights.push(`Lowest consumption: ${seasonal.lowestConsumptionMonth.month} (${Math.round(seasonal.lowestConsumptionMonth.value)}L/day avg)`);
  }

  if (seasonal.seasonalPattern !== 'Insufficient data') {
    insights.push(`Seasonal pattern: ${seasonal.seasonalPattern}`);
  }

  if (seasonal.monthlyVariation > 20) {
    insights.push(`High seasonal variation (+/-${Math.round(seasonal.monthlyVariation)}%) - consider seasonal planning`);
  }

  return insights;
}

function generateAlerts(
  refuelEvents: RefuelEvent[],
  consumption: ConsumptionMetrics,
  refuels: RefuelAnalytics,
  readings: DipReading[],
  tankData: TankData | null
): string[] {
  const alerts: string[] = [];

  if (refuelEvents.length > 0) {
    const lastRefuel = refuelEvents[refuelEvents.length - 1];
    const daysSinceLastRefuel = (new Date().getTime() - new Date(lastRefuel.date).getTime()) / (1000 * 60 * 60 * 24);

    const currentLevel = readings.length > 0 ? readings[readings.length - 1].value : 0;
    const minLevel = tankData?.min_level || 0;
    const safeLevel = tankData?.safe_level || 0;
    const usableCapacity = safeLevel - minLevel;
    const currentFillPercent = usableCapacity > 0 ? ((currentLevel - minLevel) / usableCapacity) * 100 : 0;

    if (currentFillPercent < 30 || daysSinceLastRefuel > 4) {
      alerts.push('Refuel overdue - tank may need attention');
    }
  }

  if (consumption.consumptionTrend === 'increasing') {
    alerts.push('Fuel consumption increasing - review equipment efficiency');
  }

  if (refuels.refuelEfficiency > 90) {
    alerts.push('Tank frequently filled to capacity - consider larger refuel intervals');
  }

  return alerts;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { tank_id, days_back = 90 } = await req.json();

    if (!tank_id) {
      return new Response(
        JSON.stringify({ error: 'tank_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch tank data
    const { data: tankData, error: tankError } = await supabase
      .from('fuel_tanks')
      .select('id, safe_level, min_level, name')
      .eq('id', tank_id)
      .single();

    if (tankError && tankError.code !== 'PGRST116') {
      throw new Error(`Failed to fetch tank: ${tankError.message}`);
    }

    // Fetch readings
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days_back);

    const { data: readings, error: readingsError } = await supabase
      .from('dip_readings')
      .select('id, tank_id, value, created_at, recorded_by, notes')
      .eq('tank_id', tank_id)
      .is('archived_at', null)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (readingsError) {
      throw new Error(`Failed to fetch readings: ${readingsError.message}`);
    }

    if (!readings || readings.length < 2) {
      return new Response(
        JSON.stringify({
          error: 'Insufficient data for analysis',
          tank_id,
          readingsCount: readings?.length || 0
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculate all analytics
    const refuelEvents = detectRefuelEvents(readings);
    const consumptionMetrics = calculateConsumptionMetrics(readings);
    const refuelAnalytics = calculateRefuelAnalytics(refuelEvents, readings);
    const tankPerformance = calculateTankPerformance(readings, tankData);
    const seasonalAnalysis = calculateSeasonalAnalysis(readings);
    const operationalInsights = calculateOperationalInsights(readings, tankData);
    const insights = generateInsights(refuelEvents, consumptionMetrics, refuelAnalytics, seasonalAnalysis);
    const alerts = generateAlerts(refuelEvents, consumptionMetrics, refuelAnalytics, readings, tankData);

    const result: FuelAnalyticsResult = {
      tankId: tank_id,
      refuelEvents,
      consumptionMetrics,
      refuelAnalytics,
      tankPerformance,
      operationalInsights,
      seasonalAnalysis,
      insights,
      alerts,
      calculatedAt: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (err) {
    console.error('Error in fuel-analytics:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
