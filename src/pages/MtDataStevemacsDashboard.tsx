/**
 * MtData Stevemacs Analytics Dashboard
 * Focused analytics for Stevemacs fleet operations
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Truck, Users, Clock, MapPin, TrendingUp, 
  Calendar, Target, Award, Activity, BarChart3,
  Navigation, AlertCircle, CheckCircle2
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
  RouteAnalysisChart
} from '@/components/MtDataAnalyticsCharts';

const MtDataStevemacsDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<number>(30);

  const filters: MtDataAnalyticsFilters = {
    fleet: 'Stevemacs',
    dateRange
  };

  const {
    overview,
    trends,
    vehicleUtilization,
    driverPerformance,
    routeAnalysis,
    isLoading,
    isError,
    error
  } = useMtDataDashboard(filters);

  const handleDateRangeFilter = (days: string) => {
    setDateRange(parseInt(days));
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
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Analytics</h3>
            <p className="text-gray-600 mb-4">
              {error?.message || 'Unable to load Stevemacs analytics. Please try again.'}
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

  // Calculate Stevemacs-specific insights
  const getOperationalInsights = () => {
    if (!overviewData) return null;

    const avgSpeed = overviewData.totalTravelTime > 0 ? 
      Math.round((overviewData.totalDistance / overviewData.totalTravelTime) * 100) / 100 : 0;
    
    const vehicleUtilizationRate = overviewData.uniqueVehicles > 0 ?
      Math.round((overviewData.totalTrips / overviewData.uniqueVehicles) * 100) / 100 : 0;
    
    const driverProductivity = overviewData.uniqueDrivers > 0 ?
      Math.round((overviewData.totalTrips / overviewData.uniqueDrivers) * 100) / 100 : 0;

    return {
      avgSpeed,
      vehicleUtilizationRate,
      driverProductivity,
      efficiency: avgSpeed > 0 ? Math.round((overviewData.totalDistance / (overviewData.totalTravelTime * 10)) * 100) / 100 : 0
    };
  };

  const insights = getOperationalInsights();

  // Get top performers
  const topVehicle = vehicleData[0];
  const topDriver = driverData[0];
  const topRoute = routeData[0];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link to="/data-centre/mtdata">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Overview
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Truck className="w-8 h-8 text-emerald-600" />
            Stevemacs Operations Analytics
          </h1>
          <p className="text-gray-600 mt-2">
            Focused insights for Stevemacs fleet performance and operational efficiency
          </p>
          {overviewData && (
            <div className="flex items-center gap-4 mt-3">
              <Badge variant="outline" className="text-emerald-600 border-emerald-200">
                <Calendar className="w-4 h-4 mr-1" />
                {overviewData.dateRange.start} to {overviewData.dateRange.end}
              </Badge>
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                <Truck className="w-4 h-4 mr-1" />
                Stevemacs Fleet
              </Badge>
            </div>
          )}
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-3">
          <Select value={dateRange.toString()} onValueChange={handleDateRangeFilter}>
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
            title="Fleet Trips"
            value={overviewData.totalTrips.toLocaleString()}
            subtitle="Total Stevemacs trips"
            icon={Navigation}
            color="primary"
          />
          <KPISummary
            title="Distance Covered"
            value={`${overviewData.totalDistance.toLocaleString()} km`}
            subtitle={`${overviewData.avgTripDistance} km avg/trip`}
            icon={MapPin}
            color="secondary"
          />
          <KPISummary
            title="Active Vehicles"
            value={overviewData.uniqueVehicles}
            subtitle="Fleet vehicles in operation"
            icon={Truck}
            color="accent"
          />
          <KPISummary
            title="Driver Count"
            value={overviewData.uniqueDrivers || 0}
            subtitle="Active Stevemacs drivers"
            icon={Users}
            color="success"
          />
        </div>
      )}

      {/* Performance Highlights */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-emerald-200 bg-emerald-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-600" />
                Fleet Efficiency
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Average Speed</span>
                  <span className="font-semibold text-emerald-600">{insights.avgSpeed} km/h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Vehicle Utilization</span>
                  <span className="font-semibold text-emerald-600">{insights.vehicleUtilizationRate} trips/vehicle</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Driver Productivity</span>
                  <span className="font-semibold text-emerald-600">{insights.driverProductivity} trips/driver</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Award className="w-5 h-5 text-blue-600" />
                Top Performers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Top Vehicle</p>
                  <p className="font-semibold text-blue-600">
                    {topVehicle?.vehicleRegistration || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {topVehicle?.tripCount || 0} trips, {topVehicle?.utilizationScore || 0}% utilization
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Top Driver</p>
                  <p className="font-semibold text-blue-600">
                    {topDriver?.driverName || 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {topDriver?.efficiencyScore || 0} km/h efficiency
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Route Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Most Frequent Route</p>
                  <p className="font-semibold text-purple-600 text-sm">
                    {topRoute ? `${topRoute.startLocation.substring(0, 12)}...` : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {topRoute?.tripCount || 0} trips, {topRoute?.avgDistance || 0} km avg
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Routes</span>
                  <span className="font-semibold text-purple-600">{routeData.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Route Efficiency</span>
                  <span className="font-semibold text-purple-600">
                    {topRoute?.routeEfficiency || 0} km/h
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Charts */}
      <div className="space-y-6">
        {/* Daily Trends */}
        {trendsData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DailyTrendChart 
              data={trendsData} 
              metric="tripCount"
              title="Daily Trip Volume"
            />
            <DailyTrendChart 
              data={trendsData} 
              metric="totalDistance"
              title="Daily Distance Coverage"
            />
          </div>
        )}

        {/* Vehicle and Driver Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {vehicleData.length > 0 && (
            <VehicleUtilizationChart data={vehicleData} topN={15} />
          )}
          
          {driverData.length > 0 && (
            <DriverPerformanceChart data={driverData} topN={10} />
          )}
        </div>

        {/* Route Analysis */}
        {routeData.length > 0 && (
          <RouteAnalysisChart data={routeData} />
        )}
      </div>

      {/* Operational Recommendations */}
      {insights && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Operational Recommendations
            </CardTitle>
            <CardDescription>
              Data-driven insights to optimize Stevemacs fleet operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  Fleet Optimization
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {insights.vehicleUtilizationRate < 10 ? 
                      'Consider consolidating low-utilization vehicles to improve efficiency' :
                      'Vehicle utilization is optimal for current operations'
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {vehicleData.length > 0 && vehicleData[0]?.utilizationScore > 80 ?
                      `${vehicleData[0].vehicleRegistration} shows excellent utilization patterns` :
                      'Monitor top-performing vehicles for best practice sharing'
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {insights.avgSpeed < 40 ? 
                      'Review route efficiency opportunities to improve average speeds' :
                      'Fleet maintains good average operational speed'
                    }
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  Driver Management
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {topDriver ? 
                      `${topDriver.driverName} demonstrates excellent efficiency - consider for training others` :
                      'Identify top-performing drivers for mentorship programs'
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {insights.driverProductivity > 15 ?
                      'Driver productivity is strong across the fleet' :
                      'Consider driver scheduling optimization to increase trip frequency'
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    Balance workload distribution to prevent driver fatigue and optimize performance
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MtDataStevemacsDashboard;