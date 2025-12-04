/**
 * Agbot Predictions Edge Function
 *
 * Performs heavy ML-like calculations server-side:
 * - Battery life prediction via linear regression
 * - Device health analysis
 * - Consumption forecasting
 * - Anomaly detection
 *
 * Reduces client-side computation by ~50%
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// TYPES
// ============================================

interface AgbotReading {
  id: string;
  asset_id: string;
  level_liters: number | null;
  level_percent: number | null;
  raw_percent: number | null;
  is_online: boolean | null;
  battery_voltage: number | null;
  temperature_c: number | null;
  reading_at: string;
}

interface BatteryPrediction {
  currentVoltage: number | null;
  voltageDeclineRate: number;
  estimatedDaysRemaining: number | null;
  healthScore: number;
  alertLevel: 'good' | 'warning' | 'critical' | 'unknown';
  trend: 'stable' | 'declining' | 'rapid_decline';
}

interface ConsumptionForecast {
  currentLevel: number;
  avgDailyConsumption: number;
  daysRemaining: number | null;
  predictedEmptyDate: string | null;
  urgency: 'critical' | 'warning' | 'normal' | 'good';
}

interface Anomaly {
  type: 'sudden_drop' | 'unusual_rate' | 'sensor_drift' | 'night_consumption';
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  value: number;
}

interface PredictionResult {
  assetId: string;
  battery: BatteryPrediction;
  consumption: ConsumptionForecast;
  anomalies: Anomaly[];
  deviceHealth: {
    overallHealth: 'good' | 'warning' | 'critical';
    failureProbability: number;
    offlineFrequency: number;
    sensorDrift: number;
  };
  calculatedAt: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function linearRegression(data: { x: number; y: number }[]): { slope: number; intercept: number } {
  if (data.length < 2) return { slope: 0, intercept: 0 };

  const n = data.length;
  const sumX = data.reduce((a, b) => a + b.x, 0);
  const sumY = data.reduce((a, b) => a + b.y, 0);
  const sumXY = data.reduce((a, b) => a + b.x * b.y, 0);
  const sumXX = data.reduce((a, b) => a + b.x * b.x, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

function daysBetween(date1: Date, date2: Date): number {
  return Math.abs(date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24);
}

// ============================================
// PREDICTION FUNCTIONS
// ============================================

const BATTERY_THRESHOLDS = {
  DEAD: 3.0,
  CRITICAL: 3.3,
  WARNING: 3.6,
  GOOD: 4.2
};

function predictBatteryLife(readings: AgbotReading[]): BatteryPrediction {
  const voltageReadings = readings
    .filter(r => r.battery_voltage !== null && r.battery_voltage > 0)
    .sort((a, b) => new Date(a.reading_at).getTime() - new Date(b.reading_at).getTime());

  if (voltageReadings.length < 2) {
    const currentVoltage = voltageReadings[0]?.battery_voltage || null;
    return {
      currentVoltage,
      voltageDeclineRate: 0,
      estimatedDaysRemaining: null,
      healthScore: currentVoltage
        ? Math.min(100, ((currentVoltage - BATTERY_THRESHOLDS.DEAD) /
            (BATTERY_THRESHOLDS.GOOD - BATTERY_THRESHOLDS.DEAD)) * 100)
        : 50,
      alertLevel: 'unknown',
      trend: 'stable'
    };
  }

  const startTime = new Date(voltageReadings[0].reading_at).getTime();
  const regressionData = voltageReadings.map(r => ({
    x: (new Date(r.reading_at).getTime() - startTime) / (1000 * 60 * 60 * 24),
    y: r.battery_voltage!
  }));

  const { slope } = linearRegression(regressionData);
  const currentVoltage = voltageReadings[voltageReadings.length - 1].battery_voltage!;
  const voltageDeclineRate = -slope;

  let estimatedDaysRemaining: number | null = null;
  if (voltageDeclineRate > 0) {
    estimatedDaysRemaining = Math.max(0, (currentVoltage - BATTERY_THRESHOLDS.DEAD) / voltageDeclineRate);
  }

  const voltageRange = BATTERY_THRESHOLDS.GOOD - BATTERY_THRESHOLDS.DEAD;
  const healthScore = Math.max(0, Math.min(100,
    ((currentVoltage - BATTERY_THRESHOLDS.DEAD) / voltageRange) * 100
  ));

  let alertLevel: BatteryPrediction['alertLevel'] = 'good';
  if (currentVoltage <= BATTERY_THRESHOLDS.CRITICAL) alertLevel = 'critical';
  else if (currentVoltage <= BATTERY_THRESHOLDS.WARNING) alertLevel = 'warning';

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
    trend
  };
}

function forecastConsumption(readings: AgbotReading[]): ConsumptionForecast {
  const sortedReadings = [...readings]
    .filter(r => r.level_percent !== null)
    .sort((a, b) => new Date(a.reading_at).getTime() - new Date(b.reading_at).getTime());

  if (sortedReadings.length < 2) {
    const currentLevel = sortedReadings[0]?.level_percent || 0;
    return {
      currentLevel,
      avgDailyConsumption: 0,
      daysRemaining: null,
      predictedEmptyDate: null,
      urgency: currentLevel < 20 ? 'critical' : currentLevel < 30 ? 'warning' : 'normal'
    };
  }

  const currentLevel = sortedReadings[sortedReadings.length - 1].level_percent!;

  // Calculate daily consumption rates (excluding refills)
  const dailyRates: number[] = [];
  for (let i = 1; i < sortedReadings.length; i++) {
    const older = sortedReadings[i - 1];
    const newer = sortedReadings[i];

    if (older.level_percent !== null && newer.level_percent !== null) {
      const consumption = older.level_percent - newer.level_percent;

      // Skip refills (level increased) and unreasonable drops
      if (consumption > 0 && consumption < 20) {
        const days = daysBetween(new Date(older.reading_at), new Date(newer.reading_at));
        if (days > 0 && days < 7) {
          dailyRates.push(consumption / days);
        }
      }
    }
  }

  const avgDailyConsumption = dailyRates.length > 0
    ? dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length
    : 0;

  let daysRemaining: number | null = null;
  let predictedEmptyDate: string | null = null;

  if (avgDailyConsumption > 0) {
    daysRemaining = Math.max(0, currentLevel / avgDailyConsumption);
    const emptyDate = new Date();
    emptyDate.setDate(emptyDate.getDate() + daysRemaining);
    predictedEmptyDate = emptyDate.toISOString();
  }

  let urgency: ConsumptionForecast['urgency'] = 'good';
  if (currentLevel <= 20 || (daysRemaining !== null && daysRemaining <= 3)) {
    urgency = 'critical';
  } else if (currentLevel <= 30 || (daysRemaining !== null && daysRemaining <= 7)) {
    urgency = 'warning';
  } else if (currentLevel <= 50 || (daysRemaining !== null && daysRemaining <= 14)) {
    urgency = 'normal';
  }

  return {
    currentLevel: Number(currentLevel.toFixed(1)),
    avgDailyConsumption: Number(avgDailyConsumption.toFixed(2)),
    daysRemaining: daysRemaining !== null ? Math.round(daysRemaining) : null,
    predictedEmptyDate,
    urgency
  };
}

function detectAnomalies(readings: AgbotReading[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const sortedReadings = [...readings]
    .filter(r => r.level_percent !== null)
    .sort((a, b) => new Date(a.reading_at).getTime() - new Date(b.reading_at).getTime());

  if (sortedReadings.length < 10) return [];

  // Calculate baseline consumption rate
  const dailyRates: { date: Date; rate: number }[] = [];
  for (let i = 1; i < sortedReadings.length; i++) {
    const older = sortedReadings[i - 1];
    const newer = sortedReadings[i];

    if (older.level_percent !== null && newer.level_percent !== null) {
      const consumption = older.level_percent - newer.level_percent;

      // Skip refills
      if (consumption > 0 && consumption < 50) {
        const hours = daysBetween(new Date(older.reading_at), new Date(newer.reading_at)) * 24;
        if (hours > 0 && hours < 48) {
          dailyRates.push({
            date: new Date(newer.reading_at),
            rate: (consumption / hours) * 24
          });
        }
      }
    }
  }

  const rates = dailyRates.map(d => d.rate);
  const meanRate = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const stdDevRate = standardDeviation(rates);

  // Detect unusual rates (Z-score > 2.5)
  for (const entry of dailyRates) {
    if (stdDevRate > 0) {
      const z = (entry.rate - meanRate) / stdDevRate;
      if (z > 2.5) {
        anomalies.push({
          type: 'unusual_rate',
          timestamp: entry.date.toISOString(),
          severity: z > 3 ? 'high' : 'medium',
          description: `Consumption rate ${entry.rate.toFixed(1)}% per day is ${z.toFixed(1)} std devs above normal`,
          value: entry.rate
        });
      }
    }
  }

  // Detect sudden drops (>15% in < 24 hours)
  for (let i = 1; i < sortedReadings.length; i++) {
    const older = sortedReadings[i - 1];
    const newer = sortedReadings[i];

    if (older.level_percent !== null && newer.level_percent !== null) {
      const drop = older.level_percent - newer.level_percent;
      const hours = daysBetween(new Date(older.reading_at), new Date(newer.reading_at)) * 24;

      if (drop > 15 && hours < 24) {
        anomalies.push({
          type: 'sudden_drop',
          timestamp: newer.reading_at,
          severity: drop > 30 ? 'high' : 'medium',
          description: `Sudden ${drop.toFixed(1)}% drop in ${hours.toFixed(1)} hours`,
          value: drop
        });
      }
    }
  }

  return anomalies.slice(0, 10); // Limit to top 10
}

function calculateDeviceHealth(readings: AgbotReading[], battery: BatteryPrediction) {
  const sortedReadings = [...readings].sort(
    (a, b) => new Date(a.reading_at).getTime() - new Date(b.reading_at).getTime()
  );

  // Calculate offline frequency
  let offlineEvents = 0;
  for (let i = 1; i < sortedReadings.length; i++) {
    if (!sortedReadings[i].is_online && sortedReadings[i - 1].is_online) {
      offlineEvents++;
    }
  }
  const daysSpan = sortedReadings.length > 1
    ? daysBetween(new Date(sortedReadings[0].reading_at), new Date(sortedReadings[sortedReadings.length - 1].reading_at))
    : 1;
  const offlineFrequency = offlineEvents / Math.max(1, daysSpan / 7);

  // Calculate sensor drift (raw vs calibrated)
  const driftReadings = sortedReadings.filter(r => r.raw_percent !== null && r.level_percent !== null);
  let sensorDrift = 0;
  if (driftReadings.length >= 20) {
    const recentDrift = driftReadings.slice(-10).map(r => Math.abs(r.raw_percent! - r.level_percent!));
    const olderDrift = driftReadings.slice(0, 10).map(r => Math.abs(r.raw_percent! - r.level_percent!));
    const recentAvg = recentDrift.reduce((a, b) => a + b, 0) / recentDrift.length;
    const olderAvg = olderDrift.reduce((a, b) => a + b, 0) / olderDrift.length;
    sensorDrift = recentAvg - olderAvg;
  }

  // Calculate failure probability
  let failureProbability = 0;
  if (battery.alertLevel === 'critical') failureProbability += 40;
  else if (battery.alertLevel === 'warning') failureProbability += 20;
  else if (battery.trend === 'rapid_decline') failureProbability += 15;

  if (offlineFrequency > 5) failureProbability += 30;
  else if (offlineFrequency > 2) failureProbability += 15;

  if (sensorDrift > 10) failureProbability += 20;
  else if (sensorDrift > 5) failureProbability += 10;

  let overallHealth: 'good' | 'warning' | 'critical' = 'good';
  if (failureProbability > 50 || battery.alertLevel === 'critical') {
    overallHealth = 'critical';
  } else if (failureProbability > 25 || battery.alertLevel === 'warning') {
    overallHealth = 'warning';
  }

  return {
    overallHealth,
    failureProbability: Math.min(100, Math.round(failureProbability)),
    offlineFrequency: Number(offlineFrequency.toFixed(2)),
    sensorDrift: Number(sensorDrift.toFixed(2))
  };
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
    const { asset_id, days_back = 30 } = await req.json();

    if (!asset_id) {
      return new Response(
        JSON.stringify({ error: 'asset_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch readings for this asset
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days_back);

    const { data: readings, error } = await supabase
      .schema('great_southern_fuels').from('ta_agbot_readings')
      .select('*')
      .eq('asset_id', asset_id)
      .gte('reading_at', startDate.toISOString())
      .order('reading_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch readings: ${error.message}`);
    }

    if (!readings || readings.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No readings found for asset', asset_id }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Calculate all predictions
    const battery = predictBatteryLife(readings);
    const consumption = forecastConsumption(readings);
    const anomalies = detectAnomalies(readings);
    const deviceHealth = calculateDeviceHealth(readings, battery);

    const result: PredictionResult = {
      assetId: asset_id,
      battery,
      consumption,
      anomalies,
      deviceHealth,
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
    console.error('Error in agbot-predictions:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
