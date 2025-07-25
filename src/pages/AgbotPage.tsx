import React, { useState, useEffect } from 'react';
import { RefreshCw, Signal, AlertTriangle, CheckCircle2, Filter, Zap, Grid3X3, List } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  useAgbotLocations, 
  useAgbotSummary, 
  useAgbotSync, 
  useFilteredAgbotLocations,
  formatTimestamp,
  usePercentageColor,
  usePercentageBackground
} from '@/hooks/useAgbotData';
import { AgbotModalProvider, useAgbotModal } from '@/contexts/AgbotModalContext';
import AgbotLocationCard from '@/components/agbot/AgbotLocationCard';
import AgbotTable from '@/components/agbot/AgbotTable';
import AgbotDetailsModal from '@/components/AgbotDetailsModal';

function AgbotPageContent() {
  const [searchFilter, setSearchFilter] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [lowFuelOnly, setLowFuelOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Load view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem('agbot-view-mode') as 'grid' | 'table';
    if (savedView) {
      setViewMode(savedView);
    }
  }, []);

  // Save view preference to localStorage
  const handleViewChange = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('agbot-view-mode', mode);
  };

  const { data: locations, isLoading, error } = useFilteredAgbotLocations({
    customerName: searchFilter,
    onlineOnly,
    lowFuelOnly
  });

  const summary = useAgbotSummary();
  const syncMutation = useAgbotSync();

  const handleSync = () => {
    syncMutation.mutate();
  };

  if (isLoading) {
    return (
      <AppLayout selectedGroup="" onGroupSelect={() => {}}>
        <div className="min-h-screen w-full bg-muted flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading agbot data...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout selectedGroup="" onGroupSelect={() => {}}>
        <div className="min-h-screen w-full bg-muted p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load agbot data: {error.message}
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout selectedGroup="" onGroupSelect={() => {}}>
      <div className="min-h-screen w-full bg-muted">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20">
          <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Signal className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Agbot Monitoring</h1>
                  <p className="text-gray-600 mt-1">
                    Cellular tank monitoring - {summary.totalAssets} devices across {summary.totalLocations} locations
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {/* View Toggle */}
                <div className="flex border rounded-lg bg-white">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('grid')}
                    className="rounded-r-none"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('table')}
                    className="rounded-l-none"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                  {syncMutation.isPending ? 'Syncing...' : 'Sync Data'}
                </Button>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{summary.totalLocations}</div>
                  <div className="text-sm text-muted-foreground">Locations</div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{summary.totalAssets}</div>
                  <div className="text-sm text-muted-foreground">Devices</div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{summary.onlineAssets}</div>
                  <div className="text-sm text-muted-foreground">Online</div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-center">
                  <div className={`text-2xl font-bold ${usePercentageColor(summary.averageFillPercentage)}`}>
                    {summary.averageFillPercentage}%
                  </div>
                  <div className="text-sm text-muted-foreground">Avg Level</div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{summary.lowFuelCount}</div>
                  <div className="text-sm text-muted-foreground">Low Fuel</div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg border">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Filters:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input
                    placeholder="Search locations..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-48"
                  />
                  <Button
                    variant={onlineOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setOnlineOnly(!onlineOnly)}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Online Only
                  </Button>
                  <Button
                    variant={lowFuelOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setLowFuelOnly(!lowFuelOnly)}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Low Fuel Only
                  </Button>
                  {(searchFilter || onlineOnly || lowFuelOnly) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchFilter('');
                        setOnlineOnly(false);
                        setLowFuelOnly(false);
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Active Filters Display */}
            {(searchFilter || onlineOnly || lowFuelOnly) && (
              <div className="flex gap-2 flex-wrap">
                {searchFilter && (
                  <Badge variant="secondary">
                    Search: "{searchFilter}"
                  </Badge>
                )}
                {onlineOnly && (
                  <Badge variant="secondary">
                    Online devices only
                  </Badge>
                )}
                {lowFuelOnly && (
                  <Badge variant="secondary">
                    Low fuel only
                  </Badge>
                )}
                <Badge variant="outline">
                  {locations?.length || 0} locations shown
                </Badge>
              </div>
            )}

            {/* Sync Status */}
            {syncMutation.isPending && (
              <Alert>
                <Zap className="h-4 w-4" />
                <AlertDescription>
                  Syncing data from Athara API...
                </AlertDescription>
              </Alert>
            )}

            {/* Location Display */}
            {locations && locations.length > 0 ? (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {locations.map((location) => (
                    <AgbotLocationCard 
                      key={location.id} 
                      location={location} 
                    />
                  ))}
                </div>
              ) : (
                <AgbotTable locations={locations} />
              )
            ) : (
              <div className="text-center py-12 bg-white rounded-lg border">
                <Signal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {locations?.length === 0 && (searchFilter || onlineOnly || lowFuelOnly)
                    ? 'No locations match your filters'
                    : 'No agbot data available'
                  }
                </h3>
                <p className="text-muted-foreground mb-4">
                  {locations?.length === 0 && (searchFilter || onlineOnly || lowFuelOnly)
                    ? 'Try adjusting your search criteria or filters.'
                    : 'Sync data from the Athara API to see your agbot devices.'
                  }
                </p>
                {(!locations || locations.length === 0) && !searchFilter && !onlineOnly && !lowFuelOnly && (
                  <Button onClick={handleSync} disabled={syncMutation.isPending}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sync Agbot Data
                  </Button>
                )}
              </div>
            )}

            {/* Info Note */}
            <Alert>
              <AlertDescription>
                Agbot devices report fuel levels as percentages via cellular transmission. 
                Data is automatically refreshed every 10 minutes (optimized for hourly cellular reports). This system is separate from manual dip readings.
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
      
      {/* Agbot Details Modal */}
      <AgbotDetailsModal />
    </AppLayout>
  );
}

// Main component with provider
export default function AgbotPage() {
  return (
    <AgbotModalProvider>
      <AgbotPageContent />
    </AgbotModalProvider>
  );
}