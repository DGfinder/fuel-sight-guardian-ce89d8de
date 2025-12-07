/**
 * Agbot Analytics Helper Functions
 * Percentage-based analytics for cellular tank monitoring
 *
 * Uses "Hourly Decrease Summation" approach:
 * - Sum all decreases between consecutive readings
 * - Ignore increases (refills)
 * - Consistent with SmartFill and Customer Portal calculations
 */

// Consumption calculation thresholds (percentage-based for AgBot)
export const NOISE_THRESHOLD_PCT = 0.5;    // Ignore changes < 0.5% (sensor noise)
export const REFILL_THRESHOLD_PCT = 10;    // Increases > 10% = refill

// Agbot reading interface for analytics
export interface AgbotReading {
  calibrated_fill_percentage: number;
  raw_fill_percentage: number;
  reading_timestamp: string;
  device_online: boolean;
  created_at: string;
}

// Analytics result interface
export interface AgbotAnalytics {
  // Core consumption metrics
  rolling_avg_pct_per_day: number;        // Average percentage points consumed per day
  prev_day_pct_used: number;              // Percentage points consumed yesterday
  prev_day_liters_used: number | null;    // Liters consumed yesterday (calculated from percentage * capacity)
  days_to_critical_level: number | null;  // Days until reaching critical threshold (20%)

  // Advanced metrics
  consumption_velocity: number;            // Rate of change acceleration (+/- percentage change in consumption rate)
  efficiency_score: number;               // Relative efficiency compared to similar locations (0-100)
  data_reliability_score: number;         // Data quality score based on device uptime (0-100)

  // Refill analysis
  last_refill_date: string | null;        // Date of last detected refill
  refill_frequency_days: number | null;   // Average days between refills
  predicted_next_refill: string | null;   // Predicted next refill date

  // Pattern analysis
  daily_avg_consumption: number;          // Average daily consumption (percentage points)
  weekly_pattern: number[];               // Array of 7 values showing weekly consumption pattern
  consumption_trend: 'increasing' | 'decreasing' | 'stable'; // Overall trend direction

  // Alerts and insights
  unusual_consumption_alert: boolean;     // True if consumption rate is >50% above average
  potential_leak_alert: boolean;          // True if consumption is unusually high and consistent
  device_connectivity_alert: boolean;    // True if device has been offline >20% of time
}

// Helper function to calculate days between dates
export const daysBetween = (date1: Date, date2: Date): number => {
  return Math.abs((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
};

// OPTIMIZATION: Pre-sort readings once to avoid redundant sorts across functions
export const sortReadingsAsc = (readings: AgbotReading[]): AgbotReading[] => {
  return [...readings].sort((a, b) =>
    new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
  );
};

export const sortReadingsDesc = (readings: AgbotReading[]): AgbotReading[] => {
  return [...readings].sort((a, b) =>
    new Date(b.reading_timestamp).getTime() - new Date(a.reading_timestamp).getTime()
  );
};

// Calculate percentage consumption between two readings
export const calculatePercentageConsumption = (
  olderReading: AgbotReading,
  newerReading: AgbotReading
): number => {
  if (!olderReading || !newerReading) return 0;
  
  // Percentage decreased (consumed)
  const consumption = olderReading.calibrated_fill_percentage - newerReading.calibrated_fill_percentage;
  return Math.max(0, consumption); // Only count consumption, not refills
};

// Detect refill events (significant percentage increases)
export const detectRefill = (
  olderReading: AgbotReading,
  newerReading: AgbotReading,
  threshold: number = REFILL_THRESHOLD_PCT
): boolean => {
  if (!olderReading || !newerReading) return false;

  const percentageIncrease = newerReading.calibrated_fill_percentage - olderReading.calibrated_fill_percentage;
  return percentageIncrease >= threshold;
};

/**
 * Calculate rolling average consumption rate (percentage points per day)
 * Uses hourly decrease summation: sums all decreases > noise threshold
 */
export const calculateRollingAverage = (readings: AgbotReading[]): number => {
  if (readings.length < 2) return 0;

  // Sort readings chronologically
  const sorted = [...readings].sort((a, b) =>
    new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
  );

  // Group readings by date
  const readingsByDate: Record<string, AgbotReading[]> = {};
  sorted.forEach(reading => {
    const dateKey = new Date(reading.reading_timestamp).toISOString().split('T')[0];
    if (!readingsByDate[dateKey]) {
      readingsByDate[dateKey] = [];
    }
    readingsByDate[dateKey].push(reading);
  });

  // Calculate daily consumption using hourly decrease summation
  const sortedDates = Object.keys(readingsByDate).sort();
  let totalConsumption = 0;
  let daysWithData = 0;

  sortedDates.forEach((dateKey, dateIndex) => {
    const dayReadings = readingsByDate[dateKey];
    let dailyConsumption = 0;

    // Sum all decreases within the day (> noise threshold)
    for (let i = 1; i < dayReadings.length; i++) {
      const older = dayReadings[i - 1];
      const newer = dayReadings[i];
      const change = older.calibrated_fill_percentage - newer.calibrated_fill_percentage;

      if (change > NOISE_THRESHOLD_PCT) {
        // Consumption detected (level decreased)
        dailyConsumption += change;
      }
      // Increases (refills) are ignored - not counted as negative consumption
    }

    // Handle overnight consumption (previous day's last → today's first)
    if (dateIndex > 0 && dayReadings.length > 0) {
      const prevDateKey = sortedDates[dateIndex - 1];
      const prevDayReadings = readingsByDate[prevDateKey];
      if (prevDayReadings.length > 0) {
        const prevDayLast = prevDayReadings[prevDayReadings.length - 1];
        const todayFirst = dayReadings[0];
        const overnightChange = prevDayLast.calibrated_fill_percentage - todayFirst.calibrated_fill_percentage;

        if (overnightChange > NOISE_THRESHOLD_PCT) {
          dailyConsumption += overnightChange;
        }
      }
    }

    if (dailyConsumption > 0) {
      totalConsumption += dailyConsumption;
      daysWithData++;
    }
  });

  // Return average daily consumption rate
  return daysWithData > 0 ? Number((totalConsumption / daysWithData).toFixed(2)) : 0;
};

/**
 * Calculate previous day consumption (returns percentage points)
 * Uses hourly decrease summation for accurate daily consumption
 */
export const calculatePreviousDayConsumption = (readings: AgbotReading[]): number => {
  if (readings.length < 2) return 0;

  const now = new Date();
  const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));

  // Find readings from the last 24 hours
  const recentReadings = readings
    .filter(reading => {
      const readingDate = new Date(reading.reading_timestamp);
      return readingDate >= yesterday && readingDate < now;
    })
    .sort((a, b) =>
      new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
    );

  if (recentReadings.length < 2) {
    // Fallback: use rolling average as estimate
    return calculateRollingAverage(readings);
  }

  // Sum all decreases in the last 24 hours (hourly summation)
  let dailyConsumption = 0;

  for (let i = 1; i < recentReadings.length; i++) {
    const older = recentReadings[i - 1];
    const newer = recentReadings[i];
    const change = older.calibrated_fill_percentage - newer.calibrated_fill_percentage;

    if (change > NOISE_THRESHOLD_PCT) {
      // Consumption detected
      dailyConsumption += change;
    }
    // Increases (refills) are ignored
  }

  return Number(dailyConsumption.toFixed(2));
};

/**
 * Calculate previous day consumption in LITERS
 * Uses hourly decrease summation for accurate daily consumption
 */
export const calculatePreviousDayConsumptionLiters = (
  readings: AgbotReading[],
  capacityLiters: number | null
): number | null => {
  if (readings.length < 2 || !capacityLiters || capacityLiters <= 0) return null;

  // Get percentage consumption using hourly summation
  const percentageConsumed = calculatePreviousDayConsumption(readings);

  if (percentageConsumed > 0) {
    // Convert percentage to liters
    const litresConsumed = (percentageConsumed / 100) * capacityLiters;
    return Math.round(litresConsumed);
  }

  return null;
};

// Calculate days until critical level (default 20%)
export const calculateDaysToCritical = (
  currentPercentage: number,
  averageDailyConsumption: number,
  criticalThreshold: number = 20
): number | null => {
  if (averageDailyConsumption <= 0 || currentPercentage <= criticalThreshold) {
    return null;
  }
  
  const percentageAboveCritical = currentPercentage - criticalThreshold;
  const daysRemaining = percentageAboveCritical / averageDailyConsumption;
  
  return Number(daysRemaining.toFixed(1));
};

// Calculate consumption velocity (acceleration/deceleration)
export const calculateConsumptionVelocity = (readings: AgbotReading[]): number => {
  if (readings.length < 4) return 0;
  
  const sortedReadings = readings.sort((a, b) => 
    new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
  );
  
  // Calculate consumption rates for first and second half of data
  const midpoint = Math.floor(sortedReadings.length / 2);
  const firstHalf = sortedReadings.slice(0, midpoint);
  const secondHalf = sortedReadings.slice(midpoint);
  
  const firstHalfRate = calculateRollingAverage(firstHalf);
  const secondHalfRate = calculateRollingAverage(secondHalf);
  
  // Velocity is the change in consumption rate
  // Positive means consumption is accelerating, negative means decelerating
  return Number((secondHalfRate - firstHalfRate).toFixed(2));
};

// Detect refill events and calculate frequency
export const analyzeRefillPattern = (readings: AgbotReading[]): {
  lastRefillDate: string | null;
  refillFrequencyDays: number | null;
  refillEvents: Array<{ date: string; percentageIncrease: number }>;
} => {
  if (readings.length < 2) {
    return { lastRefillDate: null, refillFrequencyDays: null, refillEvents: [] };
  }
  
  const sortedReadings = readings.sort((a, b) => 
    new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
  );
  
  const refillEvents: Array<{ date: string; percentageIncrease: number }> = [];
  
  for (let i = 1; i < sortedReadings.length; i++) {
    const older = sortedReadings[i - 1];
    const newer = sortedReadings[i];
    
    if (detectRefill(older, newer)) {
      const percentageIncrease = newer.calibrated_fill_percentage - older.calibrated_fill_percentage;
      refillEvents.push({
        date: newer.reading_timestamp,
        percentageIncrease
      });
    }
  }
  
  if (refillEvents.length === 0) {
    return { lastRefillDate: null, refillFrequencyDays: null, refillEvents: [] };
  }
  
  // Calculate average days between refills
  let totalDaysBetweenRefills = 0;
  for (let i = 1; i < refillEvents.length; i++) {
    const days = daysBetween(
      new Date(refillEvents[i - 1].date),
      new Date(refillEvents[i].date)
    );
    totalDaysBetweenRefills += days;
  }
  
  const avgDaysBetweenRefills = refillEvents.length > 1 
    ? totalDaysBetweenRefills / (refillEvents.length - 1)
    : null;
  
  return {
    lastRefillDate: refillEvents[refillEvents.length - 1].date,
    refillFrequencyDays: avgDaysBetweenRefills ? Number(avgDaysBetweenRefills.toFixed(1)) : null,
    refillEvents
  };
};

// Calculate data reliability score based on device connectivity
export const calculateDataReliabilityScore = (readings: AgbotReading[]): number => {
  if (readings.length === 0) return 0;
  
  const onlineReadings = readings.filter(r => r.device_online);
  const uptime = (onlineReadings.length / readings.length) * 100;
  
  // Also factor in reading consistency (gaps in data)
  const sortedReadings = readings.sort((a, b) => 
    new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
  );
  
  let gapPenalty = 0;
  for (let i = 1; i < sortedReadings.length; i++) {
    const hours = daysBetween(
      new Date(sortedReadings[i - 1].reading_timestamp),
      new Date(sortedReadings[i].reading_timestamp)
    ) * 24;
    
    // Penalize gaps > 2 hours (expected hourly reporting)
    if (hours > 2) {
      gapPenalty += Math.min(10, hours - 1); // Max 10 point penalty per gap
    }
  }
  
  const reliabilityScore = Math.max(0, uptime - gapPenalty);
  return Number(reliabilityScore.toFixed(1));
};

// Calculate efficiency score compared to baseline
export const calculateEfficiencyScore = (
  deviceConsumptionRate: number,
  baselineRate: number = 2.0 // Default baseline of 2% per day
): number => {
  if (deviceConsumptionRate <= 0) return 100;
  
  // Lower consumption rate = higher efficiency
  // Score of 100 = consuming at baseline rate
  // Score > 100 = more efficient than baseline
  // Score < 100 = less efficient than baseline
  const efficiency = (baselineRate / deviceConsumptionRate) * 100;
  
  return Number(Math.min(200, Math.max(0, efficiency)).toFixed(1));
};

// Analyze weekly consumption patterns
export const analyzeWeeklyPattern = (readings: AgbotReading[]): number[] => {
  if (readings.length < 7) return new Array(7).fill(0);
  
  const dayOfWeekConsumption = new Array(7).fill(0); // 0 = Sunday
  const dayOfWeekCounts = new Array(7).fill(0);
  
  const sortedReadings = readings.sort((a, b) => 
    new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
  );
  
  for (let i = 1; i < sortedReadings.length; i++) {
    const older = sortedReadings[i - 1];
    const newer = sortedReadings[i];
    
    // Skip refill events
    if (detectRefill(older, newer)) continue;
    
    const consumption = calculatePercentageConsumption(older, newer);
    const dayOfWeek = new Date(newer.reading_timestamp).getDay();
    
    dayOfWeekConsumption[dayOfWeek] += consumption;
    dayOfWeekCounts[dayOfWeek]++;
  }
  
  // Calculate averages for each day of week
  return dayOfWeekConsumption.map((total, index) => 
    dayOfWeekCounts[index] > 0 ? Number((total / dayOfWeekCounts[index]).toFixed(2)) : 0
  );
};

// Determine overall consumption trend
export const determineConsumptionTrend = (readings: AgbotReading[]): 'increasing' | 'decreasing' | 'stable' => {
  const velocity = calculateConsumptionVelocity(readings);
  
  if (Math.abs(velocity) < 0.1) return 'stable';
  if (velocity > 0) return 'increasing';
  return 'decreasing';
};

// Generate alerts based on analytics
export const generateAlerts = (
  analytics: Partial<AgbotAnalytics>,
  readings: AgbotReading[],
  preSortedDesc?: AgbotReading[] // Optional pre-sorted descending array
): {
  unusual_consumption_alert: boolean;
  potential_leak_alert: boolean;
  device_connectivity_alert: boolean;
} => {
  const rollingAvg = analytics.rolling_avg_pct_per_day || 0;
  const baselineRate = 2.0; // 2% per day baseline

  // Unusual consumption: >50% above baseline
  const unusual_consumption_alert = rollingAvg > (baselineRate * 1.5);

  // Potential leak: consistently high consumption for 3+ days
  // Use pre-sorted array if provided, otherwise sort
  const sortedDesc = preSortedDesc || sortReadingsDesc(readings);
  const recentReadings = sortedDesc.slice(0, 72); // Last 3 days of hourly readings

  const recentHighConsumption = recentReadings.length > 24 &&
    calculateRollingAverage(recentReadings) > (baselineRate * 2);

  const potential_leak_alert = unusual_consumption_alert && recentHighConsumption;

  // Device connectivity: <80% reliability score
  const device_connectivity_alert = (analytics.data_reliability_score || 100) < 80;

  return {
    unusual_consumption_alert,
    potential_leak_alert,
    device_connectivity_alert
  };
};

// ============================================
// OPTIMIZED: Calculate all analytics with single sort
// ============================================

/**
 * Calculate all analytics for a set of readings in a single pass.
 * OPTIMIZATION: Sorts readings ONCE and reuses across all calculations,
 * reducing from 6+ sorts to just 1.
 */
export const calculateAllAgbotAnalytics = (
  readings: AgbotReading[],
  currentPercentage: number,
  criticalThreshold: number = 20,
  baselineRate: number = 2.0,
  capacityLiters: number | null = null
): AgbotAnalytics => {
  if (readings.length < 2) {
    return {
      rolling_avg_pct_per_day: 0,
      prev_day_pct_used: 0,
      prev_day_liters_used: null,
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

  // SINGLE SORT - reused across all calculations
  const sortedAsc = sortReadingsAsc(readings);
  const sortedDesc = [...sortedAsc].reverse(); // O(n) reverse vs O(n log n) sort

  // Calculate core metrics using pre-sorted data
  const rolling_avg_pct_per_day = calculateRollingAverage(sortedAsc);
  const prev_day_pct_used = calculatePreviousDayConsumptionOptimized(sortedDesc);
  const prev_day_liters_used = capacityLiters
    ? (prev_day_pct_used / 100) * capacityLiters
    : null;
  const days_to_critical_level = calculateDaysToCritical(
    currentPercentage,
    rolling_avg_pct_per_day,
    criticalThreshold
  );

  // Calculate advanced metrics
  const consumption_velocity = calculateConsumptionVelocityOptimized(sortedAsc);
  const data_reliability_score = calculateDataReliabilityScoreOptimized(sortedAsc);
  const efficiency_score = calculateEfficiencyScore(rolling_avg_pct_per_day, baselineRate);

  // Analyze patterns using pre-sorted data
  const refillAnalysis = analyzeRefillPatternOptimized(sortedAsc);
  const predicted_next_refill = refillAnalysis.lastRefillDate && refillAnalysis.refillFrequencyDays
    ? new Date(new Date(refillAnalysis.lastRefillDate).getTime() + (refillAnalysis.refillFrequencyDays * 24 * 60 * 60 * 1000)).toISOString()
    : null;

  const weekly_pattern = analyzeWeeklyPatternOptimized(sortedAsc);
  const consumption_trend = consumption_velocity > 0.1 ? 'increasing' :
    consumption_velocity < -0.1 ? 'decreasing' : 'stable';

  // Generate alerts using pre-sorted data
  const alerts = generateAlerts(
    { rolling_avg_pct_per_day, data_reliability_score },
    readings,
    sortedDesc
  );

  return {
    rolling_avg_pct_per_day,
    prev_day_pct_used,
    prev_day_liters_used,
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
  };
};

// Optimized versions that accept pre-sorted arrays
const calculatePreviousDayConsumptionOptimized = (sortedDesc: AgbotReading[]): number => {
  if (sortedDesc.length < 2) return 0;

  const now = new Date();
  const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));

  // Get readings from last 24 hours, sorted chronologically (asc)
  const recentReadings = sortedDesc
    .filter(reading => {
      const readingDate = new Date(reading.reading_timestamp);
      return readingDate >= yesterday && readingDate < now;
    })
    .reverse(); // Convert to ascending order

  if (recentReadings.length < 2) {
    // Fallback: use rolling average
    return calculateRollingAverage(sortedDesc);
  }

  // Sum all decreases in the last 24 hours (hourly summation)
  let dailyConsumption = 0;

  for (let i = 1; i < recentReadings.length; i++) {
    const older = recentReadings[i - 1];
    const newer = recentReadings[i];
    const change = older.calibrated_fill_percentage - newer.calibrated_fill_percentage;

    if (change > NOISE_THRESHOLD_PCT) {
      dailyConsumption += change;
    }
  }

  return Number(dailyConsumption.toFixed(2));
};

const calculateConsumptionVelocityOptimized = (sortedAsc: AgbotReading[]): number => {
  if (sortedAsc.length < 4) return 0;

  const midpoint = Math.floor(sortedAsc.length / 2);
  const firstHalf = sortedAsc.slice(0, midpoint);
  const secondHalf = sortedAsc.slice(midpoint);

  const firstHalfRate = calculateRollingAverage(firstHalf);
  const secondHalfRate = calculateRollingAverage(secondHalf);

  return Number((secondHalfRate - firstHalfRate).toFixed(2));
};

const analyzeRefillPatternOptimized = (sortedAsc: AgbotReading[]): {
  lastRefillDate: string | null;
  refillFrequencyDays: number | null;
  refillEvents: Array<{ date: string; percentageIncrease: number }>;
} => {
  if (sortedAsc.length < 2) {
    return { lastRefillDate: null, refillFrequencyDays: null, refillEvents: [] };
  }

  const refillEvents: Array<{ date: string; percentageIncrease: number }> = [];

  for (let i = 1; i < sortedAsc.length; i++) {
    const older = sortedAsc[i - 1];
    const newer = sortedAsc[i];

    if (detectRefill(older, newer)) {
      refillEvents.push({
        date: newer.reading_timestamp,
        percentageIncrease: newer.calibrated_fill_percentage - older.calibrated_fill_percentage
      });
    }
  }

  if (refillEvents.length === 0) {
    return { lastRefillDate: null, refillFrequencyDays: null, refillEvents: [] };
  }

  let totalDaysBetweenRefills = 0;
  for (let i = 1; i < refillEvents.length; i++) {
    totalDaysBetweenRefills += daysBetween(
      new Date(refillEvents[i - 1].date),
      new Date(refillEvents[i].date)
    );
  }

  const avgDays = refillEvents.length > 1
    ? totalDaysBetweenRefills / (refillEvents.length - 1)
    : null;

  return {
    lastRefillDate: refillEvents[refillEvents.length - 1].date,
    refillFrequencyDays: avgDays ? Number(avgDays.toFixed(1)) : null,
    refillEvents
  };
};

const calculateDataReliabilityScoreOptimized = (sortedAsc: AgbotReading[]): number => {
  if (sortedAsc.length === 0) return 0;

  const onlineReadings = sortedAsc.filter(r => r.device_online);
  const uptime = (onlineReadings.length / sortedAsc.length) * 100;

  let gapPenalty = 0;
  for (let i = 1; i < sortedAsc.length; i++) {
    const hours = daysBetween(
      new Date(sortedAsc[i - 1].reading_timestamp),
      new Date(sortedAsc[i].reading_timestamp)
    ) * 24;

    if (hours > 2) {
      gapPenalty += Math.min(10, hours - 1);
    }
  }

  return Number(Math.max(0, uptime - gapPenalty).toFixed(1));
};

const analyzeWeeklyPatternOptimized = (sortedAsc: AgbotReading[]): number[] => {
  if (sortedAsc.length < 7) return new Array(7).fill(0);

  const dayOfWeekConsumption = new Array(7).fill(0);
  const dayOfWeekCounts = new Array(7).fill(0);

  for (let i = 1; i < sortedAsc.length; i++) {
    const older = sortedAsc[i - 1];
    const newer = sortedAsc[i];

    if (detectRefill(older, newer)) continue;

    const consumption = calculatePercentageConsumption(older, newer);
    const dayOfWeek = new Date(newer.reading_timestamp).getDay();

    dayOfWeekConsumption[dayOfWeek] += consumption;
    dayOfWeekCounts[dayOfWeek]++;
  }

  return dayOfWeekConsumption.map((total, index) =>
    dayOfWeekCounts[index] > 0 ? Number((total / dayOfWeekCounts[index]).toFixed(2)) : 0
  );
};