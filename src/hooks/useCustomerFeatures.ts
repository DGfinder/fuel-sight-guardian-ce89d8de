import { useMemo } from 'react';
import { useCustomerAccount } from './useCustomerAuth';

/**
 * Industry types for customer accounts
 * Determines which features are visible in the customer portal
 */
export type IndustryType = 'farming' | 'mining' | 'general';

/**
 * Feature visibility flags based on customer industry type
 */
export interface CustomerFeatures {
  // Core features (available to all)
  tankMonitoring: boolean;
  deliveryRequests: boolean;
  basicWeather: boolean;

  // Agricultural Intelligence (farming only)
  agriculturalIntelligence: boolean;
  harvestWindows: boolean;
  seedingWindows: boolean;
  sprayWindows: boolean;
  fuelMultipliers: boolean;
  operationsBadges: boolean;

  // Road Risk (farming + mining)
  roadRisk: boolean;

  // Full Weather (farming + mining)
  fullWeather: boolean;

  // Mining-specific features
  extremeHeatWarnings: boolean;
  cycloneWarnings: boolean;

  // Convenience flags
  isAgriculturalCustomer: boolean;
  isMiningCustomer: boolean;
  isGeneralCustomer: boolean;
}

/**
 * Feature map for each industry type
 */
const FEATURE_MAP: Record<IndustryType, CustomerFeatures> = {
  farming: {
    // Core - always on
    tankMonitoring: true,
    deliveryRequests: true,
    basicWeather: true,

    // Agricultural Intelligence - farming only
    agriculturalIntelligence: true,
    harvestWindows: true,
    seedingWindows: true,
    sprayWindows: true,
    fuelMultipliers: true,
    operationsBadges: true,

    // Road Risk - farming + mining
    roadRisk: true,

    // Full Weather - farming + mining
    fullWeather: true,

    // Mining-specific - off for farming
    extremeHeatWarnings: false,
    cycloneWarnings: false,

    // Convenience flags
    isAgriculturalCustomer: true,
    isMiningCustomer: false,
    isGeneralCustomer: false,
  },

  mining: {
    // Core - always on
    tankMonitoring: true,
    deliveryRequests: true,
    basicWeather: true,

    // Agricultural Intelligence - off for mining
    agriculturalIntelligence: false,
    harvestWindows: false,
    seedingWindows: false,
    sprayWindows: false,
    fuelMultipliers: false,
    operationsBadges: false,

    // Road Risk - farming + mining
    roadRisk: true,

    // Full Weather - farming + mining
    fullWeather: true,

    // Mining-specific - on for mining
    extremeHeatWarnings: true,
    cycloneWarnings: true,

    // Convenience flags
    isAgriculturalCustomer: false,
    isMiningCustomer: true,
    isGeneralCustomer: false,
  },

  general: {
    // Core - always on
    tankMonitoring: true,
    deliveryRequests: true,
    basicWeather: true,

    // Agricultural Intelligence - off for general
    agriculturalIntelligence: false,
    harvestWindows: false,
    seedingWindows: false,
    sprayWindows: false,
    fuelMultipliers: false,
    operationsBadges: false,

    // Road Risk - off for general (urban, sealed roads)
    roadRisk: false,

    // Full Weather - off for general (basic only)
    fullWeather: false,

    // Mining-specific - off for general
    extremeHeatWarnings: false,
    cycloneWarnings: false,

    // Convenience flags
    isAgriculturalCustomer: false,
    isMiningCustomer: false,
    isGeneralCustomer: true,
  },
};

/**
 * Hook to get customer feature visibility based on their industry type
 *
 * Usage:
 * ```tsx
 * const { agriculturalIntelligence, roadRisk } = useCustomerFeatures();
 *
 * if (!agriculturalIntelligence) {
 *   return null; // Don't render agricultural components
 * }
 * ```
 */
export function useCustomerFeatures(): CustomerFeatures & {
  isLoading: boolean;
  industryType: IndustryType;
} {
  const { data: customerAccount, isLoading } = useCustomerAccount();

  // Default to 'farming' for backwards compatibility
  // (existing customers without industry_type set should see full features)
  const industryType: IndustryType =
    (customerAccount?.industry_type as IndustryType) || 'farming';

  const features = useMemo(() => FEATURE_MAP[industryType], [industryType]);

  return {
    ...features,
    isLoading,
    industryType,
  };
}

/**
 * Convenience hook to check a single feature
 *
 * Usage:
 * ```tsx
 * const showAgIntel = useHasFeature('agriculturalIntelligence');
 * ```
 */
export function useHasFeature(feature: keyof CustomerFeatures): boolean {
  const features = useCustomerFeatures();
  return features[feature] === true;
}

/**
 * Get feature list for a given industry type (for admin UI)
 */
export function getFeaturesForIndustry(industryType: IndustryType): string[] {
  const features: string[] = ['Tank Monitoring', 'Delivery Requests'];

  if (industryType === 'farming') {
    features.push(
      'Agricultural Intelligence',
      'Harvest Windows',
      'Seeding Windows',
      'Spray Windows',
      'Fuel Multipliers',
      'Road Risk Alerts',
      'Full Weather'
    );
  } else if (industryType === 'mining') {
    features.push(
      'Road Risk Alerts',
      'Full Weather',
      'Extreme Heat Warnings',
      'Cyclone Warnings'
    );
  } else {
    features.push('Basic Weather');
  }

  return features;
}
