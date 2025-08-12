// Geocoding utility for converting addresses and location names to GPS coordinates
// Uses OpenStreetMap Nominatim service (free, no API key required)

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  display_name: string;
  confidence: number; // 0-1 scale
  source: 'nominatim' | 'manual' | 'fallback';
}

export interface GeocodingError {
  success: false;
  error: string;
  query: string;
}

export type GeocodingResponse = GeocodingResult | GeocodingError;

// Rate limiting for Nominatim API (1 request per second max)
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

async function rateLimitedDelay(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  
  lastRequestTime = Date.now();
}

// Cache for geocoding results to avoid repeated API calls
const geocodingCache = new Map<string, GeocodingResult>();

/**
 * Geocode a location using OpenStreetMap Nominatim service
 * @param query - Address or location name to geocode
 * @param countryCode - Country code to limit search (default: AU for Australia)
 * @param useCache - Whether to use cached results (default: true)
 */
export async function geocodeLocation(
  query: string,
  countryCode: string = 'AU',
  useCache: boolean = true
): Promise<GeocodingResponse> {
  if (!query || query.trim().length < 3) {
    return {
      success: false,
      error: 'Query too short or empty',
      query
    };
  }

  const normalizedQuery = query.trim().toLowerCase();
  const cacheKey = `${normalizedQuery}:${countryCode}`;

  // Check cache first
  if (useCache && geocodingCache.has(cacheKey)) {
    return geocodingCache.get(cacheKey)!;
  }

  try {
    // Rate limiting
    await rateLimitedDelay();

    // Nominatim API endpoint
    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
    nominatimUrl.searchParams.set('q', query);
    nominatimUrl.searchParams.set('format', 'jsonv2');
    nominatimUrl.searchParams.set('limit', '1');
    nominatimUrl.searchParams.set('countrycodes', countryCode);
    nominatimUrl.searchParams.set('addressdetails', '1');

    console.log(`[GEOCODING] Querying Nominatim for: "${query}"`);

    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        'User-Agent': 'fuel-sight-guardian-app/1.0 (contact@example.com)' // Required by Nominatim
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      return {
        success: false,
        error: 'No results found',
        query
      };
    }

    const result = results[0];
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      return {
        success: false,
        error: 'Invalid coordinates in result',
        query
      };
    }

    // Calculate confidence based on result type and importance
    let confidence = 0.5; // Default confidence
    
    if (result.importance) {
      confidence = Math.min(0.9, result.importance * 2); // Scale importance to confidence
    }
    
    // Boost confidence for exact matches
    if (result.display_name.toLowerCase().includes(normalizedQuery)) {
      confidence = Math.min(1.0, confidence + 0.2);
    }

    const geocodingResult: GeocodingResult = {
      latitude,
      longitude,
      display_name: result.display_name,
      confidence,
      source: 'nominatim'
    };

    // Cache the result
    if (useCache) {
      geocodingCache.set(cacheKey, geocodingResult);
    }

    console.log(`[GEOCODING] Success: "${query}" -> ${latitude}, ${longitude} (confidence: ${confidence.toFixed(2)})`);

    return geocodingResult;

  } catch (error) {
    console.error(`[GEOCODING] Failed to geocode "${query}":`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown geocoding error',
      query
    };
  }
}

/**
 * Geocode SmartFill location using customer name and unit description
 * Tries multiple geocoding strategies to find the best match
 */
export async function geocodeSmartFillLocation(
  customerName: string,
  unitDescription: string,
  unitNumber: string
): Promise<GeocodingResponse> {
  // Try different geocoding strategies in order of preference
  const strategies = [
    // Strategy 1: Unit description (often contains location info)
    unitDescription,
    
    // Strategy 2: Customer name + unit description
    `${customerName} ${unitDescription}`,
    
    // Strategy 3: Customer name with unit number
    `${customerName} Unit ${unitNumber}`,
    
    // Strategy 4: Just customer name
    customerName
  ];

  for (const [index, query] of strategies.entries()) {
    if (!query || query.trim().length < 3) {
      continue;
    }

    console.log(`[GEOCODING] SmartFill strategy ${index + 1}: "${query}"`);

    const result = await geocodeLocation(query);
    
    if ('latitude' in result) {
      // Success - adjust confidence based on strategy used
      const strategyConfidence = [0.9, 0.8, 0.6, 0.4][index]; // Best to worst strategy
      result.confidence = Math.min(result.confidence, strategyConfidence);
      
      console.log(`[GEOCODING] SmartFill success with strategy ${index + 1}: ${result.latitude}, ${result.longitude}`);
      return result;
    }

    // Add delay between strategies to respect rate limiting
    if (index < strategies.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return {
    success: false,
    error: 'All geocoding strategies failed',
    query: `${customerName} | ${unitDescription} | Unit ${unitNumber}`
  };
}

/**
 * Validate GPS coordinates
 */
export function validateCoordinates(latitude: number, longitude: number): boolean {
  return (
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    Math.abs(latitude) > 0.000001 && // Not exactly zero
    Math.abs(longitude) > 0.000001
  );
}

/**
 * Get cached geocoding results count (for monitoring)
 */
export function getGeocodingCacheStats(): { size: number; maxSize: number } {
  return {
    size: geocodingCache.size,
    maxSize: 1000 // We'll implement cache cleanup if needed
  };
}

/**
 * Clear geocoding cache
 */
export function clearGeocodingCache(): void {
  geocodingCache.clear();
  console.log('[GEOCODING] Cache cleared');
}

/**
 * Australia-specific coordinate validation
 * Ensures coordinates are within reasonable bounds for Australia
 */
export function validateAustralianCoordinates(latitude: number, longitude: number): boolean {
  if (!validateCoordinates(latitude, longitude)) {
    return false;
  }

  // Australia bounding box (approximate)
  const australiaBounds = {
    north: -9.0,     // Northern Territory
    south: -55.0,    // Tasmania/Antarctica territory
    east: 160.0,     // Norfolk Island area
    west: 110.0      // Western Australia
  };

  return (
    latitude >= australiaBounds.south &&
    latitude <= australiaBounds.north &&
    longitude >= australiaBounds.west &&
    longitude <= australiaBounds.east
  );
}