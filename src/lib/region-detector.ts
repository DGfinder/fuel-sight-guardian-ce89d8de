/**
 * Region Detection Utility
 *
 * Detects which WA region a location is in based on coordinates.
 * Used to determine which weather alerts are relevant for delivery planning.
 *
 * Key insight: Road closure concerns are only relevant for remote areas
 * like Kalgoorlie/Goldfields and Pilbara. Perth, Geraldton, and farms
 * have sealed/good roads that rarely close due to rain.
 */

export type Region =
  | 'kalgoorlie'  // Goldfields - unsealed roads, frequent rain closures
  | 'pilbara'     // Remote mining, cyclone zone
  | 'perth'       // Metro area - sealed roads
  | 'geraldton'   // Coastal - generally good access
  | 'wheatbelt'   // Farming - sealed/good gravel roads
  | 'unknown';

export interface RegionConfig {
  /** Should rain affect delivery suggestions? */
  weatherDeliveryAlerts: boolean;
  /** Are road closures a real concern in this region? */
  roadClosureRisk: boolean;
  /** mm of rain - always alert above this (severe flooding) */
  severeFloodThreshold: number;
  /** Temperature (°C) for extreme heat alert - mining areas need higher threshold */
  extremeHeatThreshold: number;
  /** Human-readable region name */
  displayName: string;
}

/**
 * Region configurations based on real-world operational knowledge:
 * - Kalgoorlie/Pilbara: Remote mining, unsealed roads, real weather concerns
 * - Perth/Geraldton/Wheatbelt: Urban or farming, sealed roads, weather rarely matters
 */
export const REGION_CONFIGS: Record<Region, RegionConfig> = {
  kalgoorlie: {
    weatherDeliveryAlerts: true,
    roadClosureRisk: true,
    severeFloodThreshold: 50,
    extremeHeatThreshold: 45, // "38 is a nice day in mining"
    displayName: 'Kalgoorlie/Goldfields',
  },
  pilbara: {
    weatherDeliveryAlerts: true,
    roadClosureRisk: true,
    severeFloodThreshold: 50,
    extremeHeatThreshold: 45,
    displayName: 'Pilbara',
  },
  perth: {
    weatherDeliveryAlerts: false,
    roadClosureRisk: false,
    severeFloodThreshold: 100, // Only severe flooding would matter
    extremeHeatThreshold: 45,
    displayName: 'Perth Metro',
  },
  geraldton: {
    weatherDeliveryAlerts: false,
    roadClosureRisk: false,
    severeFloodThreshold: 100,
    extremeHeatThreshold: 45,
    displayName: 'Geraldton/Mid West',
  },
  wheatbelt: {
    weatherDeliveryAlerts: false,
    roadClosureRisk: false,
    severeFloodThreshold: 100,
    extremeHeatThreshold: 45,
    displayName: 'Wheatbelt',
  },
  unknown: {
    weatherDeliveryAlerts: false, // Default to quiet - don't alarm unnecessarily
    roadClosureRisk: false,
    severeFloodThreshold: 100,
    extremeHeatThreshold: 45,
    displayName: 'Unknown Region',
  },
};

/**
 * Detect which WA region a coordinate falls within.
 * Uses bounding boxes for major operational regions.
 *
 * @param lat - Latitude (negative for southern hemisphere)
 * @param lng - Longitude
 * @returns The detected region
 */
export function detectRegion(lat: number | undefined, lng: number | undefined): Region {
  if (lat === undefined || lng === undefined) return 'unknown';

  // Kalgoorlie/Goldfields: roughly -31.5 to -29.5 lat, 120.5 to 122.5 lng
  // Includes Kalgoorlie, Boulder, Kambalda, Coolgardie
  if (lat >= -31.5 && lat <= -29.5 && lng >= 120.5 && lng <= 122.5) {
    return 'kalgoorlie';
  }

  // Pilbara: -23.5 to -20.0 lat, 115.5 to 121.0 lng
  // Includes Port Hedland, Karratha, Newman, Tom Price
  if (lat >= -23.5 && lat <= -20.0 && lng >= 115.5 && lng <= 121.0) {
    return 'pilbara';
  }

  // Perth Metro: -32.5 to -31.5 lat, 115.5 to 116.5 lng
  // Greater Perth area
  if (lat >= -32.5 && lat <= -31.5 && lng >= 115.5 && lng <= 116.5) {
    return 'perth';
  }

  // Geraldton area: -29.5 to -28.0 lat, 114.0 to 115.5 lng
  // Mid West coastal
  if (lat >= -29.5 && lat <= -28.0 && lng >= 114.0 && lng <= 115.5) {
    return 'geraldton';
  }

  // Wheatbelt: broad area between Perth and Kalgoorlie
  // -33.5 to -30.0 lat, 116.5 to 120.5 lng
  if (lat >= -33.5 && lat <= -30.0 && lng >= 116.5 && lng <= 120.5) {
    return 'wheatbelt';
  }

  return 'unknown';
}

/**
 * Get the configuration for a region
 */
export function getRegionConfig(region: Region): RegionConfig {
  return REGION_CONFIGS[region];
}

/**
 * Check if a location should receive weather-based delivery alerts
 */
export function shouldShowWeatherDeliveryAlerts(
  lat: number | undefined,
  lng: number | undefined
): boolean {
  const region = detectRegion(lat, lng);
  return REGION_CONFIGS[region].weatherDeliveryAlerts;
}

/**
 * Check if road closure is a real risk for a location
 */
export function hasRoadClosureRisk(
  lat: number | undefined,
  lng: number | undefined
): boolean {
  const region = detectRegion(lat, lng);
  return REGION_CONFIGS[region].roadClosureRisk;
}

/**
 * Get the severe flood threshold for a location
 * (mm of rain that would trigger alerts regardless of region)
 */
export function getSevereFloodThreshold(
  lat: number | undefined,
  lng: number | undefined
): number {
  const region = detectRegion(lat, lng);
  return REGION_CONFIGS[region].severeFloodThreshold;
}

/**
 * Get the extreme heat threshold for a location
 */
export function getExtremeHeatThreshold(
  lat: number | undefined,
  lng: number | undefined
): number {
  const region = detectRegion(lat, lng);
  return REGION_CONFIGS[region].extremeHeatThreshold;
}

/**
 * Check if a given rainfall amount is severe enough to alert for any region
 */
export function isSevereFlooding(
  rainMm: number,
  lat: number | undefined,
  lng: number | undefined
): boolean {
  const threshold = getSevereFloodThreshold(lat, lng);
  return rainMm >= threshold;
}
