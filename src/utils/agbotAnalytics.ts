/**
 * Agbot Analytics Helper Functions
 * Percentage-based analytics for cellular tank monitoring
 */

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
  threshold: number = 10
): boolean => {
  if (!olderReading || !newerReading) return false;
  
  const percentageIncrease = newerReading.calibrated_fill_percentage - olderReading.calibrated_fill_percentage;
  return percentageIncrease >= threshold;
};

// Calculate rolling average consumption rate (percentage points per day)
export const calculateRollingAverage = (readings: AgbotReading[]): number => {
  if (readings.length < 2) return 0;
  
  let totalConsumption = 0;
  let totalDays = 0;
  const dailyRates: number[] = [];
  
  for (let i = 1; i < readings.length; i++) {
    const older = readings[i - 1];
    const newer = readings[i];
    
    // Skip if this is a refill event
    if (detectRefill(older, newer)) continue;
    
    const consumption = calculatePercentageConsumption(older, newer);
    const days = daysBetween(new Date(older.reading_timestamp), new Date(newer.reading_timestamp));
    
    if (days > 0 && consumption > 0) {
      const dailyRate = consumption / days;
      dailyRates.push(dailyRate);
      totalConsumption += consumption;
      totalDays += days;
    }
  }
  
  // Return average daily consumption rate
  return totalDays > 0 ? Number((totalConsumption / totalDays).toFixed(2)) : 0;
};

// Calculate previous day consumption
export const calculatePreviousDayConsumption = (readings: AgbotReading[]): number => {
  if (readings.length < 2) return 0;
  
  const now = new Date();
  const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  
  // Find readings from yesterday
  const yesterdayReadings = readings.filter(reading => {
    const readingDate = new Date(reading.reading_timestamp);
    return readingDate >= yesterday && readingDate < now;
  });
  
  if (yesterdayReadings.length < 2) {
    // Fallback: use latest daily rate
    const sortedReadings = readings.sort((a, b) => 
      new Date(b.reading_timestamp).getTime() - new Date(a.reading_timestamp).getTime()
    );
    
    if (sortedReadings.length >= 2) {
      const consumption = calculatePercentageConsumption(sortedReadings[1], sortedReadings[0]);
      const hours = daysBetween(
        new Date(sortedReadings[1].reading_timestamp),
        new Date(sortedReadings[0].reading_timestamp)
      ) * 24;
      
      return hours > 0 ? Number((consumption * 24 / hours).toFixed(2)) : 0;
    }
    
    return 0;
  }
  
  // Calculate consumption over yesterday
  const oldestYesterday = yesterdayReadings[0];
  const newestYesterday = yesterdayReadings[yesterdayReadings.length - 1];
  
  return calculatePercentageConsumption(oldestYesterday, newestYesterday);
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
  readings: AgbotReading[]
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
  const recentReadings = readings
    .sort((a, b) => new Date(b.reading_timestamp).getTime() - new Date(a.reading_timestamp).getTime())
    .slice(0, 72); // Last 3 days of hourly readings
    
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