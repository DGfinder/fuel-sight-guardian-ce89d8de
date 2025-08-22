/**
 * LYTX Driver Performance Tracker
 * Advanced driver performance analytics with benchmarking and coaching insights
 * Provides detailed tracking and comparison across drivers, depots, and carriers
 */

import React, { useState, useMemo } from 'react';
import { 
  User, TrendingUp, TrendingDown, Award, AlertTriangle, Target, 
  Calendar, MapPin, BarChart3, Clock, CheckCircle, FileText,
  Filter, Download, Search, Eye, ArrowUpDown, Users
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  useLytxDriverPerformance,
  useLytxHistoricalEvents,
  type LytxAnalyticsFilters,
  type DateRange
} from '@/hooks/useLytxHistoricalData';
import { LytxAnalyticsService } from '@/services/lytxAnalyticsService';
import LytxDriverDetailModal from './LytxDriverDetailModal';

interface LytxDriverPerformanceTrackerProps {
  filters: LytxAnalyticsFilters;
  onFilterChange: (newFilters: Partial<LytxAnalyticsFilters>) => void;
  dateRange?: DateRange;
}

const PERFORMANCE_COLORS = {
  excellent: '#10B981',
  good: '#3B82F6', 
  average: '#F59E0B',
  poor: '#EF4444'
};

const getPerformanceLevel = (resolutionRate: number, avgScore: number): keyof typeof PERFORMANCE_COLORS => {
  if (resolutionRate >= 90 && avgScore < 3) return 'excellent';
  if (resolutionRate >= 75 && avgScore < 4) return 'good';
  if (resolutionRate >= 50 && avgScore < 6) return 'average';
  return 'poor';
};

export const LytxDriverPerformanceTracker: React.FC<LytxDriverPerformanceTrackerProps> = ({
  filters,
  onFilterChange,
  dateRange
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'totalEvents' | 'avgScore' | 'resolutionRate' | 'driver'>('totalEvents');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [performanceFilter, setPerformanceFilter] = useState<'all' | 'excellent' | 'good' | 'average' | 'poor'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table');

  // Fetch driver performance data
  const { data: driverData, isLoading } = useLytxDriverPerformance(filters);
  const { data: allEvents } = useLytxHistoricalEvents(filters);

  // Process and enhance driver data
  const enhancedDriverData = useMemo(() => {
    if (!driverData || !allEvents) return [];

    return driverData.map(driver => {
      const driverEvents = allEvents.filter(e => e.driver_name === driver.driver);
      
      // Calculate additional metrics
      const recentEvents = driverEvents
        .filter(e => new Date(e.event_datetime) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        .length;
      
      const highRiskEvents = driverEvents.filter(e => e.score >= 7).length;
      const mediumRiskEvents = driverEvents.filter(e => e.score >= 4 && e.score < 7).length;
      
      // Calculate trend (last 30 days vs previous 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      
      const last30Days = driverEvents.filter(e => new Date(e.event_datetime) >= thirtyDaysAgo).length;
      const previous30Days = driverEvents.filter(e => {
        const date = new Date(e.event_datetime);
        return date >= sixtyDaysAgo && date < thirtyDaysAgo;
      }).length;
      
      const trend = previous30Days > 0 ? ((last30Days - previous30Days) / previous30Days) * 100 : 0;
      
      // Performance level
      const performanceLevel = getPerformanceLevel(driver.resolutionRate, driver.avgScore);
      
      // Most common trigger
      const triggerCounts: Record<string, number> = {};
      driverEvents.forEach(event => {
        triggerCounts[event.trigger] = (triggerCounts[event.trigger] || 0) + 1;
      });
      const topTrigger = Object.entries(triggerCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';

      return {
        ...driver,
        recentEvents,
        highRiskEvents,
        mediumRiskEvents,
        trend,
        performanceLevel,
        topTrigger,
        riskScore: (driver.avgScore * 10) + (100 - driver.resolutionRate),
        coachingPriority: highRiskEvents > 0 ? 'High' : mediumRiskEvents > 2 ? 'Medium' : 'Low'
      };
    });
  }, [driverData, allEvents]);

  // Filter and sort drivers
  const filteredDrivers = useMemo(() => {
    const filtered = enhancedDriverData.filter(driver => {
      const matchesSearch = driver.driver.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPerformance = performanceFilter === 'all' || driver.performanceLevel === performanceFilter;
      return matchesSearch && matchesPerformance;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'driver':
          aValue = a.driver;
          bValue = b.driver;
          break;
        case 'avgScore':
          aValue = a.avgScore;
          bValue = b.avgScore;
          break;
        case 'resolutionRate':
          aValue = a.resolutionRate;
          bValue = b.resolutionRate;
          break;
        default:
          aValue = a.totalEvents;
          bValue = b.totalEvents;
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    return filtered;
  }, [enhancedDriverData, searchTerm, performanceFilter, sortBy, sortOrder]);

  // Performance distribution
  const performanceDistribution = useMemo(() => {
    const distribution = { excellent: 0, good: 0, average: 0, poor: 0 };
    enhancedDriverData.forEach(driver => {
      distribution[driver.performanceLevel]++;
    });
    
    return Object.entries(distribution).map(([level, count]) => ({
      level,
      count,
      color: PERFORMANCE_COLORS[level as keyof typeof PERFORMANCE_COLORS]
    }));
  }, [enhancedDriverData]);

  // Top performers and priority drivers
  const topPerformers = enhancedDriverData
    .filter(d => d.performanceLevel === 'excellent')
    .slice(0, 5);
    
  const priorityDrivers = enhancedDriverData
    .filter(d => d.coachingPriority === 'High')
    .slice(0, 10);

  const handleExportDriverData = async () => {
    try {
      const data = filteredDrivers.map(driver => ({
        Driver: driver.driver,
        Carrier: driver.carrier,
        'Total Events': driver.totalEvents,
        'Average Score': driver.avgScore,
        'Resolution Rate %': driver.resolutionRate,
        'Recent Events (30d)': driver.recentEvents,
        'High Risk Events': driver.highRiskEvents,
        'Performance Level': driver.performanceLevel,
        'Coaching Priority': driver.coachingPriority,
        'Top Trigger': driver.topTrigger,
        'Trend %': driver.trend.toFixed(1)
      }));

      const csv = [
        Object.keys(data[0]).join(','),
        ...data.map(row => Object.values(row).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `driver_performance_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading driver performance data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Driver Performance Tracker</h2>
            <p className="text-gray-600">Performance analytics and coaching insights for {enhancedDriverData.length} drivers</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportDriverData}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              Export Data
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Excellent</p>
                <p className="text-2xl font-bold text-green-900">{performanceDistribution.find(p => p.level === 'excellent')?.count || 0}</p>
              </div>
              <Award className="h-8 w-8 text-green-600" />
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Good</p>
                <p className="text-2xl font-bold text-blue-900">{performanceDistribution.find(p => p.level === 'good')?.count || 0}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-600" />
            </div>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-600 text-sm font-medium">Needs Improvement</p>
                <p className="text-2xl font-bold text-yellow-900">{performanceDistribution.find(p => p.level === 'average')?.count || 0}</p>
              </div>
              <Target className="h-8 w-8 text-yellow-600" />
            </div>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">High Priority</p>
                <p className="text-2xl font-bold text-red-900">{priorityDrivers.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search drivers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={performanceFilter}
            onChange={(e) => setPerformanceFilter(e.target.value as any)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Performance</option>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="average">Needs Improvement</option>
            <option value="poor">High Priority</option>
          </select>

          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field as any);
              setSortOrder(order as any);
            }}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="totalEvents-desc">Most Events</option>
            <option value="totalEvents-asc">Fewest Events</option>
            <option value="avgScore-desc">Highest Score</option>
            <option value="avgScore-asc">Lowest Score</option>
            <option value="resolutionRate-desc">Best Resolution</option>
            <option value="resolutionRate-asc">Poor Resolution</option>
            <option value="driver-asc">Name A-Z</option>
          </select>

          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'table' ? 'bg-white shadow' : 'text-gray-600'
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'chart' ? 'bg-white shadow' : 'text-gray-600'
              }`}
            >
              Chart
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Content */}
      {viewMode === 'table' ? (
        /* Driver Performance Table */
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-900">Driver</th>
                  <th className="text-left p-4 font-medium text-gray-900">Performance</th>
                  <th className="text-left p-4 font-medium text-gray-900">Events</th>
                  <th className="text-left p-4 font-medium text-gray-900">Avg Score</th>
                  <th className="text-left p-4 font-medium text-gray-900">Resolution</th>
                  <th className="text-left p-4 font-medium text-gray-900">Trend</th>
                  <th className="text-left p-4 font-medium text-gray-900">Priority</th>
                  <th className="text-left p-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredDrivers.map((driver) => (
                  <tr key={driver.driver} className="hover:bg-gray-50">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-gray-900">{driver.driver}</p>
                        <p className="text-sm text-gray-600">{driver.carrier}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: PERFORMANCE_COLORS[driver.performanceLevel] }}
                        />
                        <span className="text-sm font-medium capitalize">
                          {driver.performanceLevel}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{driver.totalEvents}</p>
                        <p className="text-xs text-gray-500">{driver.recentEvents} recent</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`font-medium ${
                        driver.avgScore >= 7 ? 'text-red-600' :
                        driver.avgScore >= 4 ? 'text-yellow-600' :
                        'text-green-600'
                      }`}>
                        {driver.avgScore}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`font-medium ${
                        driver.resolutionRate >= 80 ? 'text-green-600' :
                        driver.resolutionRate >= 60 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {driver.resolutionRate}%
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        {driver.trend > 0 ? (
                          <TrendingUp className="h-4 w-4 text-red-500" />
                        ) : driver.trend < 0 ? (
                          <TrendingDown className="h-4 w-4 text-green-500" />
                        ) : (
                          <div className="h-4 w-4" />
                        )}
                        <span className={`text-sm font-medium ${
                          driver.trend > 0 ? 'text-red-600' :
                          driver.trend < 0 ? 'text-green-600' :
                          'text-gray-600'
                        }`}>
                          {driver.trend > 0 ? '+' : ''}{driver.trend.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        driver.coachingPriority === 'High' ? 'bg-red-100 text-red-800' :
                        driver.coachingPriority === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {driver.coachingPriority}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => {
                          setSelectedDriver(driver.driver);
                          setShowDriverModal(true);
                        }}
                        className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        <Eye className="h-3 w-3" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Performance Chart View */
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Driver Performance Scatter Plot</h3>
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart data={filteredDrivers.slice(0, 50)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="totalEvents" 
                  type="number" 
                  name="Total Events"
                  label={{ value: 'Total Events', position: 'insideBottom', offset: -10 }}
                />
                <YAxis 
                  dataKey="avgScore" 
                  type="number" 
                  name="Avg Score"
                  label={{ value: 'Average Score', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value, name, props) => {
                    return [
                      [`Driver: ${props.payload.driver}`, ''],
                      [`Events: ${props.payload.totalEvents}`, ''],
                      [`Avg Score: ${props.payload.avgScore}`, ''],
                      [`Resolution Rate: ${props.payload.resolutionRate}%`, ''],
                      [`Performance: ${props.payload.performanceLevel}`, '']
                    ];
                  }}
                />
                <Scatter dataKey="resolutionRate">
                  {filteredDrivers.slice(0, 50).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PERFORMANCE_COLORS[entry.performanceLevel]} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex justify-center gap-6 text-sm">
            {Object.entries(PERFORMANCE_COLORS).map(([level, color]) => (
              <div key={level} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="capitalize">{level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Driver Detail Modal */}
      {showDriverModal && selectedDriver && (
        <LytxDriverDetailModal
          driverName={selectedDriver}
          isOpen={showDriverModal}
          onClose={() => {
            setShowDriverModal(false);
            setSelectedDriver(null);
          }}
          baseFilters={filters}
        />
      )}
    </div>
  );
};

export default LytxDriverPerformanceTracker;