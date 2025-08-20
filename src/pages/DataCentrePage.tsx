import React, { useMemo } from 'react';
import { 
  Shield, 
  CreditCard, 
  AlertTriangle, 
  Upload, 
  BarChart3, 
  TrendingUp,
  Users,
  FileText,
  Navigation,
  RefreshCw,
  Clock,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import DataCentreLayout from '@/components/DataCentreLayout';
import DataFreshnessCard from '@/components/DataFreshnessCard';
import { useVehicles } from '@/hooks/useVehicles';
import { useDataFreshness } from '@/hooks/useDataFreshness';
import { formatDistanceToNow } from 'date-fns';

const DataCentrePage = () => {
  const { data: vehicles = [], isLoading } = useVehicles();
  const { 
    sources, 
    summary, 
    isLoading: isFreshnessLoading, 
    error: freshnessError,
    isRefreshing,
    refreshingSources,
    refreshAll,
    refreshSource 
  } = useDataFreshness();
  
  const fleetStats = useMemo(() => {
    if (vehicles.length === 0) {
      return {
        totalVehicles: 0,
        averageEfficiency: 0,
        activeVehicles: 0,
        averageSafetyScore: 0
      };
    }
    
    const activeVehicles = vehicles.filter(v => v.status === 'Active').length;
    const averageEfficiency = vehicles.reduce((sum, v) => sum + v.fuel_efficiency, 0) / vehicles.length;
    const averageSafetyScore = vehicles.reduce((sum, v) => sum + v.safety_score, 0) / vehicles.length;
    
    return {
      totalVehicles: vehicles.length,
      averageEfficiency: Math.round(averageEfficiency * 10) / 10,
      activeVehicles,
      averageSafetyScore: Math.round(averageSafetyScore * 10) / 10
    };
  }, [vehicles]);

  // Static card configurations mapped to source keys
  const staticCardConfigs = useMemo(() => ({
    'guardian_events': {
      metrics: { events: '13,317', verification: '6.4%' }
    },
    'captive_payments': {
      metrics: { records: '75,000+', carriers: '2' }
    },
    'lytx_safety': {
      metrics: { drivers: '120+', score: '8.2/10' }
    },
    'data_import': {
      metrics: { sources: '3', batches: '24' }
    },
    'reports_analytics': {
      title: 'Reports & Analytics',
      description: 'Cross-source analytics and automated report generation',
      route_path: '/data-centre/reports',
      icon_name: 'BarChart3',
      color_class: 'bg-indigo-500',
      metrics: { reports: '12', insights: 'Real-time' },
      is_active: true
    },
    'fleet_analytics': {
      title: 'Fleet Analytics',
      description: 'Comprehensive fleet performance and risk optimization',
      route_path: '/data-centre/fleet',
      icon_name: 'TrendingUp',
      color_class: 'bg-teal-500',
      metrics: { 
        vehicles: fleetStats.totalVehicles.toString(), 
        efficiency: `${fleetStats.averageEfficiency} km/L`
      },
      is_active: true
    },
    'mtdata_trips': {
      metrics: { trips: '4,141+', vehicles: '56' }
    },
    'driver_profiles': {
      metrics: { drivers: '120+', profiles: 'Deep Analytics' }
    }
  }), [fleetStats]);

  // Merge data sources with static configurations
  const analyticsCards = useMemo(() => {
    const cards = [];
    
    // Add cards from data sources
    sources.forEach(source => {
      const staticConfig = staticCardConfigs[source.source_key] || {};
      cards.push({
        ...source,
        ...staticConfig,
        metrics: staticConfig.metrics || { records: source.record_count?.toLocaleString() || '0' }
      });
    });

    // Add static-only cards that don't have data sources yet
    ['reports_analytics', 'fleet_analytics'].forEach(key => {
      if (!sources.find(s => s.source_key === key)) {
        const config = staticCardConfigs[key];
        if (config) {
          cards.push({
            source_key: key,
            display_name: config.title,
            description: config.description,
            route_path: config.route_path,
            icon_name: config.icon_name,
            color_class: config.color_class,
            is_active: config.is_active,
            ...config
          });
        }
      }
    });

    return cards;
  }, [sources, staticCardConfigs]);

  return (
    <DataCentreLayout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Data Centre Analytics Platform
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Comprehensive fleet analytics combining Guardian compliance, captive payments, and safety data
              </p>
            </div>
            
            {/* Data Freshness Summary and Actions */}
            <div className="flex items-center gap-3">
              {summary && (
                <div className="text-right">
                  <div className="text-sm text-gray-500">Data Sources</div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>{summary.fresh_sources} Fresh</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span>{summary.stale_sources} Stale</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span>{summary.critical_sources} Critical</span>
                    </div>
                  </div>
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={refreshAll}
                disabled={isRefreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh All'}
              </Button>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-green-600 border-green-200">
              <Users className="w-4 h-4 mr-1" />
              Multi-source Integration
            </Badge>
            <Badge variant="outline" className="text-blue-600 border-blue-200">
              <FileText className="w-4 h-4 mr-1" />
              Real-time Analytics
            </Badge>
            {summary && (
              <Badge variant="outline" className="text-purple-600 border-purple-200">
                <Activity className="w-4 h-4 mr-1" />
                {summary.total_sources} Data Sources
              </Badge>
            )}
            {summary?.last_refresh && (
              <Badge variant="outline" className="text-gray-600 border-gray-200">
                <Clock className="w-4 h-4 mr-1" />
                Updated {formatDistanceToNow(new Date(summary.last_refresh), { addSuffix: true })}
              </Badge>
            )}
          </div>

          {/* Error Alert */}
          {freshnessError && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Data freshness information unavailable: {freshnessError}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isFreshnessLoading ? (
            // Loading skeleton cards
            Array.from({ length: 6 }).map((_, index) => (
              <Card key={index} className="relative overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <Skeleton className="h-2 w-full mt-3" />
                </CardContent>
              </Card>
            ))
          ) : (
            analyticsCards.map((card) => (
              <DataFreshnessCard
                key={card.source_key || card.route_path}
                sourceData={card}
                metrics={card.metrics}
                onRefresh={refreshSource}
                isRefreshing={refreshingSources.has(card.source_key || '')}
              />
            ))
          )}
        </div>

        {/* Quick Stats Summary */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Shield className="w-8 h-8 text-blue-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">13,317</p>
                  <p className="text-gray-600 text-sm">Guardian Events</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <CreditCard className="w-8 h-8 text-green-500 mr-3" />
                <div>
                  <p className="text-2xl font-bold">75,000+</p>
                  <p className="text-gray-600 text-sm">Payment Records</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-orange-500 mr-3" />
                <div>
                  {isLoading ? (
                    <p className="text-2xl font-bold text-gray-400">Loading...</p>
                  ) : (
                    <p className="text-2xl font-bold">{fleetStats.averageSafetyScore}/10</p>
                  )}
                  <p className="text-gray-600 text-sm">Avg Safety Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-teal-500 mr-3" />
                <div>
                  {isLoading ? (
                    <p className="text-2xl font-bold text-gray-400">Loading...</p>
                  ) : (
                    <p className="text-2xl font-bold">{fleetStats.totalVehicles}</p>
                  )}
                  <p className="text-gray-600 text-sm">Total Vehicles</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Additional Fleet Insights */}
        {!isLoading && vehicles.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{fleetStats.activeVehicles}</p>
                    <p className="text-gray-600 text-sm">Active Vehicles</p>
                  </div>
                  <div className="text-green-500">
                    {Math.round((fleetStats.activeVehicles / fleetStats.totalVehicles) * 100)}%
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{fleetStats.averageEfficiency} km/L</p>
                    <p className="text-gray-600 text-sm">Avg Fuel Efficiency</p>
                  </div>
                  <div className="text-blue-500">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {vehicles.filter(v => v.fleet === 'Stevemacs').length} / {vehicles.filter(v => v.fleet === 'Great Southern Fuels').length}
                    </p>
                    <p className="text-gray-600 text-sm">Stevemacs / GSF</p>
                  </div>
                  <div className="text-purple-500">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DataCentreLayout>
  );
};

export default DataCentrePage;