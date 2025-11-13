import React from 'react';
import { RefreshCw, Database, TrendingUp, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useUpdateRoutePatterns, useRoutePatternStats, useTripCount } from '@/hooks/useRoutePatterns';

export default function RoutePatternGenerator() {
  const updateMutation = useUpdateRoutePatterns();
  const { data: stats, isLoading: statsLoading } = useRoutePatternStats();
  const { data: tripCount, isLoading: tripCountLoading } = useTripCount();

  const handleGenerate = () => {
    updateMutation.mutate();
  };

  const hasRoutePatterns = stats && stats.totalRoutes > 0;
  const hasTrips = tripCount && tripCount > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Route Pattern Analysis
            </CardTitle>
            <CardDescription>
              Generate route patterns from trip history stored in the database
            </CardDescription>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={updateMutation.isPending || !hasTrips || tripCountLoading}
            size="lg"
          >
            {updateMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <TrendingUp className="mr-2 h-4 w-4" />
                {hasRoutePatterns ? 'Regenerate Patterns' : 'Generate Patterns'}
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Database Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Trips in Database</p>
            <p className="text-2xl font-bold">
              {tripCountLoading ? '...' : tripCount?.toLocaleString() || 0}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Route Patterns</p>
            <p className="text-2xl font-bold">
              {statsLoading ? '...' : stats?.totalRoutes || 0}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Trips Analyzed</p>
            <p className="text-2xl font-bold">
              {statsLoading ? '...' : stats?.totalTripsInPatterns?.toLocaleString() || 0}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Avg Efficiency</p>
            <p className="text-2xl font-bold">
              {statsLoading ? '...' : stats?.avgEfficiency ? `${stats.avgEfficiency}%` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Status Messages */}
        {!hasTrips && !tripCountLoading && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Trips in Database</AlertTitle>
            <AlertDescription>
              Upload an Excel file to import trip history data before generating route patterns.
            </AlertDescription>
          </Alert>
        )}

        {!hasRoutePatterns && hasTrips && !statsLoading && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Route Patterns Not Generated</AlertTitle>
            <AlertDescription>
              You have {tripCount?.toLocaleString()} trips in the database.
              Click "Generate Patterns" to analyze routes and calculate average times and distances.
            </AlertDescription>
          </Alert>
        )}

        {hasRoutePatterns && !updateMutation.isPending && (
          <Alert>
            <TrendingUp className="h-4 w-4" />
            <AlertTitle>Route Patterns Generated</AlertTitle>
            <AlertDescription>
              Found {stats?.totalRoutes} unique routes from {stats?.totalTripsInPatterns.toLocaleString()} trips.
              {tripCount && stats && tripCount > stats.totalTripsInPatterns && (
                <> There are {(tripCount - stats.totalTripsInPatterns).toLocaleString()} new trips
                  that haven't been analyzed yet. Click "Regenerate Patterns" to include them.</>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* How It Works */}
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium mb-3 text-sm">How Route Pattern Analysis Works:</h4>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-semibold text-primary">1.</span>
              <span>Analyzes all trips in the database to identify common routes (requires 10+ trips per route)</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-primary">2.</span>
              <span>Calculates average times, distances, and efficiency metrics for each route</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-primary">3.</span>
              <span>Identifies time variability and optimization opportunities</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-primary">4.</span>
              <span>Stores results in the route_patterns table for fast querying and reporting</span>
            </li>
          </ol>
        </div>

        {/* Technical Info */}
        <div className="text-xs text-muted-foreground border-t pt-3 mt-3">
          <p>
            <strong>Database Function:</strong> update_route_patterns() |
            <strong className="ml-2">Minimum Trips:</strong> 10 per route |
            <strong className="ml-2">Analysis includes:</strong> Time, distance, efficiency, variability
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
