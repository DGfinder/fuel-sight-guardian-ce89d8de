/**
 * Extreme Weather Detection Service
 *
 * Detects extreme weather events relevant to mining and general/industrial customers:
 * - Extreme heat (equipment impact, worker safety)
 * - Cyclones/storms (site access, safety)
 * - Heavy rain (site access, operations)
 */

import { WeatherForecast } from './types';
import type { IndustryType } from '@/hooks/useCustomerFeatures';
import {
  detectRegion,
  getRegionConfig,
  shouldShowWeatherDeliveryAlerts,
  isSevereFlooding,
} from '@/lib/region-detector';

export type ExtremeWeatherType = 'extreme_heat' | 'cyclone' | 'storm' | 'heavy_rain';
export type WeatherSeverity = 'watch' | 'warning' | 'alert';

export interface ExtremeWeatherEvent {
  type: ExtremeWeatherType;
  severity: WeatherSeverity;
  startDate: Date;
  endDate: Date;
  peakValue: number; // Temperature in °C or rainfall in mm or wind in km/h
  impact: WeatherImpact;
  recommendations: string[];
}

export interface WeatherImpact {
  equipmentRisk: 'low' | 'moderate' | 'high';
  siteAccessRisk: 'low' | 'moderate' | 'high';
  workerSafetyRisk: 'low' | 'moderate' | 'high';
  fuelConsumptionMultiplier: number; // 1.0 = normal, 1.2 = 20% increase
  advisory: string;
}

// Industry-specific thresholds
// NOTE: "38 is a nice day in mining" - heat threshold raised to 45°C based on real-world feedback
const THRESHOLDS = {
  mining: {
    extremeHeat: 45, // °C - only truly extreme heat matters for mining
    cycloneWind: 90, // km/h - cyclone warning
    stormWind: 60, // km/h - storm warning
    heavyRain24h: 40, // mm - road/site access (only for remote areas)
    heavyRain48h: 60, // mm - extended impact
  },
  general: {
    extremeHeat: 45, // °C - same threshold as mining
    cycloneWind: 90, // km/h - cyclone warning
    stormWind: 50, // km/h - storm warning
    heavyRain24h: 25, // mm - site access (rarely matters for urban)
    heavyRain48h: 40, // mm - extended impact
  },
};

export class ExtremeWeatherDetector {
  /**
   * Detect all extreme weather events from forecast
   */
  detectEvents(
    weather: WeatherForecast,
    industryType: IndustryType,
    lat?: number,
    lng?: number
  ): ExtremeWeatherEvent[] {
    const events: ExtremeWeatherEvent[] = [];
    const thresholds = industryType === 'mining' ? THRESHOLDS.mining : THRESHOLDS.general;

    // Detect extreme heat events
    const heatEvents = this.detectExtremeHeat(weather, thresholds, industryType);
    events.push(...heatEvents);

    // Detect cyclone risk (primarily for mining in Pilbara)
    if (industryType === 'mining' && this.isPilbaraRegion(lat, lng)) {
      const cycloneEvents = this.detectCycloneRisk(weather, thresholds);
      events.push(...cycloneEvents);
    }

    // Detect storms
    const stormEvents = this.detectStorms(weather, thresholds, industryType);
    events.push(...stormEvents);

    // Detect heavy rain (region-aware - only alerts for Kalgoorlie/Pilbara or severe floods)
    const rainEvents = this.detectHeavyRain(weather, thresholds, industryType, lat, lng);
    events.push(...rainEvents);

    // Sort by severity (alert > warning > watch) then by start date
    return events.sort((a, b) => {
      const severityOrder = { alert: 0, warning: 1, watch: 2 };
      const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (sevDiff !== 0) return sevDiff;
      return a.startDate.getTime() - b.startDate.getTime();
    });
  }

  /**
   * Detect extreme heat events
   */
  private detectExtremeHeat(
    weather: WeatherForecast,
    thresholds: typeof THRESHOLDS.mining,
    industryType: IndustryType
  ): ExtremeWeatherEvent[] {
    const events: ExtremeWeatherEvent[] = [];
    const daily = weather.daily;

    let eventStart: Date | null = null;
    let eventEnd: Date | null = null;
    let peakTemp = 0;
    let consecutiveHotDays = 0;

    for (let i = 0; i < daily.temperature_2m_max.length; i++) {
      const maxTemp = daily.temperature_2m_max[i];
      const date = new Date(daily.time[i]);

      // Only trigger heat events at 45°C+ (was 35°C - too sensitive for mining)
      if (maxTemp >= thresholds.extremeHeat) {
        if (!eventStart) {
          eventStart = date;
        }
        eventEnd = date;
        peakTemp = Math.max(peakTemp, maxTemp);
        consecutiveHotDays++;
      } else if (eventStart) {
        // Event ended, create it
        events.push(this.createHeatEvent(
          eventStart,
          eventEnd!,
          peakTemp,
          consecutiveHotDays,
          thresholds,
          industryType
        ));
        eventStart = null;
        eventEnd = null;
        peakTemp = 0;
        consecutiveHotDays = 0;
      }
    }

    // Don't forget ongoing event at end of forecast
    if (eventStart && consecutiveHotDays >= 1) {
      events.push(this.createHeatEvent(
        eventStart,
        eventEnd!,
        peakTemp,
        consecutiveHotDays,
        thresholds,
        industryType
      ));
    }

    return events;
  }

  private createHeatEvent(
    startDate: Date,
    endDate: Date,
    peakTemp: number,
    consecutiveDays: number,
    _thresholds: typeof THRESHOLDS.mining,
    industryType: IndustryType
  ): ExtremeWeatherEvent {
    // Since we only trigger at 45°C+, everything is now "extreme"
    // Severity based on duration: 3+ days = alert, otherwise warning
    const severity: WeatherSeverity = consecutiveDays >= 3 ? 'alert' : 'warning';
    const fuelMultiplier = 1.2; // 20% increase for extreme heat

    const recommendations: string[] = industryType === 'mining'
      ? [
          'Schedule equipment cooling breaks during peak heat',
          `Expect ~20% higher fuel consumption for generators/cooling`,
          'Consider delivery before heat wave',
        ]
      : [
          'Limit outdoor operations during peak heat hours',
          'Ensure cooling equipment is operational',
        ];

    return {
      type: 'extreme_heat',
      severity,
      startDate,
      endDate,
      peakValue: peakTemp,
      impact: {
        equipmentRisk: 'high',
        siteAccessRisk: 'low',
        workerSafetyRisk: 'high',
        fuelConsumptionMultiplier: fuelMultiplier,
        advisory: `Extreme heat of ${peakTemp.toFixed(0)}°C expected. Equipment efficiency will be reduced.`,
      },
      recommendations,
    };
  }

  /**
   * Detect cyclone risk (Pilbara region)
   */
  private detectCycloneRisk(
    weather: WeatherForecast,
    thresholds: typeof THRESHOLDS.mining
  ): ExtremeWeatherEvent[] {
    const events: ExtremeWeatherEvent[] = [];
    const daily = weather.daily;

    for (let i = 0; i < daily.windspeed_10m_max.length; i++) {
      const windSpeed = daily.windspeed_10m_max[i];
      const rain = daily.rain_sum[i] || 0;
      const date = new Date(daily.time[i]);

      if (windSpeed >= thresholds.cycloneWind) {
        const severity: WeatherSeverity = windSpeed >= 120 ? 'alert' : 'warning';

        events.push({
          type: 'cyclone',
          severity,
          startDate: date,
          endDate: new Date(date.getTime() + 24 * 60 * 60 * 1000), // Next day
          peakValue: windSpeed,
          impact: {
            equipmentRisk: 'high',
            siteAccessRisk: 'high',
            workerSafetyRisk: 'high',
            fuelConsumptionMultiplier: 0.5, // Reduced operations
            advisory: `Cyclonic conditions with ${windSpeed.toFixed(0)}km/h winds and ${rain.toFixed(0)}mm rain expected.`,
          },
          recommendations: [
            'Secure all equipment and materials',
            'Consider site evacuation per safety protocols',
            'Ensure emergency fuel reserves are adequate',
            'Plan for multi-day site closure',
          ],
        });
      }
    }

    return events;
  }

  /**
   * Detect storm events
   */
  private detectStorms(
    weather: WeatherForecast,
    thresholds: typeof THRESHOLDS.mining,
    industryType: IndustryType
  ): ExtremeWeatherEvent[] {
    const events: ExtremeWeatherEvent[] = [];
    const daily = weather.daily;

    for (let i = 0; i < daily.windspeed_10m_max.length; i++) {
      const windSpeed = daily.windspeed_10m_max[i];
      const rain = daily.rain_sum[i] || 0;
      const date = new Date(daily.time[i]);

      // Storm: high wind + rain, but not cyclone level
      if (windSpeed >= thresholds.stormWind && windSpeed < thresholds.cycloneWind && rain >= 10) {
        const severity: WeatherSeverity = windSpeed >= 70 ? 'warning' : 'watch';

        const recommendations: string[] = industryType === 'mining'
          ? [
              'Secure loose equipment and materials',
              'Monitor road conditions closely',
              'Be prepared for temporary site access disruption',
            ]
          : [
              'Secure outdoor equipment',
              'Check site drainage',
              'Consider rescheduling outdoor deliveries',
            ];

        events.push({
          type: 'storm',
          severity,
          startDate: date,
          endDate: new Date(date.getTime() + 24 * 60 * 60 * 1000),
          peakValue: windSpeed,
          impact: {
            equipmentRisk: 'moderate',
            siteAccessRisk: 'moderate',
            workerSafetyRisk: 'moderate',
            fuelConsumptionMultiplier: 0.9, // Slightly reduced operations
            advisory: `Storm conditions with ${windSpeed.toFixed(0)}km/h winds and ${rain.toFixed(0)}mm rain expected.`,
          },
          recommendations,
        });
      }
    }

    return events;
  }

  /**
   * Detect heavy rain events
   * IMPORTANT: Only shows rain alerts for regions where it matters (Kalgoorlie, Pilbara)
   * or when rainfall is severe enough to affect any location
   */
  private detectHeavyRain(
    weather: WeatherForecast,
    thresholds: typeof THRESHOLDS.mining,
    industryType: IndustryType,
    lat?: number,
    lng?: number
  ): ExtremeWeatherEvent[] {
    const events: ExtremeWeatherEvent[] = [];
    const daily = weather.daily;

    // Check if this region cares about rain-based delivery alerts
    const regionCaresAboutRain = shouldShowWeatherDeliveryAlerts(lat, lng);
    const regionConfig = getRegionConfig(detectRegion(lat, lng));

    // Check 24h rainfall
    for (let i = 0; i < daily.rain_sum.length; i++) {
      const rain = daily.rain_sum[i] || 0;
      const date = new Date(daily.time[i]);

      // Only show rain alerts if:
      // 1. This is a region that cares (Kalgoorlie, Pilbara), OR
      // 2. Rain is severe enough to be a flood risk anywhere
      const isSevereFlood = rain >= regionConfig.severeFloodThreshold;
      const shouldAlert = regionCaresAboutRain || isSevereFlood;

      if (shouldAlert && rain >= thresholds.heavyRain24h) {
        const severity: WeatherSeverity = isSevereFlood
          ? 'alert'
          : rain >= thresholds.heavyRain48h
            ? 'warning'
            : 'watch';

        const recommendations: string[] = isSevereFlood
          ? [
              'Severe flooding risk - check road conditions',
              'Consider scheduling delivery before flood event',
              'Monitor emergency services for road closures',
            ]
          : industryType === 'mining' && regionCaresAboutRain
            ? [
                'Monitor access road conditions',
                'Prepare for potential road closure',
                rain >= thresholds.heavyRain48h
                  ? 'Consider scheduling delivery before rain event'
                  : 'Keep monitoring forecasts',
              ]
            : [
                'Check site drainage and sump pumps',
                'Review outdoor equipment protection',
              ];

        const advisory = isSevereFlood
          ? `Severe rainfall of ${rain.toFixed(0)}mm expected. Significant flooding risk.`
          : regionCaresAboutRain
            ? `Heavy rain of ${rain.toFixed(0)}mm expected. May affect access roads.`
            : `Heavy rain of ${rain.toFixed(0)}mm expected.`;

        events.push({
          type: 'heavy_rain',
          severity,
          startDate: date,
          endDate: new Date(date.getTime() + 24 * 60 * 60 * 1000),
          peakValue: rain,
          impact: {
            equipmentRisk: 'low',
            siteAccessRisk: regionCaresAboutRain ? 'high' : isSevereFlood ? 'high' : 'low',
            workerSafetyRisk: isSevereFlood ? 'moderate' : 'low',
            fuelConsumptionMultiplier: 1.0,
            advisory,
          },
          recommendations,
        });
      }
    }

    return events;
  }

  /**
   * Check if location is in Pilbara region (cyclone prone)
   */
  private isPilbaraRegion(lat?: number, lng?: number): boolean {
    if (!lat || !lng) return false;
    // Pilbara region: roughly -23.5 to -20.0 lat, 115.5 to 121.0 lng
    return lat >= -23.5 && lat <= -20.0 && lng >= 115.5 && lng <= 121.0;
  }

  /**
   * Get the highest severity event from a list
   */
  getHighestSeverity(events: ExtremeWeatherEvent[]): WeatherSeverity | null {
    if (events.length === 0) return null;
    if (events.some(e => e.severity === 'alert')) return 'alert';
    if (events.some(e => e.severity === 'warning')) return 'warning';
    return 'watch';
  }

  /**
   * Get next event date
   */
  getNextEventDate(events: ExtremeWeatherEvent[]): Date | null {
    if (events.length === 0) return null;
    return events.reduce((earliest, event) =>
      event.startDate < earliest ? event.startDate : earliest,
      events[0].startDate
    );
  }
}

export const extremeWeatherDetector = new ExtremeWeatherDetector();
