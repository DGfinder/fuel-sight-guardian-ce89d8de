/**
 * Consumption Anomaly Detection Service
 *
 * Detects unusual fuel consumption patterns for all industry types:
 * - Spikes: Unusually high consumption (equipment issues, theft, demand increase)
 * - Drops: Unusually low consumption (equipment offline, shutdown, sensor issues)
 * - Pattern changes: Sustained deviation from normal
 */

import { baselineCalculator, type BaselineResult, type DailyConsumption } from './agricultural/baseline-calculator';
import type { IndustryType } from '@/hooks/useCustomerFeatures';

export type AnomalyType = 'spike' | 'drop' | 'pattern_change';
export type AnomalySeverity = 'info' | 'warning' | 'alert';

export interface AnomalyResult {
  hasAnomaly: boolean;
  type: AnomalyType | null;
  severity: AnomalySeverity;
  deviationPercent: number;
  possibleCauses: AnomalyCause[];
  recommendation: string;
  baseline: BaselineResult | null;
  recentConsumption: number; // L/day or %/day
}

export interface AnomalyCause {
  cause: string;
  likelihood: 'low' | 'medium' | 'high';
  industryRelevance: IndustryType[];
}

// Thresholds for anomaly detection
const THRESHOLDS = {
  spikePercent: 30, // >30% above baseline = spike
  dropPercent: 40, // >40% below baseline = drop
  patternChangeDays: 3, // 3+ consecutive days of deviation = pattern change
  severityMultipliers: {
    info: 1.3, // 30-50% deviation
    warning: 1.5, // 50-100% deviation
    alert: 2.0, // >100% deviation
  },
};

// Industry-specific cause suggestions
const SPIKE_CAUSES: AnomalyCause[] = [
  // Mining
  { cause: 'Additional equipment deployed', likelihood: 'high', industryRelevance: ['mining'] },
  { cause: 'Increased haul distances', likelihood: 'medium', industryRelevance: ['mining'] },
  { cause: 'Generator running longer shifts', likelihood: 'high', industryRelevance: ['mining'] },
  { cause: 'Equipment inefficiency in extreme heat', likelihood: 'medium', industryRelevance: ['mining'] },

  // General/Industrial
  { cause: 'Seasonal demand increase', likelihood: 'high', industryRelevance: ['general'] },
  { cause: 'New equipment added', likelihood: 'medium', industryRelevance: ['general'] },
  { cause: 'Extended operating hours', likelihood: 'high', industryRelevance: ['general'] },
  { cause: 'Equipment running less efficiently', likelihood: 'medium', industryRelevance: ['general'] },

  // All industries
  { cause: 'Possible fuel theft', likelihood: 'low', industryRelevance: ['mining', 'general', 'farming'] },
  { cause: 'Measurement calibration issue', likelihood: 'low', industryRelevance: ['mining', 'general', 'farming'] },
];

const DROP_CAUSES: AnomalyCause[] = [
  // Mining
  { cause: 'Equipment breakdown or maintenance', likelihood: 'high', industryRelevance: ['mining'] },
  { cause: 'Shift reduction or roster change', likelihood: 'medium', industryRelevance: ['mining'] },
  { cause: 'Site wind-down or partial shutdown', likelihood: 'medium', industryRelevance: ['mining'] },
  { cause: 'Weather-related operational pause', likelihood: 'medium', industryRelevance: ['mining'] },

  // General/Industrial
  { cause: 'Reduced operations or demand', likelihood: 'high', industryRelevance: ['general'] },
  { cause: 'Equipment offline for maintenance', likelihood: 'medium', industryRelevance: ['general'] },
  { cause: 'Holiday or scheduled shutdown', likelihood: 'high', industryRelevance: ['general'] },
  { cause: 'Efficiency improvement', likelihood: 'low', industryRelevance: ['general'] },

  // All industries
  { cause: 'Sensor malfunction or data gap', likelihood: 'medium', industryRelevance: ['mining', 'general', 'farming'] },
  { cause: 'Measurement error', likelihood: 'low', industryRelevance: ['mining', 'general', 'farming'] },
];

/**
 * Detect consumption anomalies
 */
export function detectAnomaly(
  recentConsumption: number, // L/day average over last 3-7 days
  baseline: BaselineResult | null,
  industryType: IndustryType,
  thresholdPercent: number = THRESHOLDS.spikePercent
): AnomalyResult {
  // If no baseline, we can't detect anomalies
  if (!baseline || baseline.baselineLitersPerDay === null || baseline.baselineLitersPerDay === 0) {
    return {
      hasAnomaly: false,
      type: null,
      severity: 'info',
      deviationPercent: 0,
      possibleCauses: [],
      recommendation: 'Insufficient historical data to detect anomalies.',
      baseline,
      recentConsumption,
    };
  }

  const baselineValue = baseline.baselineLitersPerDay;
  const deviation = ((recentConsumption - baselineValue) / baselineValue) * 100;
  const absDeviation = Math.abs(deviation);

  // Determine anomaly type
  let type: AnomalyType | null = null;
  if (deviation > thresholdPercent) {
    type = 'spike';
  } else if (deviation < -THRESHOLDS.dropPercent) {
    type = 'drop';
  }

  // Determine severity
  let severity: AnomalySeverity = 'info';
  if (absDeviation >= 100) {
    severity = 'alert';
  } else if (absDeviation >= 50) {
    severity = 'warning';
  }

  // Get relevant causes
  const allCauses = type === 'spike' ? SPIKE_CAUSES : type === 'drop' ? DROP_CAUSES : [];
  const possibleCauses = allCauses.filter(
    (cause) => cause.industryRelevance.includes(industryType)
  );

  // Generate recommendation
  let recommendation = '';
  if (type === 'spike') {
    recommendation = severity === 'alert'
      ? `Consumption is ${absDeviation.toFixed(0)}% above normal. Investigate possible causes immediately.`
      : severity === 'warning'
        ? `Consumption is elevated (${absDeviation.toFixed(0)}% above normal). Monitor closely.`
        : `Slightly elevated consumption detected (${absDeviation.toFixed(0)}% above normal).`;
  } else if (type === 'drop') {
    recommendation = severity === 'alert'
      ? `Consumption is ${absDeviation.toFixed(0)}% below normal. Check if operations are running correctly.`
      : severity === 'warning'
        ? `Lower than expected consumption (${absDeviation.toFixed(0)}% below normal). Verify equipment status.`
        : `Slightly lower consumption detected (${absDeviation.toFixed(0)}% below normal).`;
  } else {
    recommendation = 'Consumption is within normal range.';
  }

  return {
    hasAnomaly: type !== null,
    type,
    severity,
    deviationPercent: Math.round(deviation * 100) / 100,
    possibleCauses,
    recommendation,
    baseline,
    recentConsumption,
  };
}

/**
 * Detect pattern changes over multiple days
 */
export function detectPatternChange(
  dailyConsumptions: DailyConsumption[],
  baseline: BaselineResult | null,
  industryType: IndustryType
): AnomalyResult | null {
  if (!baseline || dailyConsumptions.length < THRESHOLDS.patternChangeDays) {
    return null;
  }

  // Look at last 7 days
  const recentDays = dailyConsumptions.slice(-7);
  const baselineValue = baseline.baselinePctPerDay;

  // Count consecutive days of deviation in same direction
  let consecutiveSpikeDays = 0;
  let consecutiveDropDays = 0;
  let currentStreak = 0;
  let streakType: 'spike' | 'drop' | null = null;

  for (const day of recentDays) {
    const deviation = ((day.consumptionPct - baselineValue) / baselineValue) * 100;

    if (deviation > THRESHOLDS.spikePercent * 0.7) {
      // 70% of threshold for pattern detection
      if (streakType === 'spike') {
        currentStreak++;
      } else {
        currentStreak = 1;
        streakType = 'spike';
      }
      consecutiveSpikeDays = Math.max(consecutiveSpikeDays, currentStreak);
    } else if (deviation < -THRESHOLDS.dropPercent * 0.7) {
      if (streakType === 'drop') {
        currentStreak++;
      } else {
        currentStreak = 1;
        streakType = 'drop';
      }
      consecutiveDropDays = Math.max(consecutiveDropDays, currentStreak);
    } else {
      currentStreak = 0;
      streakType = null;
    }
  }

  // Pattern change if 3+ consecutive days
  if (consecutiveSpikeDays >= THRESHOLDS.patternChangeDays) {
    const avgRecent = recentDays
      .slice(-consecutiveSpikeDays)
      .reduce((sum, d) => sum + d.consumptionPct, 0) / consecutiveSpikeDays;

    return {
      hasAnomaly: true,
      type: 'pattern_change',
      severity: 'warning',
      deviationPercent: ((avgRecent - baselineValue) / baselineValue) * 100,
      possibleCauses: SPIKE_CAUSES.filter((c) => c.industryRelevance.includes(industryType)),
      recommendation: `Consumption has been elevated for ${consecutiveSpikeDays} consecutive days. This may indicate a change in operations.`,
      baseline,
      recentConsumption: baseline.baselineLitersPerDay
        ? (avgRecent / baseline.baselinePctPerDay) * baseline.baselineLitersPerDay
        : avgRecent,
    };
  }

  if (consecutiveDropDays >= THRESHOLDS.patternChangeDays) {
    const avgRecent = recentDays
      .slice(-consecutiveDropDays)
      .reduce((sum, d) => sum + d.consumptionPct, 0) / consecutiveDropDays;

    return {
      hasAnomaly: true,
      type: 'pattern_change',
      severity: 'info',
      deviationPercent: ((avgRecent - baselineValue) / baselineValue) * 100,
      possibleCauses: DROP_CAUSES.filter((c) => c.industryRelevance.includes(industryType)),
      recommendation: `Consumption has been lower than usual for ${consecutiveDropDays} consecutive days. Everything okay?`,
      baseline,
      recentConsumption: baseline.baselineLitersPerDay
        ? (avgRecent / baseline.baselinePctPerDay) * baseline.baselineLitersPerDay
        : avgRecent,
    };
  }

  return null;
}

/**
 * Get friendly description of anomaly for UI
 */
export function getAnomalyDescription(result: AnomalyResult): {
  title: string;
  subtitle: string;
  icon: 'trending-up' | 'trending-down' | 'activity';
} {
  if (!result.hasAnomaly) {
    return {
      title: 'Normal Consumption',
      subtitle: 'Fuel usage is within expected range',
      icon: 'activity',
    };
  }

  if (result.type === 'spike') {
    return {
      title: 'Higher Than Usual',
      subtitle: `Consumption is ${Math.abs(result.deviationPercent).toFixed(0)}% above your normal`,
      icon: 'trending-up',
    };
  }

  if (result.type === 'drop') {
    return {
      title: 'Lower Than Expected',
      subtitle: `Consumption is ${Math.abs(result.deviationPercent).toFixed(0)}% below your normal`,
      icon: 'trending-down',
    };
  }

  // Pattern change
  return {
    title: 'Unusual Pattern Detected',
    subtitle: `Sustained ${result.deviationPercent > 0 ? 'elevated' : 'reduced'} consumption`,
    icon: 'activity',
  };
}

// Export service
export const consumptionAnomalyService = {
  detectAnomaly,
  detectPatternChange,
  getAnomalyDescription,
};

export default consumptionAnomalyService;
