import React, { useState, useEffect, useMemo } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RefreshCw, Signal, AlertTriangle, CheckCircle2, Filter, Zap, Grid3X3, List, Upload, Globe, Gauge, TrendingUp, Activity, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { 
  useAgbotLocations, 
  useAgbotSummary, 
  useFilteredAgbotLocations,
  formatTimestamp,
  usePercentageColor,
  usePercentageBackground
} from '@/hooks/useAgbotData';
import { AgbotModalProvider, useAgbotModal } from '@/contexts/AgbotModalContext';
import AgbotLocationCard from '@/components/agbot/AgbotLocationCard';
import AgbotTable from '@/components/agbot/AgbotTable';
import AgbotDetailsModal from '@/components/AgbotDetailsModal';
import { AgbotWebhookHealthStatus } from '@/components/agbot/AgbotWebhookHealthStatus';
import { AgbotWebhookMonitoring } from '@/components/agbot/AgbotWebhookMonitoring';
import AtharaWebhookMonitor from '@/components/agbot/AtharaWebhookMonitor';
import { AgbotErrorBoundary } from '@/components/agbot/AgbotErrorBoundary';
import AgbotCSVImportModal, { type AgbotCSVRow } from '@/components/AgbotCSVImportModal';
import { importAgbotFromCSV } from '@/services/agbot-api';
import { useToast } from '@/hooks/use-toast';

function AgbotPageContent() {
  const [searchFilter, setSearchFilter] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [lowFuelOnly, setLowFuelOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'grouped'>('grouped');
  const [showSystemMonitoring, setShowSystemMonitoring] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());

  // Load view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem('agbot-view-mode') as 'grid' | 'table' | 'grouped';
    if (savedView) {
      setViewMode(savedView);
    }
  }, []);

  // Save view preference to localStorage
  const handleViewChange = (mode: 'grid' | 'table' | 'grouped') => {
    setViewMode(mode);
    localStorage.setItem('agbot-view-mode', mode);
  };

  // Auto-expand all customers on initial load
  useEffect(() => {
    if (locations && locations.length > 0 && expandedCustomers.size === 0 && viewMode === 'grouped') {
      const allCustomers = new Set(locations.map(loc => loc.customer_name).filter(Boolean));
      setExpandedCustomers(allCustomers);
    }
  }, [locations, viewMode]);

  const toggleCustomerExpanded = (customerName: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerName)) {
      newExpanded.delete(customerName);
    } else {
      newExpanded.add(customerName);
    }
    setExpandedCustomers(newExpanded);
  };

  const expandAllCustomers = () => {
    const allCustomers = new Set(locations?.map(loc => loc.customer_name).filter(Boolean) || []);
    setExpandedCustomers(allCustomers);
  };

  const collapseAllCustomers = () => {
    setExpandedCustomers(new Set());
  };

  const { data: locations, isLoading, error } = useFilteredAgbotLocations({
    customerName: searchFilter,
    onlineOnly,
    lowFuelOnly
  });

  const summary = useAgbotSummary();
  const { toast } = useToast();

  // Group locations by customer for grouped view
  const groupedLocations = useMemo(() => {
    if (!locations || viewMode !== 'grouped') return {};

    const grouped: Record<string, typeof locations> = {};
    locations.forEach(location => {
      const customerName = location.customer_name || 'Unknown Customer';
      if (!grouped[customerName]) {
        grouped[customerName] = [];
      }
      grouped[customerName].push(location);
    });

    return grouped;
  }, [locations, viewMode]);

  // Auto-expand all customers on first load when grouped view is active
  useEffect(() => {
    if (locations && locations.length > 0 && expandedCustomers.size === 0 && viewMode === 'grouped') {
      const allCustomers = new Set(locations.map(loc => loc.customer_name).filter(Boolean));
      setExpandedCustomers(allCustomers);
    }
  }, [locations, viewMode, expandedCustomers.size]);

  const handleCSVImport = async (csvData: AgbotCSVRow[]) => {
    setIsImporting(true);
    try {
      const result = await importAgbotFromCSV(csvData);
      
      if (result.success) {
        toast({
          title: 'CSV Import Successful',
          description: `Imported ${result.locationsImported} locations and ${result.assetsImported} assets in ${result.duration}ms`,
        });
        
        // Refresh the data
        window.location.reload(); // Simple refresh - could be optimized with query invalidation
      } else {
        toast({
          title: 'CSV Import Partially Successful',
          description: `Imported ${result.locationsImported} locations with ${result.errors.length} errors. Check console for details.`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'CSV Import Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
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
          <div className="max-w-4xl mx-auto">
            <AgbotErrorBoundary 
              error={error} 
              retry={() => window.location.reload()}
              showTechnicalDetails={true}
            />
          </div>
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
                <div className="p-2 bg-green-100 rounded-lg">
                  <Signal className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Gasbot Monitoring</h1>
                  <p className="text-gray-600 mt-1">
                    Real-time webhook data - {summary.totalAssets} devices across {summary.totalLocations} locations
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {/* Webhook Health Status - Compact */}
                <AgbotWebhookHealthStatus showFullDetails={false} className="mr-2" />
                
                {/* System Monitoring Toggle */}
                <Button
                  variant={showSystemMonitoring ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowSystemMonitoring(!showSystemMonitoring)}
                  className={showSystemMonitoring ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Athara Monitor
                </Button>

                {/* View Toggle - Grid | Table | Grouped */}
                <div className="flex border rounded-lg bg-white">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('grid')}
                    className={`rounded-r-none ${viewMode === 'grid' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    title="Grid View"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('table')}
                    className={`rounded-none ${viewMode === 'table' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    title="Table View"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'grouped' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => handleViewChange('grouped')}
                    className={`rounded-l-none ${viewMode === 'grouped' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    title="Grouped by Customer"
                  >
                    <Building2 className="h-4 w-4" />
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowCSVImport(true)}
                  disabled={isImporting}
                  className="flex items-center gap-2 border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                >
                  <Upload className={`h-4 w-4 ${isImporting ? 'animate-spin' : ''}`} />
                  {isImporting ? 'Importing...' : 'Import CSV'}
                </Button>
                <Button
                  onClick={() => window.open('https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook', '_blank')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Globe className="h-4 w-4" />
                  Webhook Endpoint
                </Button>
              </div>
            </div>

            {/* Webhook Monitoring Panel - Enhanced Athara Monitor */}
            {showSystemMonitoring && (
              <>
                <AtharaWebhookMonitor />
                <AgbotWebhookMonitoring />
              </>
            )}

            {/* Great Southern Fuels - Fleet Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Fleet Overview */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Fleet Overview</h3>
                  <Signal className="h-5 w-5 text-green-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Locations</span>
                    <span className="text-sm font-bold text-gray-900">{summary.totalLocations}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Active Devices</span>
                    <span className="text-sm font-bold text-green-600">{summary.onlineAssets}/{summary.totalAssets}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Agricultural: {summary.categories.agricultural}</span>
                    <span>Commercial: {summary.categories.commercial}</span>
                  </div>
                </div>
              </div>

              {/* Fuel Capacity & Volume */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Fuel Inventory</h3>
                  <Gauge className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {(summary.currentFuelVolume / 1000).toFixed(1)}k
                    </div>
                    <div className="text-xs text-gray-500">
                      of {(summary.totalCapacity / 1000).toFixed(0)}k liters
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-600 h-2 rounded-full"
                      style={{ width: `${summary.fleetUtilization}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500">
                    Fleet Utilization: {summary.fleetUtilization}%
                  </div>
                </div>
              </div>

              {/* Fuel Levels Status */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Fuel Status</h3>
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div className="space-y-3">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${usePercentageColor(summary.averageFillPercentage)}`}>
                      {summary.averageFillPercentage}%
                    </div>
                    <div className="text-xs text-gray-500 mb-3">Average Level</div>
                  </div>
                  <div className="flex justify-between text-sm">
                    {summary.criticalCount > 0 && (
                      <div className="text-center">
                        <div className="text-sm font-bold text-red-600">{summary.criticalCount}</div>
                        <div className="text-xs text-gray-500">Empty</div>
                      </div>
                    )}
                    {summary.lowFuelCount > 0 && (
                      <div className="text-center">
                        <div className="text-sm font-bold text-yellow-600">{summary.lowFuelCount}</div>
                        <div className="text-xs text-gray-500">Low</div>
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-sm font-bold text-green-600">
                        {summary.totalAssets - summary.lowFuelCount - summary.criticalCount}
                      </div>
                      <div className="text-xs text-gray-500">Good</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Consumption Analytics */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-gray-600">Consumption</h3>
                  <Activity className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {summary.dailyConsumption.toFixed(1)}L
                    </div>
                    <div className="text-xs text-gray-500">per day</div>
                  </div>
                  {summary.estimatedDaysRemaining && (
                    <div className="text-center pt-2">
                      <div className="text-sm font-bold text-gray-700">
                        ~{summary.estimatedDaysRemaining} days
                      </div>
                      <div className="text-xs text-muted-foreground">remaining at current rate</div>
                    </div>
                  )}
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
              ) : viewMode === 'table' ? (
                <AgbotTable locations={locations} />
              ) : (
                // Grouped view by customer
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600">
                      {Object.keys(groupedLocations).length} customers • {locations.length} locations
                    </p>
                    <div className="flex gap-2">
                      <Button onClick={expandAllCustomers} variant="outline" size="sm">
                        Expand All
                      </Button>
                      <Button onClick={collapseAllCustomers} variant="outline" size="sm">
                        Collapse All
                      </Button>
                    </div>
                  </div>

                  {Object.entries(groupedLocations).map(([customerName, customerLocations]) => {
                    const isExpanded = expandedCustomers.has(customerName);

                    // Calculate customer health metrics
                    const allAssets = customerLocations.flatMap(loc => loc.assets || []);
                    const lowAssets = allAssets.filter(asset => asset?.latest_calibrated_fill_percentage < 20).length;
                    const criticalAssets = allAssets.filter(asset => asset?.latest_calibrated_fill_percentage === 0).length;
                    const onlineAssets = allAssets.filter(asset => asset?.device_online).length;

                    // Determine health border color
                    const healthColor = criticalAssets > 0
                      ? 'border-red-600'
                      : lowAssets > 0
                        ? 'border-yellow-500'
                        : 'border-green-600';

                    return (
                      <Card key={customerName} className={`bg-white border-l-4 ${healthColor} shadow-sm hover:shadow-md transition-all`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => toggleCustomer(customerName)}
                              className="flex items-center gap-3 flex-1 text-left hover:opacity-70 transition-opacity"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-5 h-5 text-gray-500" />
                              ) : (
                                <ChevronRight className="w-5 h-5 text-gray-500" />
                              )}

                              <div className="flex-1">
                                <h3 className="font-semibold text-lg text-gray-900">{customerName}</h3>
                                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                                  <span>{customerLocations.length} locations</span>
                                  <span>•</span>
                                  <span>{allAssets.length} assets</span>
                                  <span>•</span>
                                  <span className="text-green-600">{onlineAssets} online</span>
                                  {lowAssets > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="text-yellow-600">{lowAssets} low fuel</span>
                                    </>
                                  )}
                                  {criticalAssets > 0 && (
                                    <>
                                      <span>•</span>
                                      <span className="text-red-600">{criticalAssets} critical</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </button>

                            <div className="flex items-center gap-2">
                              {criticalAssets > 0 && (
                                <Badge variant="destructive" className="bg-red-600">
                                  {criticalAssets} Critical
                                </Badge>
                              )}
                              {lowAssets > 0 && (
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                  {lowAssets} Low
                                </Badge>
                              )}
                              {criticalAssets === 0 && lowAssets === 0 && (
                                <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">
                                  All Good
                                </Badge>
                              )}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t space-y-3">
                              {customerLocations.map((location) => (
                                <AgbotLocationCard
                                  key={location.id}
                                  location={location}
                                />
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
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
                    : 'Configure Gasbot webhook to receive device data.'
                  }
                </p>
                {(!locations || locations.length === 0) && !searchFilter && !onlineOnly && !lowFuelOnly && (
                  <Button onClick={() => window.open('https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook', '_blank')} variant="outline">
                    <Globe className="h-4 w-4 mr-2" />
                    Test Webhook Endpoint
                  </Button>
                )}
              </div>
            )}

            {/* Production Safety Info */}
            <Alert>
              <AlertDescription>
                <strong>Webhook Environment:</strong> Gasbot sends fuel level data directly to this system via webhook. 
                Data is received in real-time as Gasbot devices report (typically hourly). 
                No mock/fake data is provided - only real webhook data from Gasbot is displayed. 
                Configure webhook in Gasbot dashboard: https://fuel-sight-guardian-ce89d8de.vercel.app/api/gasbot-webhook
              </AlertDescription>
            </Alert>
          </div>
        </div>
      </div>
      
      {/* Gasbot Details Modal */}
      <AgbotDetailsModal />
      
      {/* CSV Import Modal */}
      <AgbotCSVImportModal
        open={showCSVImport}
        onOpenChange={setShowCSVImport}
        onImport={handleCSVImport}
      />
    </AppLayout>
  );
}

// Main component with provider
function AgbotPage() {
  return (
    <AgbotModalProvider>
      <AgbotPageContent />
    </AgbotModalProvider>
  );
}

// Wrap with ErrorBoundary for better error handling
export default function AgbotPageWithErrorBoundary() {
  return (
    <ErrorBoundary 
      fallback={({ error, resetError }) => (
        <div className="p-6 max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800 mb-2">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold">Agbot Dashboard Error</h3>
            </div>
            <p className="text-red-700 mb-4">
              Failed to load Agbot fuel monitoring data. This may be due to API connectivity issues or data processing errors.
            </p>
            <button 
              onClick={resetError}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
            >
              Retry Loading
            </button>
          </div>
        </div>
      )}
    >
      <AgbotPage />
    </ErrorBoundary>
  );
}