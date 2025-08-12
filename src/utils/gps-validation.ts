// Comprehensive GPS coordinate validation and utility system
// Provides validation, normalization, and quality assessment for GPS coordinates

export interface GPSCoordinate {
  latitude: number;
  longitude: number;
}

export interface GPSValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'invalid';
  normalizedCoordinate?: GPSCoordinate;
}

export interface GPSBoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

// Australia bounding box (including territories and nearby islands)
export const AUSTRALIA_BOUNDS: GPSBoundingBox = {
  north: -9.0,     // Northern Territory/Torres Strait
  south: -55.0,    // Heard Island and McDonald Islands
  east: 160.0,     // Norfolk Island
  west: 95.0       // Cocos (Keeling) Islands
};

// Mainland Australia (more restrictive)
export const AUSTRALIA_MAINLAND_BOUNDS: GPSBoundingBox = {
  north: -10.7,    // Cape York, Queensland
  south: -43.7,    // South Point, Tasmania
  east: 153.7,     // Byron Bay, NSW
  west: 113.2      // Steep Point, WA
};

// Major Australian cities for reference validation
export const AUSTRALIAN_CITIES: Record<string, GPSCoordinate> = {
  'Sydney': { latitude: -33.8688, longitude: 151.2093 },
  'Melbourne': { latitude: -37.8136, longitude: 144.9631 },
  'Brisbane': { latitude: -27.4698, longitude: 153.0251 },
  'Perth': { latitude: -31.9505, longitude: 115.8605 },
  'Adelaide': { latitude: -34.9285, longitude: 138.6007 },
  'Gold Coast': { latitude: -28.0167, longitude: 153.4000 },
  'Newcastle': { latitude: -32.9283, longitude: 151.7817 },
  'Canberra': { latitude: -35.2809, longitude: 149.1300 },
  'Sunshine Coast': { latitude: -26.6500, longitude: 153.0667 },
  'Central Coast': { latitude: -33.4269, longitude: 151.3425 }
};

/**
 * Basic GPS coordinate validation
 * Checks if coordinates are within valid latitude/longitude ranges
 */
export function validateBasicCoordinates(latitude: number, longitude: number): boolean {
  return (
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    isFinite(latitude) &&
    isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Check if coordinates are not null or zero coordinates
 */
export function isNonZeroCoordinate(latitude: number, longitude: number): boolean {
  const EPSILON = 0.000001; // Minimum precision threshold
  return Math.abs(latitude) > EPSILON && Math.abs(longitude) > EPSILON;
}

/**
 * Validate coordinates are within a bounding box
 */
export function validateBoundingBox(
  coordinate: GPSCoordinate, 
  bounds: GPSBoundingBox
): boolean {
  return (
    coordinate.latitude >= bounds.south &&
    coordinate.latitude <= bounds.north &&
    coordinate.longitude >= bounds.west &&
    coordinate.longitude <= bounds.east
  );
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in kilometers
 */
export function calculateDistance(coord1: GPSCoordinate, coord2: GPSCoordinate): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(coord2.latitude - coord1.latitude);
  const dLon = toRadians(coord2.longitude - coord1.longitude);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.latitude)) * Math.cos(toRadians(coord2.latitude)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Find nearest Australian city to given coordinates
 */
export function findNearestAustralianCity(coordinate: GPSCoordinate): {
  city: string;
  distance: number;
  coordinate: GPSCoordinate;
} | null {
  if (!validateBasicCoordinates(coordinate.latitude, coordinate.longitude)) {
    return null;
  }

  let nearestCity = null;
  let minDistance = Infinity;

  for (const [cityName, cityCoord] of Object.entries(AUSTRALIAN_CITIES)) {
    const distance = calculateDistance(coordinate, cityCoord);
    if (distance < minDistance) {
      minDistance = distance;
      nearestCity = {
        city: cityName,
        distance,
        coordinate: cityCoord
      };
    }
  }

  return nearestCity;
}

/**
 * Normalize GPS coordinates to standard format
 * Ensures proper precision and removes invalid values
 */
export function normalizeCoordinate(latitude: number, longitude: number): GPSCoordinate | null {
  if (!validateBasicCoordinates(latitude, longitude)) {
    return null;
  }

  // Round to 6 decimal places (approximately 0.1 meter precision)
  const normalizedLat = Math.round(latitude * 1000000) / 1000000;
  const normalizedLng = Math.round(longitude * 1000000) / 1000000;

  return {
    latitude: normalizedLat,
    longitude: normalizedLng
  };
}

/**
 * Comprehensive GPS coordinate validation
 * Provides detailed validation results with quality assessment
 */
export function validateGPSCoordinate(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  options: {
    requireAustralia?: boolean;
    requireMainlandAustralia?: boolean;
    minDistanceFromCities?: number; // kilometers
    maxDistanceFromCities?: number; // kilometers
  } = {}
): GPSValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check for null/undefined values
  if (latitude === null || latitude === undefined || longitude === null || longitude === undefined) {
    errors.push('GPS coordinates are missing');
    return {
      isValid: false,
      errors,
      warnings,
      quality: 'invalid'
    };
  }

  // Basic validation
  if (!validateBasicCoordinates(latitude, longitude)) {
    errors.push('Invalid GPS coordinate format or range');
    return {
      isValid: false,
      errors,
      warnings,
      quality: 'invalid'
    };
  }

  const coordinate = { latitude, longitude };
  const normalizedCoord = normalizeCoordinate(latitude, longitude);

  // Check for zero coordinates
  if (!isNonZeroCoordinate(latitude, longitude)) {
    errors.push('Coordinates appear to be null island (0,0) or too close to origin');
    return {
      isValid: false,
      errors,
      warnings,
      quality: 'invalid'
    };
  }

  // Australia-specific validation
  if (options.requireAustralia || options.requireMainlandAustralia) {
    const bounds = options.requireMainlandAustralia ? AUSTRALIA_MAINLAND_BOUNDS : AUSTRALIA_BOUNDS;
    
    if (!validateBoundingBox(coordinate, bounds)) {
      const boundaryType = options.requireMainlandAustralia ? 'mainland Australia' : 'Australia';
      errors.push(`Coordinates are outside ${boundaryType} boundaries`);
      return {
        isValid: false,
        errors,
        warnings,
        quality: 'invalid'
      };
    }
  }

  // Distance validation from cities
  const nearestCity = findNearestAustralianCity(coordinate);
  let quality: GPSValidationResult['quality'] = 'good';

  if (nearestCity) {
    const distanceKm = nearestCity.distance;

    // Distance-based quality assessment
    if (distanceKm < 50) {
      quality = 'excellent'; // Within 50km of major city
    } else if (distanceKm < 200) {
      quality = 'good'; // Within 200km of major city
    } else if (distanceKm < 500) {
      quality = 'fair'; // Within 500km of major city
    } else {
      quality = 'poor'; // Very remote location
      warnings.push(`Location is ${distanceKm.toFixed(0)}km from nearest major city (${nearestCity.city})`);
    }

    // Distance constraints
    if (options.minDistanceFromCities && distanceKm < options.minDistanceFromCities) {
      warnings.push(`Location is too close to ${nearestCity.city} (${distanceKm.toFixed(1)}km < ${options.minDistanceFromCities}km)`);
    }

    if (options.maxDistanceFromCities && distanceKm > options.maxDistanceFromCities) {
      warnings.push(`Location is too far from nearest city (${distanceKm.toFixed(1)}km > ${options.maxDistanceFromCities}km)`);
      if (options.maxDistanceFromCities < 1000) {
        quality = 'poor';
      }
    }

    // Very remote locations warning
    if (distanceKm > 1000) {
      warnings.push(`Location is very remote (${distanceKm.toFixed(0)}km from ${nearestCity.city})`);
    }
  }

  // Precision assessment
  const latPrecision = countDecimalPlaces(latitude);
  const lngPrecision = countDecimalPlaces(longitude);
  
  if (latPrecision < 4 || lngPrecision < 4) {
    warnings.push('Low coordinate precision - may affect map accuracy');
    if (quality === 'excellent') quality = 'good';
  }

  // Suspicious coordinate patterns
  if (latitude === longitude) {
    warnings.push('Latitude and longitude are identical - verify accuracy');
    if (quality === 'excellent') quality = 'fair';
  }

  if (Math.abs(latitude % 1) < 0.001 && Math.abs(longitude % 1) < 0.001) {
    warnings.push('Coordinates appear to be rounded to whole degrees - verify precision');
    if (quality === 'excellent') quality = 'fair';
  }

  return {
    isValid: true,
    errors,
    warnings,
    quality,
    normalizedCoordinate: normalizedCoord || undefined
  };
}

/**
 * Count decimal places in a number
 */
function countDecimalPlaces(value: number): number {
  if (Math.floor(value) === value) return 0;
  const str = value.toString();
  if (str.indexOf('.') !== -1 && str.indexOf('e-') === -1) {
    return str.split('.')[1].length;
  } else if (str.indexOf('e-') !== -1) {
    const parts = str.split('e-');
    return parseInt(parts[1], 10);
  }
  return 0;
}

/**
 * Format GPS coordinates for display
 */
export function formatCoordinate(coordinate: GPSCoordinate, format: 'decimal' | 'dms' | 'short' = 'decimal'): string {
  switch (format) {
    case 'dms':
      return `${formatDMS(coordinate.latitude, 'lat')}, ${formatDMS(coordinate.longitude, 'lng')}`;
    case 'short':
      return `${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`;
    default:
      return `${coordinate.latitude.toFixed(6)}, ${coordinate.longitude.toFixed(6)}`;
  }
}

/**
 * Format coordinate to degrees, minutes, seconds
 */
function formatDMS(coord: number, type: 'lat' | 'lng'): string {
  const abs = Math.abs(coord);
  const degrees = Math.floor(abs);
  const minutes = Math.floor((abs - degrees) * 60);
  const seconds = ((abs - degrees) * 60 - minutes) * 60;
  
  const direction = type === 'lat' 
    ? (coord >= 0 ? 'N' : 'S')
    : (coord >= 0 ? 'E' : 'W');
  
  return `${degrees}°${minutes}'${seconds.toFixed(2)}"${direction}`;
}

/**
 * Batch validate multiple coordinates
 */
export function validateMultipleCoordinates(
  coordinates: Array<{ latitude: number | null; longitude: number | null; id?: string }>,
  options: Parameters<typeof validateGPSCoordinate>[2] = {}
): Array<GPSValidationResult & { id?: string }> {
  return coordinates.map((coord, index) => ({
    id: coord.id || index.toString(),
    ...validateGPSCoordinate(coord.latitude, coord.longitude, options)
  }));
}

/**
 * Get quality summary for multiple coordinate validations
 */
export function getValidationSummary(results: GPSValidationResult[]): {
  total: number;
  valid: number;
  invalid: number;
  qualityDistribution: Record<GPSValidationResult['quality'], number>;
  overallQuality: GPSValidationResult['quality'];
} {
  const total = results.length;
  const valid = results.filter(r => r.isValid).length;
  const invalid = total - valid;
  
  const qualityDistribution: Record<GPSValidationResult['quality'], number> = {
    excellent: 0,
    good: 0,
    fair: 0,
    poor: 0,
    invalid: 0
  };
  
  results.forEach(result => {
    qualityDistribution[result.quality]++;
  });
  
  // Determine overall quality
  let overallQuality: GPSValidationResult['quality'] = 'invalid';
  if (valid > 0) {
    const validResults = results.filter(r => r.isValid);
    const avgQualityScore = validResults.reduce((sum, result) => {
      const score = { excellent: 4, good: 3, fair: 2, poor: 1, invalid: 0 }[result.quality];
      return sum + score;
    }, 0) / validResults.length;
    
    if (avgQualityScore >= 3.5) overallQuality = 'excellent';
    else if (avgQualityScore >= 2.5) overallQuality = 'good';
    else if (avgQualityScore >= 1.5) overallQuality = 'fair';
    else overallQuality = 'poor';
  }
  
  return {
    total,
    valid,
    invalid,
    qualityDistribution,
    overallQuality
  };
}