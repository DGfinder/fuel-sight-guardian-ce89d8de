/**
 * LYTX Historical Safety Dashboard
 * Database-driven analytics dashboard for 34K+ stored safety events
 * Replaces API-focused dashboard with comprehensive historical analysis
 */

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, AlertTriangle, Users, Shield, 
  BarChart3, Calendar, MapPin, Target, Award, Clock, 
  Download, Filter, RefreshCw, Eye, ChevronRight, Activity,
  Car, UserCheck, AlertCircle, CheckCircle
} from 'lucide-react';
import { 
  useLytxHistoricalEvents, 
  useLytxSummaryStats, 
  useLytxMonthlyTrends,
  useLytxDriverPerformance,
  useLytxDepotAnalytics,
  useLytxTriggerAnalysis,
  useDateRanges,
  type LytxAnalyticsFilters,
  type DateRange
} from '@/hooks/useLytxHistoricalData';
import { LytxAnalyticsService } from '@/services/lytxAnalyticsService';

interface LytxHistoricalDashboardProps {
  defaultCarrier?: 'All' | 'Stevemacs' | 'Great Southern Fuels';
  defaultDateRange?: DateRange;
  showTitle?: boolean;
}

export const LytxHistoricalDashboard: React.FC<LytxHistoricalDashboardProps> = ({
  defaultCarrier = 'All',
  defaultDateRange,
  showTitle = true
}) => {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'drivers' | 'depots' | 'trends' | 'triggers'>('overview');
  const [filters, setFilters] = useState<LytxAnalyticsFilters>({
    carrier: defaultCarrier,
    dateRange: defaultDateRange,
    status: 'All',
    eventType: 'All',
    driverAssigned: 'All',
    excluded: false
  });
  
  const dateRanges = useDateRanges();
  
  // Fetch comprehensive data
  const summaryStats = useLytxSummaryStats(filters);
  const monthlyTrends = useLytxMonthlyTrends(filters);
  const driverPerformance = useLytxDriverPerformance(filters);
  const depotAnalytics = useLytxDepotAnalytics(filters);
  const triggerAnalysis = useLytxTriggerAnalysis(filters);
  
  const isLoading = summaryStats.isLoading || monthlyTrends.isLoading;
  const hasError = summaryStats.isError || monthlyTrends.isError;

  // Quick stats calculations
  const stats = useMemo(() => {
    if (!summaryStats.data) return null;
    
    const data = summaryStats.data;
    const trends = monthlyTrends.data || [];
    
    // Calculate period-over-period changes
    const currentPeriod = trends.slice(-3); // Last 3 months
    const previousPeriod = trends.slice(-6, -3); // Previous 3 months
    
    const currentAvg = currentPeriod.length > 0 
      ? currentPeriod.reduce((sum, t) => sum + t.total, 0) / currentPeriod.length 
      : 0;
    const previousAvg = previousPeriod.length > 0 
      ? previousPeriod.reduce((sum, t) => sum + t.total, 0) / previousPeriod.length 
      : 0;
    
    const trendsChange = previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;
    
    return {
      ...data,
      trendsChange,
      currentPeriodAvg: Math.round(currentAvg),
      previousPeriodAvg: Math.round(previousAvg),
      bestPerformingDepot: depotAnalytics.data?.find(d => d.resolutionRate === Math.max(...(depotAnalytics.data?.map(d => d.resolutionRate) || []))),
      topDriver: driverPerformance.data?.[0],
      mostCommonTrigger: triggerAnalysis.data?.[0]
    };
  }, [summaryStats.data, monthlyTrends.data, depotAnalytics.data, driverPerformance.data, triggerAnalysis.data]);

  const handleFilterChange = (newFilters: Partial<LytxAnalyticsFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleExportData = async () => {
    try {
      const blob = await LytxAnalyticsService.exportData({
        format: 'csv',
        includeCharts: false,
        includeRawData: true,
        filters
      });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `lytx_historical_analytics_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (hasError) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Analytics</h3>
        <p className="text-gray-600 mb-4">Unable to load historical safety data. Please check your connection and try again.</p>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <RefreshCw className="h-4 w-4 inline mr-2" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {showTitle && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">LYTX Safety Analytics</h1>
              <p className="text-gray-600 mt-1">Historical analysis of {stats?.totalEvents || '34,000+'} safety events</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <Download className="h-4 w-4" />
                Export Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <select
            value={filters.carrier || 'All'}
            onChange={(e) => handleFilterChange({ carrier: e.target.value as any })}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Carriers</option>
            <option value="Stevemacs">Stevemacs</option>
            <option value="Great Southern Fuels">Great Southern Fuels</option>
          </select>

          <select
            value={filters.dateRange ? 'custom' : 'year2024'}
            onChange={(e) => {
              if (e.target.value === 'custom') return;
              handleFilterChange({ dateRange: dateRanges[e.target.value as keyof typeof dateRanges] });
            }}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="last30Days">Last 30 Days</option>
            <option value="last90Days">Last 90 Days</option>
            <option value="last6Months">Last 6 Months</option>
            <option value="lastYear">Last Year</option>
            <option value="year2024">2024 Full Year</option>
            <option value="year2025">2025 YTD</option>
            <option value="allTime">All Time</option>
          </select>

          <select
            value={filters.status || 'All'}
            onChange={(e) => handleFilterChange({ status: e.target.value as any })}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Status</option>
            <option value="New">New</option>
            <option value="Face-To-Face">Face-To-Face</option>
            <option value="FYI Notify">FYI Notify</option>
            <option value="Resolved">Resolved</option>
          </select>

          <select
            value={filters.eventType || 'All'}
            onChange={(e) => handleFilterChange({ eventType: e.target.value as any })}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Types</option>
            <option value="Coachable">Coachable</option>
            <option value="Driver Tagged">Driver Tagged</option>
          </select>

          <select
            value={filters.driverAssigned || 'All'}
            onChange={(e) => handleFilterChange({ driverAssigned: e.target.value as any })}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Drivers</option>
            <option value="Assigned">Assigned</option>
            <option value="Unassigned">Unassigned</option>
          </select>

          <div className="flex items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!filters.excluded}
                onChange={(e) => handleFilterChange({ excluded: !e.target.checked })}
                className="rounded"
              />
              Include Excluded
            </label>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading historical analytics...</p>
        </div>
      )}

      {/* Key Metrics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Events</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalEvents.toLocaleString()}</p>
                <div className="flex items-center mt-2">
                  {stats.trendsChange > 0 ? (
                    <TrendingUp className="h-4 w-4 text-red-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-green-500" />
                  )}
                  <span className={`text-sm font-medium ml-1 ${
                    stats.trendsChange > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {Math.abs(stats.trendsChange).toFixed(1)}% vs prev period
                  </span>
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Resolution Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.resolutionRate.toFixed(1)}%</p>
                <p className="text-sm text-gray-500 mt-2">
                  {stats.resolvedEvents.toLocaleString()} of {stats.totalEvents.toLocaleString()} resolved
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Average Score</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avgScore}</p>
                <p className="text-sm text-gray-500 mt-2">
                  Safety risk score average
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <Target className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Unassigned Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.unassignedRate.toFixed(1)}%</p>
                <p className="text-sm text-gray-500 mt-2">
                  {stats.unassignedDrivers.toLocaleString()} events need assignment
                </p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <UserCheck className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Carrier Comparison */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Carrier Distribution</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-600">Stevemacs</span>
                <span className="text-sm text-gray-600">{stats.stevemacsEvents.toLocaleString()} events</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${(stats.stevemacsEvents / stats.totalEvents) * 100}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm font-medium text-green-600">Great Southern Fuels</span>
                <span className="text-sm text-gray-600">{stats.gsfEvents.toLocaleString()} events</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full" 
                  style={{ width: `${(stats.gsfEvents / stats.totalEvents) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Types</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-orange-600">Coachable Events</span>
                <span className="text-sm text-gray-600">{stats.coachableEvents.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-orange-600 h-2 rounded-full" 
                  style={{ width: `${(stats.coachableEvents / stats.totalEvents) * 100}%` }}
                />
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm font-medium text-purple-600">Driver Tagged</span>
                <span className="text-sm text-gray-600">{stats.driverTaggedEvents.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-purple-600 h-2 rounded-full" 
                  style={{ width: `${(stats.driverTaggedEvents / stats.totalEvents) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            {[
              { id: 'overview', name: 'Overview', icon: BarChart3 },
              { id: 'drivers', name: 'Driver Performance', icon: Users },
              { id: 'depots', name: 'Depot Analysis', icon: MapPin },
              { id: 'trends', name: 'Monthly Trends', icon: TrendingUp },
              { id: 'triggers', name: 'Event Triggers', icon: AlertTriangle }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`${
                  selectedTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {selectedTab === 'overview' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Status Distribution</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats && Object.entries(stats.statusDistribution).map(([status, count]) => (
                  <div key={status} className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-900">{count.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">{status}</p>
                    <p className="text-xs text-gray-500">
                      {((count / stats.totalEvents) * 100).toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTab === 'drivers' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Top Drivers by Event Count</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-3 font-medium text-gray-900">Driver</th>
                      <th className="text-left p-3 font-medium text-gray-900">Events</th>
                      <th className="text-left p-3 font-medium text-gray-900">Avg Score</th>
                      <th className="text-left p-3 font-medium text-gray-900">Resolution Rate</th>
                      <th className="text-left p-3 font-medium text-gray-900">Carrier</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverPerformance.data?.slice(0, 10).map((driver, index) => (
                      <tr key={driver.driver} className="border-b border-gray-100">
                        <td className="p-3 font-medium text-gray-900">{driver.driver}</td>
                        <td className="p-3 text-gray-600">{driver.totalEvents}</td>
                        <td className="p-3">
                          <span className={`font-medium ${
                            driver.avgScore >= 7 ? 'text-red-600' : 
                            driver.avgScore >= 4 ? 'text-yellow-600' : 'text-green-600'
                          }`}>
                            {driver.avgScore}
                          </span>
                        </td>
                        <td className="p-3 text-gray-600">{driver.resolutionRate}%</td>
                        <td className="p-3">
                          <span className={`text-sm ${
                            driver.carrier === 'Stevemacs' ? 'text-blue-600' : 'text-green-600'
                          }`}>
                            {driver.carrier}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedTab === 'depots' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Depot Performance Comparison</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {depotAnalytics.data?.map((depot) => (
                  <div key={depot.depot} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">{depot.depot}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Total Events:</span>
                        <span className="font-medium">{depot.totalEvents}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Avg Score:</span>
                        <span className="font-medium">{depot.avgScore}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Resolution Rate:</span>
                        <span className="font-medium">{depot.resolutionRate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Unassigned Rate:</span>
                        <span className="font-medium">{depot.unassignedRate}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTab === 'trends' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Monthly Event Trends</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left p-3 font-medium text-gray-900">Month</th>
                      <th className="text-left p-3 font-medium text-gray-900">Total</th>
                      <th className="text-left p-3 font-medium text-gray-900">SMB Coachable</th>
                      <th className="text-left p-3 font-medium text-gray-900">GSF Coachable</th>
                      <th className="text-left p-3 font-medium text-gray-900">Avg Score</th>
                      <th className="text-left p-3 font-medium text-gray-900">Resolution Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTrends.data?.map((month) => (
                      <tr key={month.month} className="border-b border-gray-100">
                        <td className="p-3 font-medium text-gray-900">{month.month}</td>
                        <td className="p-3 text-gray-600">{month.total}</td>
                        <td className="p-3 text-blue-600">{month.coachableSMB}</td>
                        <td className="p-3 text-green-600">{month.coachableGSF}</td>
                        <td className="p-3 font-medium">{month.avgScore}</td>
                        <td className="p-3 text-gray-600">{month.resolutionRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {selectedTab === 'triggers' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Most Common Event Triggers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {triggerAnalysis.data?.slice(0, 10).map((trigger, index) => (
                  <div key={trigger.trigger} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{trigger.trigger}</p>
                      <p className="text-sm text-gray-600">{trigger.count} events ({trigger.percentage}%)</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Score: {trigger.avgScore}</p>
                      <p className="text-sm text-gray-600">{trigger.resolutionRate}% resolved</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LytxHistoricalDashboard;