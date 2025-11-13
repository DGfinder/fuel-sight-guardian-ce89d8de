import type {
  RawTripData,
  RouteMetrics,
  RoundTripAnalysis,
  RouteAnalysisResult
} from '@/types/routeAnalysis';

/**
 * Analyze trip data and calculate route metrics
 */
export function analyzeRoutes(trips: RawTripData[]): RouteAnalysisResult {
  // Group trips by route
  const routeGroups = groupTripsByRoute(trips);

  // Calculate metrics for each route
  const routes = Array.from(routeGroups.entries()).map(([routeId, routeTrips]) =>
    calculateRouteMetrics(routeId, routeTrips)
  );

  // Identify and analyze round trips
  const roundTrips = identifyRoundTrips(routes);

  // Calculate summary statistics
  const summary = calculateSummary(trips, routes);

  return {
    routes: routes.sort((a, b) => b.tripCount - a.tripCount), // Sort by trip count
    roundTrips: roundTrips.sort((a, b) => b.pairedTripCount - a.pairedTripCount),
    summary
  };
}

/**
 * Group trips by route (start location -> end location)
 */
function groupTripsByRoute(trips: RawTripData[]): Map<string, RawTripData[]> {
  const groups = new Map<string, RawTripData[]>();

  for (const trip of trips) {
    const routeId = createRouteId(trip.startLocation, trip.endLocation);

    if (!groups.has(routeId)) {
      groups.set(routeId, []);
    }

    groups.get(routeId)!.push(trip);
  }

  return groups;
}

/**
 * Create a unique route identifier from start and end locations
 */
function createRouteId(start: string, end: string): string {
  return `${normalizeLocation(start)} → ${normalizeLocation(end)}`;
}

/**
 * Normalize location names for consistent matching
 */
function normalizeLocation(location: string): string {
  return location
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s-]/g, '');
}

/**
 * Calculate metrics for a single route
 */
function calculateRouteMetrics(routeId: string, trips: RawTripData[]): RouteMetrics {
  const [startLocation, endLocation] = routeId.split(' → ');

  // Calculate trip durations in hours
  const durations = trips.map(trip =>
    (trip.endTime.getTime() - trip.startTime.getTime()) / (1000 * 60 * 60)
  );

  // Calculate distances
  const distances = trips.map(trip => trip.distance);

  // Time metrics
  const avgTime = mean(durations);
  const medianTime = median(durations);
  const minTime = Math.min(...durations);
  const maxTime = Math.max(...durations);
  const timeStdDev = standardDeviation(durations);

  // Distance metrics
  const avgDistance = mean(distances);
  const medianDistance = median(distances);
  const totalDistance = sum(distances);

  // Date range
  const dates = trips.map(trip => trip.startTime);
  const firstTripDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const lastTripDate = new Date(Math.max(...dates.map(d => d.getTime())));

  // Common attributes
  const vehicles = trips.map(trip => trip.vehicle).filter(Boolean);
  const drivers = trips.map(trip => trip.driver).filter(Boolean) as string[];

  const mostCommonVehicles = getMostCommon(vehicles, 3);
  const mostCommonDrivers = getMostCommon(drivers, 3);

  // Confidence level based on sample size and variability
  const confidenceLevel = calculateConfidence(trips.length, timeStdDev / avgTime);

  return {
    routeId,
    startLocation,
    endLocation,
    tripCount: trips.length,
    averageTime: avgTime,
    medianTime,
    minTime,
    maxTime,
    timeStdDev,
    averageDistance: avgDistance,
    medianDistance,
    totalDistance,
    firstTripDate,
    lastTripDate,
    mostCommonVehicles,
    mostCommonDrivers,
    confidenceLevel
  };
}

/**
 * Identify round-trip patterns (routes with matching return routes)
 */
function identifyRoundTrips(routes: RouteMetrics[]): RoundTripAnalysis[] {
  const roundTrips: RoundTripAnalysis[] = [];
  const processed = new Set<string>();

  for (const outbound of routes) {
    // Skip if already processed
    if (processed.has(outbound.routeId)) continue;

    // Look for return route
    const returnRoute = routes.find(r =>
      normalizeLocation(r.startLocation) === normalizeLocation(outbound.endLocation) &&
      normalizeLocation(r.endLocation) === normalizeLocation(outbound.startLocation)
    );

    if (returnRoute) {
      // Mark both as processed
      processed.add(outbound.routeId);
      processed.add(returnRoute.routeId);

      // Calculate round-trip metrics
      const avgRoundTripTime = outbound.averageTime + returnRoute.averageTime;
      const avgRoundTripDistance = outbound.averageDistance + returnRoute.averageDistance;

      roundTrips.push({
        routePair: `${outbound.startLocation} ⇄ ${outbound.endLocation}`,
        outboundRoute: outbound.routeId,
        returnRoute: returnRoute.routeId,
        outboundTrips: outbound.tripCount,
        avgOutboundTime: outbound.averageTime,
        avgOutboundDistance: outbound.averageDistance,
        returnTrips: returnRoute.tripCount,
        avgReturnTime: returnRoute.averageTime,
        avgReturnDistance: returnRoute.averageDistance,
        avgRoundTripTime,
        avgRoundTripDistance,
        pairedTripCount: Math.min(outbound.tripCount, returnRoute.tripCount)
      });
    }
  }

  return roundTrips;
}

/**
 * Calculate overall summary statistics
 */
function calculateSummary(trips: RawTripData[], routes: RouteMetrics[]) {
  const dates = trips.map(trip => trip.startTime);
  const totalDistance = routes.reduce((sum, route) => sum + route.totalDistance, 0);
  const totalTime = trips.reduce((sum, trip) =>
    sum + (trip.endTime.getTime() - trip.startTime.getTime()) / (1000 * 60 * 60), 0
  );

  return {
    totalTrips: trips.length,
    uniqueRoutes: routes.length,
    dateRange: {
      from: new Date(Math.min(...dates.map(d => d.getTime()))),
      to: new Date(Math.max(...dates.map(d => d.getTime())))
    },
    totalDistance,
    totalTime
  };
}

/**
 * Calculate confidence level based on sample size and variability
 */
function calculateConfidence(
  sampleSize: number,
  coefficientOfVariation: number
): 'Low' | 'Medium' | 'High' {
  if (sampleSize >= 10 && coefficientOfVariation < 0.3) {
    return 'High';
  } else if (sampleSize >= 5 && coefficientOfVariation < 0.5) {
    return 'Medium';
  } else {
    return 'Low';
  }
}

/**
 * Get the most common items from an array
 */
function getMostCommon<T>(arr: T[], limit: number): T[] {
  const counts = new Map<T, number>();

  for (const item of arr) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([item]) => item);
}

/**
 * Statistical helper functions
 */

function mean(numbers: number[]): number {
  return sum(numbers) / numbers.length;
}

function median(numbers: number[]): number {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    return sorted[mid];
  }
}

function sum(numbers: number[]): number {
  return numbers.reduce((acc, val) => acc + val, 0);
}

function standardDeviation(numbers: number[]): number {
  const avg = mean(numbers);
  const squareDiffs = numbers.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = mean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Export analysis results to CSV format
 */
export function exportToCSV(analysis: RouteAnalysisResult): string {
  const lines: string[] = [];

  // Summary section
  lines.push('ROUTE ANALYSIS SUMMARY');
  lines.push(`Total Trips,${analysis.summary.totalTrips}`);
  lines.push(`Unique Routes,${analysis.summary.uniqueRoutes}`);
  lines.push(`Date Range,${analysis.summary.dateRange.from.toLocaleDateString()} - ${analysis.summary.dateRange.to.toLocaleDateString()}`);
  lines.push(`Total Distance (km),${analysis.summary.totalDistance.toFixed(2)}`);
  lines.push(`Total Time (hours),${analysis.summary.totalTime.toFixed(2)}`);
  lines.push('');

  // Route metrics section
  lines.push('ROUTE METRICS');
  lines.push('Route,Trips,Avg Time (hrs),Median Time (hrs),Min Time (hrs),Max Time (hrs),Avg Distance (km),Total Distance (km),Confidence');

  for (const route of analysis.routes) {
    lines.push([
      route.routeId,
      route.tripCount,
      route.averageTime.toFixed(2),
      route.medianTime.toFixed(2),
      route.minTime.toFixed(2),
      route.maxTime.toFixed(2),
      route.averageDistance.toFixed(2),
      route.totalDistance.toFixed(2),
      route.confidenceLevel
    ].join(','));
  }

  lines.push('');

  // Round-trip section
  lines.push('ROUND-TRIP ANALYSIS');
  lines.push('Route Pair,Outbound Trips,Avg Outbound Time (hrs),Avg Outbound Distance (km),Return Trips,Avg Return Time (hrs),Avg Return Distance (km),Avg Round-Trip Time (hrs),Avg Round-Trip Distance (km)');

  for (const rt of analysis.roundTrips) {
    lines.push([
      rt.routePair,
      rt.outboundTrips,
      rt.avgOutboundTime.toFixed(2),
      rt.avgOutboundDistance.toFixed(2),
      rt.returnTrips,
      rt.avgReturnTime.toFixed(2),
      rt.avgReturnDistance.toFixed(2),
      rt.avgRoundTripTime.toFixed(2),
      rt.avgRoundTripDistance.toFixed(2)
    ].join(','));
  }

  return lines.join('\n');
}

/**
 * Format time in hours to a human-readable string
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  } else if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  } else {
    const days = Math.floor(hours / 24);
    const h = Math.round(hours % 24);
    return `${days}d ${h}h`;
  }
}
