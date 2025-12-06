import { useWeatherForecast, useSoilMoisture } from './useWeatherForecast';
import { useQuery } from '@tanstack/react-query';
import { roadRiskCalculator } from '@/services/weather/road-risk-calculator';
import { operationsPredictor } from '@/services/weather/operations-predictor';
import type { RoadRiskAssessment, RoadProfile } from '@/services/weather/road-risk-calculator';
import type { OperationWindow } from '@/services/weather/operations-predictor';

export interface AgriculturalIntelligence {
  roadRisk: RoadRiskAssessment | null;
  operations: OperationWindow[];
  alerts: AgAlert[];
}

export interface AgAlert {
  type: 'road_risk' | 'harvest_window' | 'seeding_window' | 'spray_window';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  actionRequired: string;
}

export function useAgriculturalIntelligence(
  lat?: number,
  lng?: number,
  tankLevel?: number,
  dailyConsumption?: number,
  capacityLiters?: number,
  roadProfile?: RoadProfile | null
) {
  const { data: weather } = useWeatherForecast(lat, lng, 16);
  const { data: soilData } = useSoilMoisture(lat, lng);

  return useQuery<AgriculturalIntelligence>({
    queryKey: ['agricultural-intelligence', lat, lng, tankLevel, dailyConsumption, capacityLiters],
    queryFn: async () => {
      if (!weather) throw new Error('Weather data required');

      const currentMonth = new Date().getMonth() + 1;
      const alerts: AgAlert[] = [];

      // Calculate current tank level in liters
      const currentLevelLiters = tankLevel && capacityLiters
        ? (tankLevel / 100) * capacityLiters
        : 0;

      // 1. Road risk assessment
      let roadRisk: RoadRiskAssessment | null = null;
      if (roadProfile && currentLevelLiters && dailyConsumption) {
        roadRisk = roadRiskCalculator.assessRisk(
          weather,
          roadProfile,
          currentLevelLiters,
          dailyConsumption
        );

        if (roadRisk.riskLevel !== 'low') {
          alerts.push({
            type: 'road_risk',
            severity: roadRisk.riskLevel === 'critical' ? 'critical' : 'warning',
            title: `${roadRisk.riskLevel.toUpperCase()} Road Closure Risk`,
            description: roadRisk.reasoning,
            actionRequired: roadRisk.recommendations[0] || '',
          });
        }
      }

      // 2. Operations predictions
      const operations: OperationWindow[] = [];

      const harvestWindow = operationsPredictor.predictHarvestWindow(
        weather,
        'Eastern Wheatbelt',
        currentMonth
      );
      if (harvestWindow) {
        operations.push(harvestWindow);
        alerts.push({
          type: 'harvest_window',
          severity: 'warning',
          title: 'Harvest Window Opening',
          description: harvestWindow.reasoning,
          actionRequired: harvestWindow.recommendations[0] || '',
        });
      }

      const seedingWindow = operationsPredictor.predictSeedingWindow(
        weather,
        soilData?.daily?.soil_moisture_0_to_10cm?.[0] || 0,
        'Eastern Wheatbelt',
        currentMonth
      );
      if (seedingWindow) {
        operations.push(seedingWindow);
        if (seedingWindow.status !== 'closed') {
          alerts.push({
            type: 'seeding_window',
            severity: 'info',
            title: 'Seeding Window Update',
            description: seedingWindow.reasoning,
            actionRequired: seedingWindow.recommendations[0] || '',
          });
        }
      }

      const sprayWindow = operationsPredictor.predictSprayWindow(weather, currentMonth);
      if (sprayWindow) {
        operations.push(sprayWindow);
        alerts.push({
          type: 'spray_window',
          severity: 'info',
          title: 'Optimal Spray Conditions',
          description: sprayWindow.reasoning,
          actionRequired: sprayWindow.recommendations[0] || '',
        });
      }

      return {
        roadRisk,
        operations,
        alerts,
      };
    },
    enabled: !!weather,
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
