/**
 * MtData GSF Analytics Dashboard
 * Focused analytics for Great Southern Fuels multi-depot operations
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, PieChart, MapPin, TrendingUp, Calendar, 
  Building2, Truck, Users, BarChart3, Navigation,
  AlertCircle, Activity, Target, Globe, Settings
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMtDataDashboard, useMtDataDepotMetrics, type MtDataAnalyticsFilters } from '@/hooks/useMtDataAnalytics';
import {
  KPISummary,
  DailyTrendChart,
  VehicleUtilizationChart,
  DriverPerformanceChart,
  RouteAnalysisChart,
  DepotMetricsChart
} from '@/components/MtDataAnalyticsCharts';

const MtDataGSFDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState<number>(30);

  const filters: MtDataAnalyticsFilters = {
    fleet: 'GSF',
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

  const depotMetrics = useMtDataDepotMetrics();

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
              {error?.message || 'Unable to load GSF analytics. Please try again.'}
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
  const depotData = depotMetrics.data || [];

  // Calculate GSF-specific insights
  const getRegionalInsights = () => {
    if (!overviewData || !depotData.length) return null;

    const totalDepots = depotData.length;
    const avgTripsPerDepot = Math.round(depotData.reduce((sum, depot) => sum + depot.tripCount, 0) / totalDepots);
    const topDepot = depotData.sort((a, b) => b.tripCount - a.tripCount)[0];
    const avgVehiclesPerDepot = Math.round(depotData.reduce((sum, depot) => sum + depot.vehicleCount, 0) / totalDepots);
    
    const regionalCoverage = depotData.reduce((sum, depot) => sum + depot.totalDistance, 0);
    const avgDistancePerDepot = Math.round(regionalCoverage / totalDepots);

    return {
      totalDepots,
      avgTripsPerDepot,
      topDepot,
      avgVehiclesPerDepot,
      regionalCoverage,
      avgDistancePerDepot
    };
  };

  const regionalInsights = getRegionalInsights();

  // Get depot performance rankings
  const getDepotRankings = () => {
    if (!depotData.length) return [];
    
    return [...depotData]
      .sort((a, b) => b.avgUtilization - a.avgUtilization)
      .slice(0, 5)
      .map((depot, index) => ({
        rank: index + 1,
        depot: depot.depot,
        score: depot.avgUtilization,
        trips: depot.tripCount,
        vehicles: depot.vehicleCount
      }));
  };

  const depotRankings = getDepotRankings();

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
            <PieChart className="w-8 h-8 text-cyan-600" />
            GSF Multi-Depot Analytics
          </h1>
          <p className="text-gray-600 mt-2">
            Regional insights across all Great Southern Fuels depot locations and operations
          </p>
          {overviewData && (
            <div className="flex items-center gap-4 mt-3">
              <Badge variant="outline" className="text-cyan-600 border-cyan-200">
                <Calendar className="w-4 h-4 mr-1" />
                {overviewData.dateRange.start} to {overviewData.dateRange.end}
              </Badge>
              <Badge variant="outline" className="text-green-600 border-green-200">
                <Building2 className="w-4 h-4 mr-1" />
                {regionalInsights?.totalDepots || 0} Active Depots
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
            title="Total Trips"
            value={overviewData.totalTrips.toLocaleString()}
            subtitle="Across all GSF depots"
            icon={Navigation}
            color="primary"
          />
          <KPISummary
            title="Regional Coverage"
            value={`${overviewData.totalDistance.toLocaleString()} km`}
            subtitle={`${overviewData.avgTripDistance} km avg/trip`}
            icon={Globe}
            color="secondary"
          />
          <KPISummary
            title="Fleet Size"
            value={overviewData.uniqueVehicles}
            subtitle="Vehicles across depots"
            icon={Truck}
            color="accent"
          />
          <KPISummary
            title="Active Depots"
            value={regionalInsights?.totalDepots || 0}
            subtitle="Operational locations"
            icon={Building2}
            color="success"
          />
        </div>
      )}

      {/* Regional Performance Overview */}
      {regionalInsights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-cyan-200 bg-cyan-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="w-5 h-5 text-cyan-600" />
                Regional Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Trips/Depot</span>
                  <span className="font-semibold text-cyan-600">{regionalInsights.avgTripsPerDepot}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Vehicles/Depot</span>
                  <span className="font-semibold text-cyan-600">{regionalInsights.avgVehiclesPerDepot}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Distance/Depot</span>
                  <span className="font-semibold text-cyan-600">{regionalInsights.avgDistancePerDepot.toLocaleString()} km</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-green-600" />
                Top Performing Depot
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-lg font-bold text-green-600">
                    {regionalInsights.topDepot?.depot || 'N/A'}
                  </p>
                  <p className="text-sm text-gray-600">Highest trip volume</p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-green-600">{regionalInsights.topDepot?.tripCount || 0}</p>
                    <p className="text-gray-500">Trips</p>
                  </div>
                  <div>
                    <p className="font-semibold text-green-600">{regionalInsights.topDepot?.vehicleCount || 0}</p>
                    <p className="text-gray-500">Vehicles</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-purple-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Depot Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {depotRankings.slice(0, 3).map((depot) => (
                  <div key={depot.depot} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-purple-600 text-white rounded-full w-5 h-5 flex items-center justify-center">
                        {depot.rank}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {depot.depot.length > 10 ? depot.depot.substring(0, 10) + '...' : depot.depot}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-purple-600">
                      {depot.score.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Analytics Charts */}
      <div className="space-y-6">
        {/* Depot Performance Comparison */}
        {depotData.length > 0 && (
          <DepotMetricsChart data={depotData} />
        )}

        {/* Daily Trends and Route Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {trendsData.length > 0 && (
            <DailyTrendChart 
              data={trendsData} 
              metric="tripCount"
              title="Daily Regional Trip Volume"
            />
          )}
          
          {trendsData.length > 0 && (
            <DailyTrendChart 
              data={trendsData} 
              metric="uniqueVehicles"
              title="Daily Active Fleet Size"
            />
          )}
        </div>

        {/* Vehicle and Driver Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {vehicleData.length > 0 && (
            <VehicleUtilizationChart data={vehicleData} topN={12} />
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

      {/* Depot Performance Details */}
      {depotRankings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Depot Performance Analysis
            </CardTitle>
            <CardDescription>
              Detailed comparison of operational metrics across GSF depot locations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Depot</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Utilization Score</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Trip Count</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Vehicle Count</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Efficiency</th>
                  </tr>
                </thead>
                <tbody>
                  {depotRankings.map((depot, index) => (
                    <tr key={depot.depot} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-gray-50' : ''}`}>
                      <td className="py-3 px-4">
                        <Badge variant={index < 3 ? "default" : "secondary"} className="w-8 h-8 rounded-full p-0 flex items-center justify-center">
                          {depot.rank}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-900">{depot.depot}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-12 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full"
                              style={{ width: `${Math.min(100, (depot.score / 20) * 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-semibold">{depot.score.toFixed(1)}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{depot.trips.toLocaleString()}</td>
                      <td className="py-3 px-4 text-gray-600">{depot.vehicles}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className={
                          depot.score > 15 ? 'text-green-600 border-green-200' :
                          depot.score > 10 ? 'text-yellow-600 border-yellow-200' :
                          'text-red-600 border-red-200'
                        }>
                          {depot.score > 15 ? 'High' : depot.score > 10 ? 'Medium' : 'Low'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Regional Optimization Recommendations */}
      {regionalInsights && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-600" />
              Regional Optimization Recommendations
            </CardTitle>
            <CardDescription>
              Strategic insights for improving GSF multi-depot operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  Depot Optimization
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-cyan-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {depotRankings.length > 0 && depotRankings[0].score > 15 ?
                      `${depotRankings[0].depot} demonstrates best practices - apply learnings to other depots` :
                      'Identify and replicate best practices from high-performing depots'
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-cyan-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {regionalInsights.avgVehiclesPerDepot < 5 ?
                      'Consider vehicle redistribution to balance fleet allocation across depots' :
                      'Fleet distribution appears balanced across depot locations'
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-cyan-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    Monitor underperforming depots for resource optimization opportunities
                  </li>
                </ul>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  Regional Coverage
                </h4>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {routeData.length > 10 ?
                      'Strong inter-depot connectivity - optimize frequently traveled routes' :
                      'Consider analyzing route efficiency between depot locations'
                    }
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    Evaluate regional demand patterns to guide future depot expansion
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></span>
                    {regionalInsights.avgDistancePerDepot > 5000 ?
                      'High regional coverage indicates strong market penetration' :
                      'Explore opportunities to expand service area coverage'
                    }
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

export default MtDataGSFDashboard;