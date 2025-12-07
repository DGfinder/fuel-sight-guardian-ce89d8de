import { WeatherForecast } from './types';

export interface RoadRiskAssessment {
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  probability: number; // 0-100
  estimatedClosureDate: Date | null;
  estimatedClosureDuration: number; // days
  reasoning: string;
  recommendations: string[];
}

export interface RoadProfile {
  accessRoadType: 'sealed' | 'gravel' | 'unsealed';
  closureThresholdMm: number;
  typicalClosureDurationDays: number;
  alternativeRouteAvailable: boolean;
}

export class RoadRiskCalculator {
  assessRisk(
    weather: WeatherForecast,
    roadProfile: RoadProfile,
    currentTankLevel: number,
    dailyConsumptionLiters: number
  ): RoadRiskAssessment {
    // Calculate cumulative rainfall over next 48 hours
    const rainfall48h = this.calculateRainfall48h(weather);
    const rainfall7days = this.calculateRainfall7days(weather);

    // Determine if threshold will be exceeded
    const willExceedThreshold = rainfall48h >= roadProfile.closureThresholdMm;
    const probability = this.calculateClosureProbability(
      rainfall48h,
      roadProfile.closureThresholdMm,
      roadProfile.accessRoadType
    );

    // Find when threshold is likely to be exceeded
    const closureDate = this.findClosureDate(weather, roadProfile.closureThresholdMm);

    // Calculate if tank will survive closure period
    const daysOfSupply = dailyConsumptionLiters > 0
      ? (currentTankLevel / dailyConsumptionLiters)
      : 999;

    const estimatedClosureDuration = roadProfile.typicalClosureDurationDays;
    const willSurviveClosure = daysOfSupply > estimatedClosureDuration;

    // Determine risk level
    let riskLevel: RoadRiskAssessment['riskLevel'] = 'low';
    if (willExceedThreshold && !willSurviveClosure) {
      riskLevel = 'critical';
    } else if (willExceedThreshold && willSurviveClosure) {
      riskLevel = 'high';
    } else if (probability > 50) {
      riskLevel = 'moderate';
    }

    // Generate recommendations
    const recommendations: string[] = [];
    if (riskLevel === 'critical') {
      recommendations.push('Request urgent delivery within 24 hours');
      recommendations.push('Current supply insufficient for closure period');
    } else if (riskLevel === 'high') {
      recommendations.push('Schedule delivery before rainfall event');
      recommendations.push('Top up to 80%+ before road closure');
    } else if (riskLevel === 'moderate') {
      recommendations.push('Monitor weather closely over next 48 hours');
      if (!roadProfile.alternativeRouteAvailable) {
        recommendations.push('Consider requesting delivery as precaution');
      }
    }

    const reasoning = this.generateReasoning(
      rainfall48h,
      roadProfile.closureThresholdMm,
      daysOfSupply,
      estimatedClosureDuration
    );

    return {
      riskLevel,
      probability,
      estimatedClosureDate: closureDate,
      estimatedClosureDuration,
      reasoning,
      recommendations,
    };
  }

  private calculateRainfall48h(weather: WeatherForecast): number {
    // Sum next 48 hours of rainfall from hourly data
    const next48Hours = weather.hourly.rain.slice(0, 48);
    return next48Hours.reduce((sum, r) => sum + (r || 0), 0);
  }

  private calculateRainfall7days(weather: WeatherForecast): number {
    return weather.daily.rain_sum.slice(0, 7).reduce((sum, r) => sum + (r || 0), 0);
  }

  private calculateClosureProbability(
    forecastRainfall: number,
    threshold: number,
    roadType: string
  ): number {
    if (forecastRainfall >= threshold * 1.2) return 95;
    if (forecastRainfall >= threshold) return 80;
    if (forecastRainfall >= threshold * 0.8) return 60;
    if (forecastRainfall >= threshold * 0.5) return 30;
    return 10;
  }

  private findClosureDate(weather: WeatherForecast, threshold: number): Date | null {
    let cumulative = 0;
    for (let i = 0; i < weather.hourly.rain.length; i++) {
      cumulative += weather.hourly.rain[i] || 0;
      if (cumulative >= threshold) {
        return new Date(weather.hourly.time[i]);
      }
    }
    return null;
  }

  private generateReasoning(
    rainfall: number,
    threshold: number,
    daysOfSupply: number,
    closureDuration: number
  ): string {
    if (rainfall >= threshold) {
      return `${rainfall.toFixed(0)}mm rain forecast (exceeds ${threshold}mm closure threshold). ` +
             `Tank has ${daysOfSupply.toFixed(0)} days supply, ` +
             `typical closure lasts ${closureDuration} days.`;
    }
    return `${rainfall.toFixed(0)}mm rain forecast (below ${threshold}mm threshold). Road access likely to remain open.`;
  }
}

export const roadRiskCalculator = new RoadRiskCalculator();
