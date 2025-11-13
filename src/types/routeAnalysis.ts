// Route Analysis Types

export interface RawTripData {
  vehicle: string;
  startLocation: string;
  endLocation: string;
  startTime: Date;
  endTime: Date;
  distance: number;
  driver?: string;
}

export interface RouteMetrics {
  routeId: string;
  startLocation: string;
  endLocation: string;
  tripCount: number;

  // Time metrics (in hours)
  averageTime: number;
  medianTime: number;
  minTime: number;
  maxTime: number;
  timeStdDev: number;

  // Distance metrics (in km)
  averageDistance: number;
  medianDistance: number;
  totalDistance: number;

  // Date range
  firstTripDate: Date;
  lastTripDate: Date;

  // Common attributes
  mostCommonVehicles: string[];
  mostCommonDrivers: string[];

  // Confidence metric
  confidenceLevel: 'Low' | 'Medium' | 'High';
}

export interface RoundTripAnalysis {
  routePair: string;
  outboundRoute: string;
  returnRoute: string;

  // Outbound metrics
  outboundTrips: number;
  avgOutboundTime: number;
  avgOutboundDistance: number;

  // Return metrics
  returnTrips: number;
  avgReturnTime: number;
  avgReturnDistance: number;

  // Round-trip totals
  avgRoundTripTime: number;
  avgRoundTripDistance: number;

  // Paired trips (matched outbound/return)
  pairedTripCount: number;
}

export interface RouteAnalysisResult {
  routes: RouteMetrics[];
  roundTrips: RoundTripAnalysis[];
  summary: {
    totalTrips: number;
    uniqueRoutes: number;
    dateRange: {
      from: Date;
      to: Date;
    };
    totalDistance: number;
    totalTime: number;
  };
}

export interface ExcelParseError {
  row: number;
  column?: string;
  message: string;
  value?: unknown;
}

export interface ExcelParseResult {
  success: boolean;
  trips: RawTripData[];
  errors: ExcelParseError[];
  rowsParsed: number;
  rowsSkipped: number;
}
