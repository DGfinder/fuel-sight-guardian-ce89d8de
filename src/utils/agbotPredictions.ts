/**
 * Agbot Predictive Analytics
 * Advanced prediction algorithms for device health, consumption forecasting, and anomaly detection
 */

import { AgbotHistoricalReading } from '@/hooks/useAgbotReadingHistory';
import {
  daysBetween,
  calculateRollingAverage,
  detectRefill,
  analyzeRefillPattern,
  calculateDataReliabilityScore,
  analyzeWeeklyPattern,
  AgbotReading
} from './agbotAnalytics';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface BatteryPrediction {
  currentVoltage: number | null;
  voltageDeclineRate: number; // volts per day
  estimatedDaysRemaining: number | null;
  healthScore: number; // 0-100
  alertLevel: 'good' | 'warning' | 'critical' | 'unknown';
  trend: 'stable' | 'declining' | 'rapid_decline';
  lastReading: string | null;
}

export interface DeviceHealthPrediction {
  assetId: string;
  locationName: string;
  batteryPrediction: BatteryPrediction;
  offlineFrequency: number; // events per week
  avgOfflineDuration: number; // hours
  temperatureVariance: number;
  temperatureAvg: number | null;
  sensorDrift: number; // raw vs calibrated difference trend
  failureProbability: number; // 0-100%
  predictedIssues: string[];
  overallHealth: 'good' | 'warning' | 'critical';
  lastOnline: string | null;
}

export interface ConsumptionForecast {
  assetId: string;
  locationName: string;
  currentLevel: number;
  avgDailyConsumption: number;
  weekdayPattern: number[]; // [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
  predictedEmptyDate: Date | null;
  confidenceInterval: { low: Date | null; high: Date | null };
  optimalRefillDate: Date | null;
  recommendedRefillLevel: number; // % at which to order
  daysRemaining: number | null;
  urgency: 'critical' | 'warning' | 'normal' | 'good';
}

export interface Anomaly {
  id: string;
  assetId: string;
  locationName: string;
  type: 'sudden_drop' | 'unusual_rate' | 'sensor_drift' | 'refill_missing' | 'night_consumption' | 'rapid_decline';
  timestamp: Date;
  severity: 'low' | 'medium' | 'high';
  description: string;
  value?: number;
  expectedValue?: number;
  recommendation: string;
}

export interface AnomalyReport {
  assetId: string;
  anomalies: Anomaly[];
  leakProbability: number; // 0-100
  theftProbability: number; // 0-100
  sensorMalfunctionProbability: number; // 0-100
  overallRiskLevel: 'low' | 'medium' | 'high';
}

export interface FleetHealthScore {
  overallScore: number; // 0-100
  devicesAtRisk: number;
  devicesHealthy: number;
  devicesCritical: number;
  averageBatteryHealth: number;
  averageDataReliability: number;
  activeAnomalies: number;
  refillsDueThisWeek: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Linear regression for trend analysis
 */
function linearRegression(data: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } {
  if (data.length < 2) return { slope: 0, intercept: 0, r2: 0 };

  const n = data.length;
  const sumX = data.reduce((a, b) => a + b.x, 0);
  const sumY = data.reduce((a, b) => a + b.y, 0);
  const sumXY = data.reduce((a, b) => a + b.x * b.y, 0);
  const sumXX = data.reduce((a, b) => a + b.x * b.x, 0);
  const sumYY = data.reduce((a, b) => a + b.y * b.y, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const meanY = sumY / n;
  const ssTotal = data.reduce((sum, point) => sum + Math.pow(point.y - meanY, 2), 0);
  const ssResidual = data.reduce((sum, point) => {
    const predicted = slope * point.x + intercept;
    return sum + Math.pow(point.y - predicted, 2);
  }, 0);
  const r2 = ssTotal === 0 ? 0 : 1 - ssResidual / ssTotal;

  return { slope, intercept, r2 };
}

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Calculate Z-score
 */
function zScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// ============================================
// BATTERY LIFE PREDICTION
// ============================================

const BATTERY_THRESHOLDS = {
  DEAD: 3.0,      // Device stops working
  CRITICAL: 3.3,  // Replace immediately
  WARNING: 3.6,   // Plan replacement
  GOOD: 4.2       // Healthy
};

export function predictBatteryLife(readings: AgbotHistoricalReading[]): BatteryPrediction {
  // Filter readings with valid voltage
  const voltageReadings = readings
    .filter(r => r.device_battery_voltage !== null && r.device_battery_voltage > 0)
    .sort((a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime());

  if (voltageReadings.length < 2) {
    return {
      currentVoltage: voltageReadings[0]?.device_battery_voltage || null,
      voltageDeclineRate: 0,
      estimatedDaysRemaining: null,
      healthScore: voltageReadings[0]?.device_battery_voltage
        ? Math.min(100, ((voltageReadings[0].device_battery_voltage - BATTERY_THRESHOLDS.DEAD) /
          (BATTERY_THRESHOLDS.GOOD - BATTERY_THRESHOLDS.DEAD)) * 100)
        : 50,
      alertLevel: 'unknown',
      trend: 'stable',
      lastReading: voltageReadings[0]?.reading_timestamp || null
    };
  }

  // Prepare data for regression (x = days from start, y = voltage)
  const startTime = new Date(voltageReadings[0].reading_timestamp).getTime();
  const regressionData = voltageReadings.map(r => ({
    x: (new Date(r.reading_timestamp).getTime() - startTime) / (1000 * 60 * 60 * 24), // days
    y: r.device_battery_voltage!
  }));

  const { slope, intercept, r2 } = linearRegression(regressionData);

  const currentVoltage = voltageReadings[voltageReadings.length - 1].device_battery_voltage!;
  const voltageDeclineRate = -slope; // Make positive for decline

  // Calculate days until dead voltage
  let estimatedDaysRemaining: number | null = null;
  if (voltageDeclineRate > 0) {
    estimatedDaysRemaining = Math.max(0, (currentVoltage - BATTERY_THRESHOLDS.DEAD) / voltageDeclineRate);
  }

  // Determine health score (0-100)
  const voltageRange = BATTERY_THRESHOLDS.GOOD - BATTERY_THRESHOLDS.DEAD;
  const healthScore = Math.max(0, Math.min(100,
    ((currentVoltage - BATTERY_THRESHOLDS.DEAD) / voltageRange) * 100
  ));

  // Determine alert level
  let alertLevel: BatteryPrediction['alertLevel'] = 'good';
  if (currentVoltage <= BATTERY_THRESHOLDS.CRITICAL) {
    alertLevel = 'critical';
  } else if (currentVoltage <= BATTERY_THRESHOLDS.WARNING) {
    alertLevel = 'warning';
  }

  // Determine trend
  let trend: BatteryPrediction['trend'] = 'stable';
  if (voltageDeclineRate > 0.01) {
    trend = voltageDeclineRate > 0.05 ? 'rapid_decline' : 'declining';
  }

  return {
    currentVoltage,
    voltageDeclineRate: Number(voltageDeclineRate.toFixed(4)),
    estimatedDaysRemaining: estimatedDaysRemaining !== null ? Math.round(estimatedDaysRemaining) : null,
    healthScore: Math.round(healthScore),
    alertLevel,
    trend,
    lastReading: voltageReadings[voltageReadings.length - 1].reading_timestamp
  };
}

// ============================================
// DEVICE HEALTH PREDICTION
// ============================================

export function predictDeviceHealth(
  readings: AgbotHistoricalReading[],
  assetId: string,
  locationName: string
): DeviceHealthPrediction {
  const batteryPrediction = predictBatteryLife(readings);

  const sortedReadings = [...readings].sort(
    (a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
  );

  // Calculate offline frequency and duration
  let offlineEvents = 0;
  let totalOfflineDuration = 0;
  let currentOfflineStart: Date | null = null;

  for (let i = 0; i < sortedReadings.length; i++) {
    const reading = sortedReadings[i];
    const isOffline = !reading.device_online;

    if (isOffline && !currentOfflineStart) {
      currentOfflineStart = new Date(reading.reading_timestamp);
      offlineEvents++;
    } else if (!isOffline && currentOfflineStart) {
      const offlineDuration = (new Date(reading.reading_timestamp).getTime() - currentOfflineStart.getTime()) / (1000 * 60 * 60);
      totalOfflineDuration += offlineDuration;
      currentOfflineStart = null;
    }
  }

  // Calculate readings span in weeks
  const daysSpan = sortedReadings.length > 1
    ? daysBetween(new Date(sortedReadings[0].reading_timestamp), new Date(sortedReadings[sortedReadings.length - 1].reading_timestamp))
    : 1;
  const weeksSpan = Math.max(1, daysSpan / 7);
  const offlineFrequency = offlineEvents / weeksSpan;
  const avgOfflineDuration = offlineEvents > 0 ? totalOfflineDuration / offlineEvents : 0;

  // Calculate temperature variance
  const temperatures = sortedReadings
    .map(r => r.device_temperature)
    .filter((t): t is number => t !== null);
  const temperatureVariance = standardDeviation(temperatures);
  const temperatureAvg = temperatures.length > 0
    ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length
    : null;

  // Calculate sensor drift (difference between raw and calibrated readings)
  const driftValues = sortedReadings
    .filter(r => r.raw_fill_percentage !== null && r.calibrated_fill_percentage !== null)
    .map(r => Math.abs(r.raw_fill_percentage - r.calibrated_fill_percentage));

  // Check if drift is increasing
  const recentDrift = driftValues.slice(-10);
  const olderDrift = driftValues.slice(0, 10);
  const recentAvgDrift = recentDrift.length > 0 ? recentDrift.reduce((a, b) => a + b, 0) / recentDrift.length : 0;
  const olderAvgDrift = olderDrift.length > 0 ? olderDrift.reduce((a, b) => a + b, 0) / olderDrift.length : 0;
  const sensorDrift = recentAvgDrift - olderAvgDrift;

  // Predict issues
  const predictedIssues: string[] = [];

  if (batteryPrediction.alertLevel === 'critical') {
    predictedIssues.push('Battery replacement needed immediately');
  } else if (batteryPrediction.alertLevel === 'warning') {
    predictedIssues.push('Battery replacement recommended within 30 days');
  }

  if (offlineFrequency > 2) {
    predictedIssues.push('Frequent connectivity issues - check signal strength');
  }

  if (temperatureVariance > 15) {
    predictedIssues.push('High temperature fluctuations - may affect sensor accuracy');
  }

  if (sensorDrift > 5) {
    predictedIssues.push('Increasing sensor drift - calibration may be needed');
  }

  // Calculate failure probability (0-100%)
  let failureProbability = 0;

  // Battery factor (40% weight)
  if (batteryPrediction.alertLevel === 'critical') failureProbability += 40;
  else if (batteryPrediction.alertLevel === 'warning') failureProbability += 20;
  else if (batteryPrediction.trend === 'rapid_decline') failureProbability += 15;

  // Connectivity factor (30% weight)
  if (offlineFrequency > 5) failureProbability += 30;
  else if (offlineFrequency > 2) failureProbability += 15;
  else if (offlineFrequency > 1) failureProbability += 5;

  // Sensor drift factor (20% weight)
  if (sensorDrift > 10) failureProbability += 20;
  else if (sensorDrift > 5) failureProbability += 10;

  // Temperature factor (10% weight)
  if (temperatureVariance > 20) failureProbability += 10;
  else if (temperatureVariance > 15) failureProbability += 5;

  // Overall health
  let overallHealth: DeviceHealthPrediction['overallHealth'] = 'good';
  if (failureProbability > 50 || batteryPrediction.alertLevel === 'critical') {
    overallHealth = 'critical';
  } else if (failureProbability > 25 || batteryPrediction.alertLevel === 'warning') {
    overallHealth = 'warning';
  }

  // Find last online timestamp
  const lastOnlineReading = [...sortedReadings].reverse().find(r => r.device_online);

  return {
    assetId,
    locationName,
    batteryPrediction,
    offlineFrequency: Number(offlineFrequency.toFixed(2)),
    avgOfflineDuration: Number(avgOfflineDuration.toFixed(1)),
    temperatureVariance: Number(temperatureVariance.toFixed(1)),
    temperatureAvg: temperatureAvg !== null ? Number(temperatureAvg.toFixed(1)) : null,
    sensorDrift: Number(sensorDrift.toFixed(2)),
    failureProbability: Math.min(100, Math.round(failureProbability)),
    predictedIssues,
    overallHealth,
    lastOnline: lastOnlineReading?.reading_timestamp || null
  };
}

// ============================================
// CONSUMPTION FORECASTING
// ============================================

export function forecastConsumption(
  readings: AgbotHistoricalReading[],
  assetId: string,
  locationName: string
): ConsumptionForecast {
  const sortedReadings = [...readings].sort(
    (a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
  );

  if (sortedReadings.length < 2) {
    const currentLevel = sortedReadings[0]?.calibrated_fill_percentage || 0;
    return {
      assetId,
      locationName,
      currentLevel,
      avgDailyConsumption: 0,
      weekdayPattern: new Array(7).fill(0),
      predictedEmptyDate: null,
      confidenceInterval: { low: null, high: null },
      optimalRefillDate: null,
      recommendedRefillLevel: 30,
      daysRemaining: null,
      urgency: currentLevel < 20 ? 'critical' : currentLevel < 30 ? 'warning' : 'normal'
    };
  }

  const currentLevel = sortedReadings[sortedReadings.length - 1].calibrated_fill_percentage;

  // Convert to AgbotReading format for existing helpers
  const agbotReadings: AgbotReading[] = sortedReadings.map(r => ({
    calibrated_fill_percentage: r.calibrated_fill_percentage,
    raw_fill_percentage: r.raw_fill_percentage,
    reading_timestamp: r.reading_timestamp,
    device_online: r.device_online,
    created_at: r.created_at
  }));

  // Calculate average daily consumption using existing helper
  const avgDailyConsumption = calculateRollingAverage(agbotReadings);

  // Get weekly pattern
  const weekdayPattern = analyzeWeeklyPattern(agbotReadings);

  // Calculate days remaining with weighted average (more weight on recent data)
  const recentReadings = sortedReadings.slice(-168); // Last 7 days of hourly readings
  const weights = [0.35, 0.25, 0.20, 0.12, 0.08]; // Weights for last 5 periods

  let weightedConsumption = avgDailyConsumption;
  if (recentReadings.length >= 48) {
    const periods: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = Math.floor(recentReadings.length * (i / 5));
      const end = Math.floor(recentReadings.length * ((i + 1) / 5));
      const periodReadings = recentReadings.slice(start, end);
      if (periodReadings.length >= 2) {
        const periodAgbot: AgbotReading[] = periodReadings.map(r => ({
          calibrated_fill_percentage: r.calibrated_fill_percentage,
          raw_fill_percentage: r.raw_fill_percentage,
          reading_timestamp: r.reading_timestamp,
          device_online: r.device_online,
          created_at: r.created_at
        }));
        periods.push(calculateRollingAverage(periodAgbot));
      }
    }

    if (periods.length === 5) {
      weightedConsumption = periods.reduce((sum, rate, i) => sum + rate * weights[i], 0);
    }
  }

  // Calculate predicted empty date
  let predictedEmptyDate: Date | null = null;
  let daysRemaining: number | null = null;

  if (weightedConsumption > 0) {
    daysRemaining = Math.max(0, currentLevel / weightedConsumption);
    predictedEmptyDate = addDays(new Date(), daysRemaining);
  }

  // Calculate confidence interval based on consumption variance
  const dailyRates: number[] = [];
  for (let i = 1; i < sortedReadings.length; i++) {
    const older = sortedReadings[i - 1];
    const newer = sortedReadings[i];

    if (!detectRefill(
      { calibrated_fill_percentage: older.calibrated_fill_percentage, raw_fill_percentage: older.raw_fill_percentage, reading_timestamp: older.reading_timestamp, device_online: older.device_online, created_at: older.created_at },
      { calibrated_fill_percentage: newer.calibrated_fill_percentage, raw_fill_percentage: newer.raw_fill_percentage, reading_timestamp: newer.reading_timestamp, device_online: newer.device_online, created_at: newer.created_at }
    )) {
      const consumption = Math.max(0, older.calibrated_fill_percentage - newer.calibrated_fill_percentage);
      const days = daysBetween(new Date(older.reading_timestamp), new Date(newer.reading_timestamp));
      if (days > 0 && consumption > 0) {
        dailyRates.push(consumption / days);
      }
    }
  }

  const stdDev = standardDeviation(dailyRates);
  let confidenceInterval: ConsumptionForecast['confidenceInterval'] = { low: null, high: null };

  if (weightedConsumption > 0 && stdDev > 0) {
    const lowRate = Math.max(0.1, weightedConsumption - stdDev);
    const highRate = weightedConsumption + stdDev;

    const daysLow = currentLevel / highRate; // Higher rate = fewer days
    const daysHigh = currentLevel / lowRate; // Lower rate = more days

    confidenceInterval = {
      low: addDays(new Date(), daysLow),
      high: addDays(new Date(), daysHigh)
    };
  }

  // Calculate optimal refill date (when to order to avoid running out)
  // Assume 3-5 days delivery time, order at 30%
  const deliveryBuffer = 4; // days
  const safeLevel = 30; // percent
  let optimalRefillDate: Date | null = null;

  if (weightedConsumption > 0 && currentLevel > safeLevel) {
    const daysToSafeLevel = (currentLevel - safeLevel) / weightedConsumption;
    optimalRefillDate = addDays(new Date(), Math.max(0, daysToSafeLevel - deliveryBuffer));
  }

  // Determine urgency
  let urgency: ConsumptionForecast['urgency'] = 'good';
  if (currentLevel <= 20 || (daysRemaining !== null && daysRemaining <= 3)) {
    urgency = 'critical';
  } else if (currentLevel <= 30 || (daysRemaining !== null && daysRemaining <= 7)) {
    urgency = 'warning';
  } else if (currentLevel <= 50 || (daysRemaining !== null && daysRemaining <= 14)) {
    urgency = 'normal';
  }

  return {
    assetId,
    locationName,
    currentLevel: Number(currentLevel.toFixed(1)),
    avgDailyConsumption: Number(weightedConsumption.toFixed(2)),
    weekdayPattern,
    predictedEmptyDate,
    confidenceInterval,
    optimalRefillDate,
    recommendedRefillLevel: 30,
    daysRemaining: daysRemaining !== null ? Math.round(daysRemaining) : null,
    urgency
  };
}

// ============================================
// ANOMALY DETECTION
// ============================================

export function detectAnomalies(
  readings: AgbotHistoricalReading[],
  assetId: string,
  locationName: string
): AnomalyReport {
  const anomalies: Anomaly[] = [];

  const sortedReadings = [...readings].sort(
    (a, b) => new Date(a.reading_timestamp).getTime() - new Date(b.reading_timestamp).getTime()
  );

  if (sortedReadings.length < 10) {
    return {
      assetId,
      anomalies: [],
      leakProbability: 0,
      theftProbability: 0,
      sensorMalfunctionProbability: 0,
      overallRiskLevel: 'low'
    };
  }

  // Calculate baseline consumption rate
  const agbotReadings: AgbotReading[] = sortedReadings.map(r => ({
    calibrated_fill_percentage: r.calibrated_fill_percentage,
    raw_fill_percentage: r.raw_fill_percentage,
    reading_timestamp: r.reading_timestamp,
    device_online: r.device_online,
    created_at: r.created_at
  }));

  const baselineRate = calculateRollingAverage(agbotReadings);

  // Calculate daily consumption rates
  const dailyRates: { date: Date; rate: number; reading: AgbotHistoricalReading }[] = [];

  for (let i = 1; i < sortedReadings.length; i++) {
    const older = sortedReadings[i - 1];
    const newer = sortedReadings[i];

    const olderAgbot: AgbotReading = { calibrated_fill_percentage: older.calibrated_fill_percentage, raw_fill_percentage: older.raw_fill_percentage, reading_timestamp: older.reading_timestamp, device_online: older.device_online, created_at: older.created_at };
    const newerAgbot: AgbotReading = { calibrated_fill_percentage: newer.calibrated_fill_percentage, raw_fill_percentage: newer.raw_fill_percentage, reading_timestamp: newer.reading_timestamp, device_online: newer.device_online, created_at: newer.created_at };

    if (!detectRefill(olderAgbot, newerAgbot)) {
      const consumption = Math.max(0, older.calibrated_fill_percentage - newer.calibrated_fill_percentage);
      const hours = daysBetween(new Date(older.reading_timestamp), new Date(newer.reading_timestamp)) * 24;

      if (hours > 0 && hours < 48) { // Only look at reasonable intervals
        const dailyRate = (consumption / hours) * 24;
        dailyRates.push({
          date: new Date(newer.reading_timestamp),
          rate: dailyRate,
          reading: newer
        });
      }
    }
  }

  const rates = dailyRates.map(d => d.rate);
  const meanRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const stdDevRate = standardDeviation(rates);

  // Detect unusual consumption rates (Z-score > 2)
  for (const entry of dailyRates) {
    const z = zScore(entry.rate, meanRate, stdDevRate);

    if (z > 2.5) {
      anomalies.push({
        id: `unusual-${entry.reading.id}`,
        assetId,
        locationName,
        type: 'unusual_rate',
        timestamp: entry.date,
        severity: z > 3 ? 'high' : 'medium',
        description: `Consumption rate ${entry.rate.toFixed(1)}% per day is ${(z).toFixed(1)} standard deviations above normal`,
        value: entry.rate,
        expectedValue: meanRate,
        recommendation: 'Investigate for potential leak or unauthorized usage'
      });
    }
  }

  // Detect sudden drops (>15% in one reading without refill)
  for (let i = 1; i < sortedReadings.length; i++) {
    const older = sortedReadings[i - 1];
    const newer = sortedReadings[i];

    const drop = older.calibrated_fill_percentage - newer.calibrated_fill_percentage;
    const hours = daysBetween(new Date(older.reading_timestamp), new Date(newer.reading_timestamp)) * 24;

    if (drop > 15 && hours < 24) {
      anomalies.push({
        id: `sudden-drop-${newer.id}`,
        assetId,
        locationName,
        type: 'sudden_drop',
        timestamp: new Date(newer.reading_timestamp),
        severity: drop > 30 ? 'high' : 'medium',
        description: `Sudden ${drop.toFixed(1)}% drop in ${hours.toFixed(1)} hours`,
        value: drop,
        recommendation: 'Check for large withdrawal, theft, or meter malfunction'
      });
    }
  }

  // Detect sensor drift (raw vs calibrated divergence increasing)
  const driftReadings = sortedReadings.filter(
    r => r.raw_fill_percentage !== null && r.calibrated_fill_percentage !== null
  );

  if (driftReadings.length >= 20) {
    const recentDrift = driftReadings.slice(-10)
      .map(r => Math.abs(r.raw_fill_percentage - r.calibrated_fill_percentage));
    const olderDrift = driftReadings.slice(0, 10)
      .map(r => Math.abs(r.raw_fill_percentage - r.calibrated_fill_percentage));

    const recentAvg = recentDrift.reduce((a, b) => a + b, 0) / recentDrift.length;
    const olderAvg = olderDrift.reduce((a, b) => a + b, 0) / olderDrift.length;

    if (recentAvg - olderAvg > 5) {
      anomalies.push({
        id: `sensor-drift-${assetId}`,
        assetId,
        locationName,
        type: 'sensor_drift',
        timestamp: new Date(driftReadings[driftReadings.length - 1].reading_timestamp),
        severity: recentAvg - olderAvg > 10 ? 'high' : 'medium',
        description: `Sensor drift increased by ${(recentAvg - olderAvg).toFixed(1)} percentage points`,
        value: recentAvg,
        expectedValue: olderAvg,
        recommendation: 'Sensor calibration may be required'
      });
    }
  }

  // Detect night-time consumption (potential theft indicator)
  // Assuming business hours are 6am-10pm
  const nightReadings = dailyRates.filter(d => {
    const hour = d.date.getHours();
    return hour >= 22 || hour < 6;
  });

  if (nightReadings.length > 0) {
    const nightAvg = nightReadings.reduce((sum, r) => sum + r.rate, 0) / nightReadings.length;
    const dayReadings = dailyRates.filter(d => {
      const hour = d.date.getHours();
      return hour >= 6 && hour < 22;
    });
    const dayAvg = dayReadings.length > 0
      ? dayReadings.reduce((sum, r) => sum + r.rate, 0) / dayReadings.length
      : meanRate;

    if (nightAvg > dayAvg * 0.5 && nightAvg > 1) { // Significant night consumption
      anomalies.push({
        id: `night-consumption-${assetId}`,
        assetId,
        locationName,
        type: 'night_consumption',
        timestamp: new Date(),
        severity: nightAvg > dayAvg ? 'high' : 'medium',
        description: `Night-time consumption (${nightAvg.toFixed(1)}%/day) is ${((nightAvg / dayAvg) * 100).toFixed(0)}% of daytime rate`,
        value: nightAvg,
        expectedValue: 0,
        recommendation: 'Verify if after-hours operations are expected'
      });
    }
  }

  // Calculate probabilities
  const unusualRateCount = anomalies.filter(a => a.type === 'unusual_rate').length;
  const suddenDropCount = anomalies.filter(a => a.type === 'sudden_drop').length;
  const nightConsumptionCount = anomalies.filter(a => a.type === 'night_consumption').length;
  const sensorDriftCount = anomalies.filter(a => a.type === 'sensor_drift').length;

  const leakProbability = Math.min(100,
    (unusualRateCount * 20) +
    (suddenDropCount * 10)
  );

  const theftProbability = Math.min(100,
    (suddenDropCount * 25) +
    (nightConsumptionCount * 30)
  );

  const sensorMalfunctionProbability = Math.min(100,
    (sensorDriftCount * 40) +
    (unusualRateCount * 10)
  );

  // Overall risk level
  let overallRiskLevel: AnomalyReport['overallRiskLevel'] = 'low';
  const highSeverityCount = anomalies.filter(a => a.severity === 'high').length;
  const mediumSeverityCount = anomalies.filter(a => a.severity === 'medium').length;

  if (highSeverityCount > 0 || mediumSeverityCount >= 3) {
    overallRiskLevel = 'high';
  } else if (mediumSeverityCount > 0 || anomalies.length >= 2) {
    overallRiskLevel = 'medium';
  }

  return {
    assetId,
    anomalies: anomalies.slice(0, 10), // Limit to top 10 anomalies
    leakProbability,
    theftProbability,
    sensorMalfunctionProbability,
    overallRiskLevel
  };
}

// ============================================
// FLEET HEALTH SCORE
// ============================================

export function calculateFleetHealth(
  devicePredictions: DeviceHealthPrediction[],
  consumptionForecasts: ConsumptionForecast[],
  anomalyReports: AnomalyReport[]
): FleetHealthScore {
  if (devicePredictions.length === 0) {
    return {
      overallScore: 100,
      devicesAtRisk: 0,
      devicesHealthy: 0,
      devicesCritical: 0,
      averageBatteryHealth: 100,
      averageDataReliability: 100,
      activeAnomalies: 0,
      refillsDueThisWeek: 0
    };
  }

  const devicesHealthy = devicePredictions.filter(d => d.overallHealth === 'good').length;
  const devicesAtRisk = devicePredictions.filter(d => d.overallHealth === 'warning').length;
  const devicesCritical = devicePredictions.filter(d => d.overallHealth === 'critical').length;

  const batteryScores = devicePredictions
    .map(d => d.batteryPrediction.healthScore)
    .filter(s => s > 0);
  const averageBatteryHealth = batteryScores.length > 0
    ? batteryScores.reduce((a, b) => a + b, 0) / batteryScores.length
    : 100;

  // Calculate average data reliability from failure probabilities (inverse)
  const averageDataReliability = devicePredictions.length > 0
    ? 100 - (devicePredictions.reduce((sum, d) => sum + d.failureProbability, 0) / devicePredictions.length)
    : 100;

  const activeAnomalies = anomalyReports.reduce((sum, r) => sum + r.anomalies.length, 0);

  const refillsDueThisWeek = consumptionForecasts.filter(
    f => f.daysRemaining !== null && f.daysRemaining <= 7
  ).length;

  // Calculate overall fleet health score
  const healthyWeight = devicesHealthy / devicePredictions.length;
  const warningPenalty = (devicesAtRisk / devicePredictions.length) * 0.3;
  const criticalPenalty = (devicesCritical / devicePredictions.length) * 0.6;
  const anomalyPenalty = Math.min(0.2, activeAnomalies * 0.02);

  const overallScore = Math.max(0, Math.min(100,
    (healthyWeight * 100) - (warningPenalty * 100) - (criticalPenalty * 100) - (anomalyPenalty * 100)
  ));

  return {
    overallScore: Math.round(overallScore),
    devicesAtRisk,
    devicesHealthy,
    devicesCritical,
    averageBatteryHealth: Math.round(averageBatteryHealth),
    averageDataReliability: Math.round(averageDataReliability),
    activeAnomalies,
    refillsDueThisWeek
  };
}
