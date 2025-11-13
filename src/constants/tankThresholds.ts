/**
 * Tank and sensor threshold constants for agbot diesel tank monitoring
 */

// Fuel level thresholds (percentages)
export const CRITICAL_FUEL_THRESHOLD = 20; // % - Below this triggers critical alerts
export const LOW_FUEL_THRESHOLD = 30; // % - Below this shows warning
export const MEDIUM_FUEL_THRESHOLD = 50; // % - Between low and good
export const GOOD_FUEL_THRESHOLD = 70; // % - Above this is good level

// Data freshness thresholds (milliseconds)
export const DATA_FRESHNESS_RECENT = 2 * 60 * 60 * 1000; // 2 hours - "Recent" data
export const DATA_FRESHNESS_STALE = 24 * 60 * 60 * 1000; // 24 hours - "Stale" data
// Anything beyond DATA_FRESHNESS_STALE is considered "Very Old"

// Default values
export const DEFAULT_TANK_CAPACITY = 50000; // Litres - used when no capacity configured
export const MIN_VALID_CAPACITY = 100; // Litres - minimum reasonable tank size
export const MAX_VALID_CAPACITY = 200000; // Litres - maximum reasonable tank size

// Sensor validation ranges
export const SENSOR_RANGES = {
  // Temperature ranges (Celsius)
  temperature: {
    min: -40,
    max: 85,
    warning: {
      low: 0,
      high: 60,
    },
  },
  // Depth ranges (meters)
  depth: {
    min: 0,
    max: 20, // Most tanks won't exceed 20m depth
  },
  // Pressure ranges (kPa)
  pressure: {
    min: 0,
    max: 5000, // 50 bar
  },
  // Battery voltage (Volts)
  battery: {
    min: 2.0,
    max: 4.5,
    warning: {
      low: 3.0, // Below this, battery may need attention
      critical: 2.5, // Below this, battery critically low
    },
  },
} as const;

// Data freshness status types
export type DataFreshnessStatus = 'recent' | 'stale' | 'very-old';

/**
 * Determines data freshness status based on timestamp
 */
export function getDataFreshnessStatus(timestamp: string | null | undefined): DataFreshnessStatus {
  if (!timestamp) return 'very-old';

  const now = Date.now();
  const readingTime = new Date(timestamp).getTime();
  const ageMs = now - readingTime;

  if (ageMs < DATA_FRESHNESS_RECENT) return 'recent';
  if (ageMs < DATA_FRESHNESS_STALE) return 'stale';
  return 'very-old';
}

/**
 * Gets human-readable label for data freshness status
 */
export function getDataFreshnessLabel(status: DataFreshnessStatus): string {
  switch (status) {
    case 'recent':
      return 'Recent Data';
    case 'stale':
      return 'Stale Data';
    case 'very-old':
      return 'Very Old Data';
  }
}

/**
 * Gets color class for data freshness badge
 */
export function getDataFreshnessColor(status: DataFreshnessStatus): string {
  switch (status) {
    case 'recent':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'stale':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'very-old':
      return 'bg-red-100 text-red-800 border-red-300';
  }
}

/**
 * Checks if capacity value is estimated/default vs configured
 */
export function isCapacityEstimated(capacity: number): boolean {
  return capacity === DEFAULT_TANK_CAPACITY;
}

/**
 * Validates if capacity is within reasonable range
 */
export function isCapacityValid(capacity: number): boolean {
  return capacity >= MIN_VALID_CAPACITY && capacity <= MAX_VALID_CAPACITY;
}
