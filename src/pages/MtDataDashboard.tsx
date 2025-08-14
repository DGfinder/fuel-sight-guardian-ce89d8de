/**
 * MtData Analytics Dashboard - Overview
 * Main dashboard showing comprehensive trip analytics from MtData
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Navigation, Truck, Users, Clock, MapPin, TrendingUp, 
  Filter, Calendar, BarChart3, PieChart, Activity
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMtDataDashboard, type MtDataAnalyticsFilters } from '@/hooks/useMtDataAnalytics';
import {
  KPISummary,
  DailyTrendChart,
  VehicleUtilizationChart,
  DriverPerformanceChart,
  RouteAnalysisChart,
  DepotMetricsChart
} from '@/components/MtDataAnalyticsCharts';

const MtDataDashboard: React.FC = () => {
  const [filters, setFilters] = useState<MtDataAnalyticsFilters>({
    dateRange: 30
  });

  const {
    overview,
    trends,
    vehicleUtilization,
    driverPerformance,
    routeAnalysis,
    depotMetrics,
    isLoading,
    isError,
    error
  } = useMtDataDashboard(filters);

  const handleFleetFilter = (fleet: string) => {
    setFilters(prev => ({
      ...prev,
      fleet: fleet === 'all' ? undefined : fleet as 'Stevemacs' | 'GSF'
    }));
  };

  const handleDateRangeFilter = (days: string) => {
    setFilters(prev => ({
      ...prev,
      dateRange: parseInt(days)
    }));
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-80 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Activity className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Analytics</h3>
            <p className="text-gray-600 mb-4">
              {error?.message || 'Unable to load MtData analytics. Please try again.'}
            </p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const overviewData = overview.data;
  const trendsData = trends.data || [];
  const vehicleData = vehicleUtilization.data || [];
  const driverData = driverPerformance.data || [];
  const routeData = routeAnalysis.data || [];
  const depotData = depotMetrics?.data || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Navigation className="w-8 h-8 text-emerald-600" />
            MtData Trip Analytics
          </h1>
          <p className="text-gray-600 mt-2">
            Comprehensive operational insights from vehicle trip data and route optimization
          </p>
          {overviewData && (
            <div className="flex items-center gap-4 mt-3">
              <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                <Calendar className="w-4 h-4 mr-1" />
                {overviewData.dateRange.start} to {overviewData.dateRange.end}
              </Badge>
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                <BarChart3 className="w-4 h-4 mr-1" />
                {overviewData.totalTrips.toLocaleString()} Total Trips
              </Badge>
            </div>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          <Select value={filters.fleet || 'all'} onValueChange={handleFleetFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Fleet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Fleets</SelectItem>
              <SelectItem value="Stevemacs">Stevemacs</SelectItem>
              <SelectItem value="GSF">GSF</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.dateRange?.toString() || '30'} onValueChange={handleDateRangeFilter}>
            <SelectTrigger className="w-[120px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 Days</SelectItem>
              <SelectItem value="14">14 Days</SelectItem>
              <SelectItem value="30">30 Days</SelectItem>
              <SelectItem value="60">60 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {overviewData && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <KPISummary
            title="Total Trips"
            value={overviewData.totalTrips.toLocaleString()}
            subtitle="All recorded trips"
            icon={Navigation}
            color="primary"
          />
          <KPISummary
            title="Total Distance"
            value={`${overviewData.totalDistance.toLocaleString()} km`}
            subtitle={`Avg: ${overviewData.avgTripDistance} km/trip`}
            icon={MapPin}
            color="secondary"
          />
          <KPISummary
            title="Active Vehicles"
            value={overviewData.uniqueVehicles}
            subtitle="Vehicles with trip data"
            icon={Truck}
            color="accent"
          />
          <KPISummary
            title="Travel Time"
            value={`${overviewData.totalTravelTime.toLocaleString()} h`}
            subtitle={`Avg: ${overviewData.avgTripDuration} h/trip`}
            icon={Clock}
            color="success"
          />
        </div>
      )}

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="group hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-600" />
              Stevemacs Operations
            </CardTitle>
            <CardDescription>
              Detailed analytics for Stevemacs fleet operations and efficiency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1">
                <p className="text-2xl font-bold text-gray-900">
                  {vehicleData.filter(v => v.groupName?.includes('Stevemacs')).length}
                </p>
                <p className="text-sm text-gray-600">Active Vehicles</p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-700">
                Fleet Analytics
              </Badge>
            </div>
            <Link to="/data-centre/mtdata/stevemacs">
              <Button className="w-full group-hover:bg-emerald-600 transition-colors">
                View Stevemacs Analytics
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-lg transition-shadow duration-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-cyan-600" />
              GSF Multi-Depot Operations
            </CardTitle>
            <CardDescription>
              Regional analytics across all Great Southern Fuels depot locations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-1">
                <p className="text-2xl font-bold text-gray-900">
                  {depotData.length}
                </p>
                <p className="text-sm text-gray-600">Active Depots</p>
              </div>
              <Badge className="bg-cyan-100 text-cyan-700">
                Regional Analytics
              </Badge>
            </div>
            <Link to="/data-centre/mtdata/gsf">
              <Button className="w-full bg-cyan-600 hover:bg-cyan-700 group-hover:bg-cyan-700 transition-colors">
                View GSF Analytics
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts Grid */}
      <div className="space-y-6">
        {/* Daily Trends */}
        {trendsData.length > 0 && (
          <DailyTrendChart 
            data={trendsData} 
            metric="tripCount"
            title="Daily Trip Volume Trends"
          />
        )}

        {/* Two Column Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {vehicleData.length > 0 && (
            <VehicleUtilizationChart data={vehicleData} topN={12} />
          )}
          
          {driverData.length > 0 && (
            <DriverPerformanceChart data={driverData} topN={8} />
          )}
        </div>

        {/* Route Analysis */}
        {routeData.length > 0 && (
          <RouteAnalysisChart data={routeData} />
        )}

        {/* Depot Metrics for Combined View */}
        {depotData.length > 0 && !filters.fleet && (
          <DepotMetricsChart data={depotData} />
        )}
      </div>

      {/* Additional Insights */}
      {overviewData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Operational Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-emerald-600">
                  {Math.round((overviewData.totalDistance / overviewData.totalTravelTime) * 100) / 100}
                </p>
                <p className="text-sm text-gray-600">km/h</p>
                <p className="text-xs text-gray-500 mt-1">Fleet Average Speed</p>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-cyan-600">
                  {Math.round(overviewData.totalTrips / overviewData.uniqueVehicles * 100) / 100}
                </p>
                <p className="text-sm text-gray-600">trips/vehicle</p>
                <p className="text-xs text-gray-500 mt-1">Average Utilization</p>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-violet-600">
                  {overviewData.uniqueDrivers > 0 ? 
                    Math.round(overviewData.totalTrips / overviewData.uniqueDrivers * 100) / 100 : 0}
                </p>
                <p className="text-sm text-gray-600">trips/driver</p>
                <p className="text-xs text-gray-500 mt-1">Driver Productivity</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MtDataDashboard;