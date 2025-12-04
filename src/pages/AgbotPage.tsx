import React, { useState, useEffect } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RefreshCw, Signal, AlertTriangle, CheckCircle2, Filter, Zap, Grid3X3, List, Upload, Globe, Gauge, TrendingUp, Activity, Mail } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
import CustomerContactsAdmin from '@/components/agbot/CustomerContactsAdmin';
import { importAgbotFromCSV } from '@/services/agbot-api';
import { useToast } from '@/hooks/use-toast';
import { useUserPermissions } from '@/hooks/useUserPermissions';

// Helper function to get per-location consumption breakdown for tooltip
function getLocationConsumptionBreakdown(locations: any[] | undefined) {
  if (!locations) return [];

  const breakdown = locations
    .map(location => {
      const mainAsset = location.assets?.[0];
      const dailyConsumption = mainAsset?.asset_daily_consumption || location.location_daily_consumption || 0;

      // Consumption is calculated by the recalculate-consumption cron job (runs daily)
      // Data is considered fresh since it's updated regularly by the cron
      return {
        name: location.address1 || location.customer_name || 'Unknown',
        consumption: dailyConsumption,
        isStale: false,  // Trust cron job data
        ageHours: 0,
      };
    })
    .filter(item => item.consumption > 0);

  const total = breakdown.reduce((sum, item) => sum + item.consumption, 0);

  return breakdown
    .map(item => ({
      ...item,
      percentage: total > 0 ? (item.consumption / total) * 100 : 0,
    }))
    .sort((a, b) => b.consumption - a.consumption); // Highest consumption first
}

function AgbotPageContent() {
  const [searchFilter, setSearchFilter] = useState('');
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [lowFuelOnly, setLowFuelOnly] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [showSystemMonitoring, setShowSystemMonitoring] = useState(false);
  const [showCustomerContacts, setShowCustomerContacts] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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
  const { permissions } = useUserPermissions();
  const { toast } = useToast();

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
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
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
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100 p-6">
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
      <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-20 py-6 space-y-6">
          {/* Hero Header Section */}
          <div className="bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 rounded-2xl p-6 lg:p-8 text-white shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
              {/* Left: Icon + Title */}
              <div className="flex items-center gap-4">
                {/* Large animated icon */}
                <div className="relative">
                  <div className="w-14 h-14 lg:w-16 lg:h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                    <Signal className="h-7 w-7 lg:h-8 lg:w-8 text-green-300" />
                  </div>
                  {/* Pulse animation overlay */}
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-pulse" />
                </div>

                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold">Gasbot Monitoring</h1>
                  <p className="text-green-200 mt-1 text-sm lg:text-base">
                    Real-time fuel monitoring across your fleet
                  </p>
                </div>
              </div>

              {/* Right: Action buttons - Glass morphism style */}
              <div className="flex gap-2 flex-wrap">
                {/* System Monitoring Toggle */}
                <Button
                  size="sm"
                  onClick={() => setShowSystemMonitoring(!showSystemMonitoring)}
                  className={`${showSystemMonitoring
                    ? 'bg-white/20 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white/90'} backdrop-blur-sm border-white/20`}
                >
                  <AlertTriangle className="h-4 w-4 mr-1" />
                  Athara Monitor
                </Button>

                {/* Customer Contacts Toggle */}
                <Button
                  size="sm"
                  onClick={() => setShowCustomerContacts(!showCustomerContacts)}
                  className={`${showCustomerContacts
                    ? 'bg-white/20 text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white/90'} backdrop-blur-sm border-white/20`}
                >
                  <Mail className="h-4 w-4 mr-1" />
                  Email Contacts
                </Button>

                {/* View Toggle - Grid | Table */}
                <div className="flex rounded-lg overflow-hidden bg-white/10 backdrop-blur-sm">
                  <Button
                    size="sm"
                    onClick={() => handleViewChange('grid')}
                    className={`rounded-none ${viewMode === 'grid'
                      ? 'bg-white/20 text-white'
                      : 'bg-transparent hover:bg-white/10 text-white/70'}`}
                    title="Grid View"
                  >
                    <Grid3X3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleViewChange('table')}
                    className={`rounded-none ${viewMode === 'table'
                      ? 'bg-white/20 text-white'
                      : 'bg-transparent hover:bg-white/10 text-white/70'}`}
                    title="Table View"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>

                <Button
                  size="sm"
                  onClick={() => setShowCSVImport(true)}
                  disabled={isImporting}
                  className="bg-amber-500/80 hover:bg-amber-500 text-white backdrop-blur-sm border-amber-400/30"
                >
                  <Upload className={`h-4 w-4 mr-1 ${isImporting ? 'animate-spin' : ''}`} />
                  {isImporting ? 'Importing...' : 'Import CSV'}
                </Button>
              </div>
            </div>

            {/* Status bar */}
            <div className="mt-6 flex flex-wrap items-center gap-3 lg:gap-4">
              {/* Live indicator with webhook status */}
              <AgbotWebhookHealthStatus showFullDetails={false} className="!bg-white/10 !backdrop-blur-sm !rounded-full !px-4 !py-2" />

              <span className="text-green-200/80 hidden sm:inline">•</span>
              <span className="text-green-200 text-sm">
                {summary.onlineAssets} of {summary.totalAssets} devices online
              </span>
              <span className="text-green-200/80 hidden sm:inline">•</span>
              <span className="text-green-200 text-sm">
                {summary.totalLocations} locations
              </span>
            </div>
          </div>

            {/* Webhook Monitoring Panel - Enhanced Athara Monitor */}
            {showSystemMonitoring && (
              <>
                <AtharaWebhookMonitor />
                <AgbotWebhookMonitoring />
              </>
            )}

            {/* Customer Contacts Admin Panel */}
            {showCustomerContacts && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
                <CustomerContactsAdmin />
              </div>
            )}

          {/* Fleet Statistics - Bold Gradient Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {/* Fleet Overview - Green Theme */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-2xl shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300">
              {/* Decorative background circles */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-white/80">Fleet Overview</h3>
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Signal className="h-5 w-5 text-white" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/70">Locations</span>
                    <span className="text-2xl font-bold text-white">{summary.totalLocations}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/70">Active Devices</span>
                    <span className="text-xl font-bold text-white">{summary.onlineAssets}/{summary.totalAssets}</span>
                  </div>
                  <div className="flex justify-between text-xs text-white/60 pt-2 border-t border-white/10">
                    <span>Agricultural: {summary.categories.agricultural}</span>
                    <span>Commercial: {summary.categories.commercial}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Fuel Inventory - Amber/Orange Theme */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 p-6 rounded-2xl shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300">
              {/* Decorative background circles */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-white/80">Fuel Inventory</h3>
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Gauge className="h-5 w-5 text-white" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold text-white">
                      {(summary.currentFuelVolume / 1000).toFixed(1)}k
                    </div>
                    <div className="text-sm text-white/70">
                      of {(summary.totalCapacity / 1000).toFixed(0)}k liters
                    </div>
                  </div>
                  <div className="w-full bg-white/20 rounded-full h-2.5">
                    <div
                      className="bg-white h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${summary.fleetUtilization}%` }}
                    ></div>
                  </div>
                  <div className="text-sm text-white/70">
                    Fleet Utilization: {summary.fleetUtilization}%
                  </div>
                </div>
              </div>
            </div>

            {/* Fuel Status - Dynamic Color Based on Average */}
            <div className={`group relative overflow-hidden p-6 rounded-2xl shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 bg-gradient-to-br ${
              summary.averageFillPercentage < 30
                ? 'from-red-500 to-rose-600'
                : summary.averageFillPercentage < 50
                ? 'from-amber-500 to-orange-600'
                : 'from-green-500 to-emerald-600'
            }`}>
              {/* Decorative background circles */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-white/80">Fuel Status</h3>
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-white">
                      {summary.averageFillPercentage}%
                    </div>
                    <div className="text-sm text-white/70">Average Level</div>
                  </div>
                  <div className="flex justify-around text-center pt-2 border-t border-white/10">
                    <div>
                      <div className="text-lg font-bold text-white">{summary.criticalCount}</div>
                      <div className="text-xs text-white/60">Empty</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white">{summary.lowFuelCount}</div>
                      <div className="text-xs text-white/60">Low</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white">
                        {summary.totalAssets - summary.lowFuelCount - summary.criticalCount}
                      </div>
                      <div className="text-xs text-white/60">Good</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Consumption Analytics - Blue Theme with Tooltip */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help group relative overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-2xl shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300">
                    {/* Decorative background circles */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

                    <div className="relative">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-medium text-white/80">Consumption</h3>
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                          <Activity className="h-5 w-5 text-white" />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="text-3xl font-bold text-white">
                            {summary.dailyConsumption.toFixed(1)}L
                          </div>
                          <div className="text-sm text-white/70">per day</div>
                          <div className="text-xs text-white/50 italic mt-1">
                            Hover for breakdown ↗
                          </div>
                          {/* Stale data indicator */}
                          {summary.dataFreshness === 'stale' && (
                            <div className="flex items-center gap-1 text-xs text-amber-200 bg-amber-500/20 px-2 py-1 rounded mt-2">
                              <AlertTriangle className="h-3 w-3" />
                              <span>Data may be outdated ({summary.staleCount} stale)</span>
                            </div>
                          )}
                        </div>
                        {summary.estimatedDaysRemaining && (
                          <div className="pt-2 border-t border-white/10">
                            <div className="text-xl font-bold text-white">
                              ~{summary.estimatedDaysRemaining} days
                            </div>
                            <div className="text-sm text-white/60">remaining at current rate</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </TooltipTrigger>

                <TooltipContent side="right" className="max-w-md p-4 bg-slate-900 border-slate-700">
                  <h4 className="text-sm font-semibold mb-3 text-white">Daily Consumption by Location</h4>

                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {getLocationConsumptionBreakdown(locations).map((item, idx) => (
                      <div key={idx} className="flex justify-between gap-4 text-xs border-b border-slate-700/50 pb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-white truncate font-medium">{item.name}</div>
                          {item.isStale && (
                            <div className="text-amber-400 text-[10px] flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Stale ({item.ageHours}h old)
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-white font-semibold">{item.consumption.toFixed(1)}L</div>
                          <div className="text-slate-400 text-[10px] w-12 text-right">{item.percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between text-sm">
                    <span className="text-slate-400">Total ({getLocationConsumptionBreakdown(locations).length} locations)</span>
                    <span className="text-white font-bold">{summary.dailyConsumption.toFixed(1)}L/day</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Filters */}
          <div className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-gray-200 shadow-sm">
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
            ) : (
              <div className="bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-100">
                  <h2 className="text-xl font-semibold text-gray-900">Gasbot Locations</h2>
                </div>
                <div className="overflow-x-auto">
                  <AgbotTable locations={locations} />
                </div>
              </div>
            )
          ) : (
            <div className="text-center py-12 bg-white/80 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm">
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
                <Button onClick={() => window.open('https://tankalert.greatsouthernfuels.com.au/api/gasbot-webhook', '_blank')} variant="outline">
                  <Globe className="h-4 w-4 mr-2" />
                  Test Webhook Endpoint
                </Button>
              )}
            </div>
          )}

          {/* Production Safety Info */}
          <Alert className="bg-white/80 backdrop-blur-sm border-gray-200">
            <AlertDescription>
              <strong>Webhook Environment:</strong> Gasbot sends fuel level data directly to this system via webhook.
              Data is received in real-time as Gasbot devices report (typically hourly).
              No mock/fake data is provided - only real webhook data from Gasbot is displayed.
              Configure webhook in Gasbot dashboard: https://tankalert.greatsouthernfuels.com.au/api/gasbot-webhook
            </AlertDescription>
          </Alert>
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