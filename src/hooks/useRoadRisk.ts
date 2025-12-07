import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useWeatherForecast } from './useWeatherForecast';
import { roadRiskCalculator, type RoadProfile, type RoadRiskAssessment } from '@/services/weather/road-risk-calculator';

export interface RoadRiskProfile {
  id: string;
  agbot_location_id: string;
  access_road_type: 'sealed' | 'gravel' | 'unsealed' | 'unknown';
  road_condition: string | null;
  closure_threshold_mm: number;
  typical_closure_duration_days: number;
  alternative_route_available: boolean;
  alternative_route_notes: string | null;
  historical_closures: any[];
}

/**
 * Hook to fetch road risk profile for a location
 */
export function useRoadRiskProfile(locationId: string | undefined) {
  return useQuery<RoadRiskProfile | null>({
    queryKey: ['road-risk-profile', locationId],
    queryFn: async () => {
      if (!locationId) return null;

      const { data, error } = await supabase
        .from('road_risk_profiles')
        .select('*')
        .eq('agbot_location_id', locationId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching road risk profile:', error);
        return null;
      }

      return data as RoadRiskProfile | null;
    },
    enabled: !!locationId,
    staleTime: 10 * 60 * 1000, // 10 minutes (doesn't change often)
  });
}

/**
 * Hook to calculate road risk assessment combining weather forecast and road profile
 */
export function useRoadRiskAssessment(
  locationId: string | undefined,
  lat: number | undefined,
  lng: number | undefined,
  tankLevelPercent: number | undefined,
  dailyConsumptionLiters: number | undefined,
  capacityLiters: number | undefined
) {
  const { data: roadProfile } = useRoadRiskProfile(locationId);
  const { data: weather } = useWeatherForecast(lat, lng, 7);

  return useQuery<RoadRiskAssessment | null>({
    queryKey: [
      'road-risk-assessment',
      locationId,
      lat,
      lng,
      tankLevelPercent,
      dailyConsumptionLiters,
      capacityLiters,
    ],
    queryFn: async () => {
      // Need all data to calculate risk
      if (!roadProfile || !weather || !tankLevelPercent || !dailyConsumptionLiters || !capacityLiters) {
        return null;
      }

      // Skip if road is sealed (very low closure risk)
      if (roadProfile.access_road_type === 'sealed') {
        return null;
      }

      // Calculate current tank level in liters
      const currentLevelLiters = (tankLevelPercent / 100) * capacityLiters;

      // Convert road profile to calculator format
      const profile: RoadProfile = {
        accessRoadType: roadProfile.access_road_type === 'unknown' ? 'gravel' : roadProfile.access_road_type,
        closureThresholdMm: roadProfile.closure_threshold_mm,
        typicalClosureDurationDays: roadProfile.typical_closure_duration_days,
        alternativeRouteAvailable: roadProfile.alternative_route_available,
      };

      // Calculate risk assessment
      const assessment = roadRiskCalculator.assessRisk(
        weather,
        profile,
        currentLevelLiters,
        dailyConsumptionLiters
      );

      return assessment;
    },
    enabled: !!roadProfile && !!weather && !!tankLevelPercent && !!dailyConsumptionLiters && !!capacityLiters,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}
