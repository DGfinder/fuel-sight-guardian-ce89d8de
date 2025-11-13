import React from 'react';
import { Download, TrendingUp, MapPin, Clock, ArrowRight, Database } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import RouteAnalysisUpload from '@/components/RouteAnalysisUpload';
import RouteMetricsTable from '@/components/RouteMetricsTable';
import RoutePatternGenerator from '@/components/RoutePatternGenerator';
import { useRouteAnalysisDashboard } from '@/hooks/useRoutePatterns';
import { exportToCSV } from '@/services/routeAnalysisService';

export default function RouteAnalysisPage() {
  const {
    patterns,
    stats,
    tripCount,
    dateRange,
    isLoading
  } = useRouteAnalysisDashboard();

  const hasPatterns = patterns.length > 0;

  const handleExportCSV = () => {
    if (!hasPatterns) return;

    // Convert database patterns to export format
    const csvData = generateCSVFromPatterns(patterns, stats, tripCount, dateRange);

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `route-analysis-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Route Analysis</h2>
          <p className="text-muted-foreground mt-2">
            Database-driven route pattern analysis for accurate trip time and distance calculations
          </p>
        </div>
        {hasPatterns && (
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {stats && tripCount !== undefined && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Trips in Database</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tripCount.toLocaleString()}</div>
              {dateRange && (
                <p className="text-xs text-muted-foreground">
                  {new Date(dateRange.from || '').toLocaleDateString()} -{' '}
                  {new Date(dateRange.to || '').toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Route Patterns</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRoutes}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalTripsInPatterns.toLocaleString()} trips analyzed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Distance</CardTitle>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalDistance.toLocaleString('en-US', {
                  maximumFractionDigits: 0
                })}{' '}
                km
              </div>
              <p className="text-xs text-muted-foreground">
                Across all analyzed routes
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Efficiency</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.avgEfficiency}%
              </div>
              <p className="text-xs text-muted-foreground">
                Route efficiency rating
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Import Section */}
      <RouteAnalysisUpload />

      {/* Route Pattern Generator */}
      <RoutePatternGenerator />

      {/* Route Metrics Table */}
      {hasPatterns ? (
        <RouteMetricsTable routes={patterns} isLoading={isLoading} />
      ) : !isLoading && tripCount && tripCount > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Route Patterns Generated</CardTitle>
            <CardDescription>
              You have {tripCount.toLocaleString()} trips in the database, but route patterns haven't been generated yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Click the "Generate Patterns" button above to analyze your trip history and calculate average times and distances for each route.
            </p>
          </CardContent>
        </Card>
      ) : !isLoading && tripCount === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Get Started</CardTitle>
            <CardDescription>Upload trip history data to begin route analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h4 className="font-medium mb-1">Upload MtData Excel File</h4>
                <p className="text-sm text-muted-foreground">
                  Import trip history from your MtData Trip History Report. The file will be parsed and trips will be stored in the database.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h4 className="font-medium mb-1">Generate Route Patterns</h4>
                <p className="text-sm text-muted-foreground">
                  Click "Generate Patterns" to analyze all trips and identify common routes with their average times and distances.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h4 className="font-medium mb-1">Review Route Analytics</h4>
                <p className="text-sm text-muted-foreground">
                  View average times, distances, and efficiency metrics for each route. Export results for rate planning.
                </p>
              </div>
            </div>

            <div className="border-t pt-4 mt-6">
              <h4 className="font-medium mb-2">Why Database-Driven Analysis?</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Persistent Data:</strong> Trips are stored permanently, no need to re-upload</span>
                </li>
                <li className="flex items-start gap-2">
                  <TrendingUp className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Cumulative Analysis:</strong> Route patterns improve as more data is added</span>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Spatial Analysis:</strong> Uses PostGIS for accurate terminal identification</span>
                </li>
                <li className="flex items-start gap-2">
                  <Database className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span><strong>Filter & Query:</strong> Analyze by date range, fleet, depot, or vehicle</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/**
 * Generate CSV export from route patterns
 */
function generateCSVFromPatterns(
  patterns: any[],
  stats: any,
  tripCount: number,
  dateRange: any
): string {
  const lines: string[] = [];

  // Summary section
  lines.push('ROUTE ANALYSIS SUMMARY');
  lines.push(`Total Trips in Database,${tripCount}`);
  lines.push(`Route Patterns Generated,${stats?.totalRoutes || 0}`);
  lines.push(`Trips Analyzed in Patterns,${stats?.totalTripsInPatterns || 0}`);
  if (dateRange) {
    lines.push(`Date Range,${new Date(dateRange.from).toLocaleDateString()} - ${new Date(dateRange.to).toLocaleDateString()}`);
  }
  lines.push(`Total Distance (km),${stats?.totalDistance?.toFixed(2) || 0}`);
  lines.push(`Average Efficiency,${stats?.avgEfficiency || 0}%`);
  lines.push('');

  // Route patterns section
  lines.push('ROUTE PATTERNS');
  lines.push('Start Location,End Location,Start Area,End Area,Trip Count,Avg Time (hrs),Best Time (hrs),Worst Time (hrs),Avg Distance (km),Efficiency %,Time Variability (hrs),Common Vehicles,Common Drivers,First Seen,Last Used');

  for (const route of patterns) {
    lines.push([
      route.start_location,
      route.end_location,
      route.start_area || '',
      route.end_area || '',
      route.trip_count,
      route.average_travel_time_hours.toFixed(2),
      route.best_time_hours.toFixed(2),
      route.worst_time_hours.toFixed(2),
      route.average_distance_km.toFixed(2),
      route.efficiency_rating.toFixed(0),
      route.time_variability.toFixed(2),
      (route.most_common_vehicles || []).join('; '),
      (route.most_common_drivers || []).join('; '),
      new Date(route.first_seen).toLocaleDateString(),
      new Date(route.last_used).toLocaleDateString()
    ].map(v => `"${v}"`).join(','));
  }

  return lines.join('\n');
}
