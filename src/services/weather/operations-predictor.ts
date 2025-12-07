import { WeatherForecast } from './types';
import { addDays, format } from 'date-fns';

export interface OperationWindow {
  operation: 'harvest' | 'seeding' | 'spraying';
  status: 'opening' | 'optimal' | 'closing' | 'closed';
  startDate: Date;
  endDate: Date;
  confidence: number; // 0-100
  reasoning: string;
  fuelImpact: {
    expectedMultiplier: number; // e.g., 2.5x for harvest
    estimatedDailyUsage: number; // liters
    estimatedTotalUsage: number; // liters over window
  };
  recommendations: string[];
}

export class OperationsPredictor {
  predictHarvestWindow(
    weather: WeatherForecast,
    region: string,
    currentMonth: number
  ): OperationWindow | null {
    // Harvest typically Oct-Dec in WA
    if (currentMonth < 9 || currentMonth > 12) return null;

    // Look for dry window (7+ days no rain, good temps)
    const dryWindow = this.findDryWindow(weather, 7);

    if (!dryWindow) return null;

    // Check if rain will interrupt harvest
    const rainAfterWindow = this.getRainfallAfterDate(weather, dryWindow.end);

    return {
      operation: 'harvest',
      status: 'optimal',
      startDate: dryWindow.start,
      endDate: dryWindow.end,
      confidence: 85,
      reasoning: `${dryWindow.days} day dry window ideal for harvest. ` +
                `${rainAfterWindow > 15 ? `${rainAfterWindow.toFixed(0)}mm rain forecast after window - harvest before rain.` : 'Extended dry period.'}`,
      fuelImpact: {
        expectedMultiplier: 2.5,
        estimatedDailyUsage: 800, // headers use ~800L/day
        estimatedTotalUsage: 800 * dryWindow.days,
      },
      recommendations: [
        'Ensure tank is 70%+ before harvest window opens',
        'Headers will consume ~800L/day during harvest',
        rainAfterWindow > 15 ? 'Schedule delivery before rain event' : 'Monitor fuel levels daily during harvest',
      ],
    };
  }

  predictSeedingWindow(
    weather: WeatherForecast,
    soilMoisture: number,
    region: string,
    currentMonth: number
  ): OperationWindow | null {
    // Seeding window Apr-Jun after "autumn break" (20mm+ rain)
    if (currentMonth < 3 || currentMonth > 7) return null;

    // Look for 20mm+ rain event (the "break")
    const breakEvent = this.findRainfallEvent(weather, 20);

    if (!breakEvent) {
      return {
        operation: 'seeding',
        status: 'closed',
        startDate: new Date(),
        endDate: new Date(),
        confidence: 70,
        reasoning: 'Waiting for autumn break (20mm+ rainfall event)',
        fuelImpact: {
          expectedMultiplier: 1.0,
          estimatedDailyUsage: 0,
          estimatedTotalUsage: 0,
        },
        recommendations: [
          'Monitor weather for 20mm+ rain event (autumn break)',
          'Seeding typically begins 3-5 days after break',
        ],
      };
    }

    const seedingStart = addDays(breakEvent.date, 3); // 3 days after rain
    const seedingEnd = addDays(seedingStart, 7); // 7-day seeding window

    return {
      operation: 'seeding',
      status: 'opening',
      startDate: seedingStart,
      endDate: seedingEnd,
      confidence: 80,
      reasoning: `${breakEvent.amount.toFixed(0)}mm rain forecast ${format(breakEvent.date, 'MMM d')}. Optimal seeding window opens 3-5 days after.`,
      fuelImpact: {
        expectedMultiplier: 1.8,
        estimatedDailyUsage: 300,
        estimatedTotalUsage: 2100, // 7 days × 300L
      },
      recommendations: [
        `Request delivery before ${format(seedingStart, 'MMM d')}`,
        'Seeding operations will use ~300L/day',
        'Ensure minimum 60% tank level before seeding starts',
      ],
    };
  }

  predictSprayWindow(
    weather: WeatherForecast,
    currentMonth: number
  ): OperationWindow | null {
    // Spraying is weather-dependent: <15km/h wind, no rain for 24h
    const sprayWindow = this.findSprayWindow(weather);

    if (!sprayWindow) return null;

    return {
      operation: 'spraying',
      status: 'optimal',
      startDate: sprayWindow.start,
      endDate: sprayWindow.end,
      confidence: 75,
      reasoning: `Ideal spray conditions: Wind <15km/h, no rain forecast. ` +
                `These conditions are rare - farmers will spray NOW.`,
      fuelImpact: {
        expectedMultiplier: 1.3,
        estimatedDailyUsage: 120, // spray rigs ~120L/day
        estimatedTotalUsage: 120 * sprayWindow.days,
      },
      recommendations: [
        'Optimal spray window - expect regional demand spike',
        'Current tank level sufficient for spray operations?',
      ],
    };
  }

  private findDryWindow(weather: WeatherForecast, minDays: number) {
    // Find consecutive days with <2mm rain
    let consecutiveDry = 0;
    let startIdx = -1;

    for (let i = 0; i < weather.daily.rain_sum.length; i++) {
      if (weather.daily.rain_sum[i] < 2) {
        if (consecutiveDry === 0) startIdx = i;
        consecutiveDry++;

        if (consecutiveDry >= minDays) {
          return {
            start: new Date(weather.daily.time[startIdx]),
            end: new Date(weather.daily.time[i]),
            days: consecutiveDry,
          };
        }
      } else {
        consecutiveDry = 0;
      }
    }

    return null;
  }

  private findRainfallEvent(weather: WeatherForecast, minMm: number) {
    // Find day with rainfall >= minMm
    for (let i = 0; i < weather.daily.rain_sum.length; i++) {
      if (weather.daily.rain_sum[i] >= minMm) {
        return {
          date: new Date(weather.daily.time[i]),
          amount: weather.daily.rain_sum[i],
        };
      }
    }
    return null;
  }

  private getRainfallAfterDate(weather: WeatherForecast, date: Date): number {
    const dateStr = format(date, 'yyyy-MM-dd');
    const idx = weather.daily.time.findIndex(t => t > dateStr);
    if (idx === -1) return 0;

    // Sum rain for next 7 days after date
    return weather.daily.rain_sum.slice(idx, idx + 7).reduce((sum, r) => sum + r, 0);
  }

  private findSprayWindow(weather: WeatherForecast) {
    // Find 2+ consecutive days with wind <15km/h and no rain
    let consecutiveGood = 0;
    let startIdx = -1;

    for (let i = 0; i < Math.min(7, weather.daily.windspeed_10m_max.length); i++) {
      const goodWind = weather.daily.windspeed_10m_max[i] < 15;
      const noRain = weather.daily.rain_sum[i] < 1;

      if (goodWind && noRain) {
        if (consecutiveGood === 0) startIdx = i;
        consecutiveGood++;

        if (consecutiveGood >= 2) {
          return {
            start: new Date(weather.daily.time[startIdx]),
            end: new Date(weather.daily.time[i]),
            days: consecutiveGood,
          };
        }
      } else {
        consecutiveGood = 0;
      }
    }

    return null;
  }
}

export const operationsPredictor = new OperationsPredictor();
