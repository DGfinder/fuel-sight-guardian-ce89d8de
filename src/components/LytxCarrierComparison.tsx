/**
 * LYTX Carrier Comparison Analytics
 * Comprehensive comparison between Stevemacs and Great Southern Fuels
 * Provides head-to-head metrics, trends, and operational insights
 */

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, BarChart3, PieChart, Users, MapPin, 
  Calendar, Target, Award, AlertTriangle, ArrowRight, 
  CheckCircle, Clock, Activity, Truck, Shield
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, ComposedChart, Area, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart as RechartsPie, Cell, RadialBarChart, RadialBar
} from 'recharts';
import {
  useLytxSummaryStats,
  useLytxMonthlyTrends, 
  useLytxDepotAnalytics,
  useLytxDriverPerformance,
  useLytxTriggerAnalysis,
  type LytxAnalyticsFilters
} from '@/hooks/useLytxHistoricalData';

interface LytxCarrierComparisonProps {
  baseFilters: LytxAnalyticsFilters;
  dateRange?: { startDate: string; endDate: string };
}

const CARRIER_COLORS = {
  Stevemacs: '#3B82F6',
  'Great Southern Fuels': '#10B981'
};

const METRIC_COLORS = {
  excellent: '#10B981',
  good: '#3B82F6',
  warning: '#F59E0B', 
  poor: '#EF4444'
};

export const LytxCarrierComparison: React.FC<LytxCarrierComparisonProps> = ({
  baseFilters,
  dateRange
}) => {
  const [selectedMetric, setSelectedMetric] = useState<'events' | 'resolution' | 'scores' | 'drivers'>('events');
  const [timeFrame, setTimeFrame] = useState<'monthly' | 'quarterly'>('monthly');

  // Fetch data for both carriers
  const stevemacsFilters = { ...baseFilters, carrier: 'Stevemacs' as const };
  const gsfFilters = { ...baseFilters, carrier: 'Great Southern Fuels' as const };

  const stevemacsStats = useLytxSummaryStats(stevemacsFilters);
  const gsfStats = useLytxSummaryStats(gsfFilters);
  
  const stevemacsTrends = useLytxMonthlyTrends(stevemacsFilters);
  const gsfTrends = useLytxMonthlyTrends(gsfFilters);
  
  const stevemacsDepots = useLytxDepotAnalytics(stevemacsFilters);
  const gsfDepots = useLytxDepotAnalytics(gsfFilters);
  
  const stevemacsDrivers = useLytxDriverPerformance(stevemacsFilters);
  const gsfDrivers = useLytxDriverPerformance(gsfFilters);

  const stevemacsTriggers = useLytxTriggerAnalysis(stevemacsFilters);
  const gsfTriggers = useLytxTriggerAnalysis(gsfFilters);

  // Comprehensive comparison metrics
  const comparisonMetrics = useMemo(() => {
    if (!stevemacsStats.data || !gsfStats.data) return null;

    const smbStats = stevemacsStats.data;
    const gsfStatsData = gsfStats.data;

    return {
      totalEvents: {
        Stevemacs: smbStats.totalEvents,
        'Great Southern Fuels': gsfStatsData.totalEvents,
        winner: smbStats.totalEvents < gsfStatsData.totalEvents ? 'Stevemacs' : 'Great Southern Fuels'
      },
      resolutionRate: {
        Stevemacs: smbStats.resolutionRate,
        'Great Southern Fuels': gsfStatsData.resolutionRate,
        winner: smbStats.resolutionRate > gsfStatsData.resolutionRate ? 'Stevemacs' : 'Great Southern Fuels'
      },
      avgScore: {
        Stevemacs: smbStats.avgScore,
        'Great Southern Fuels': gsfStatsData.avgScore,
        winner: smbStats.avgScore < gsfStatsData.avgScore ? 'Stevemacs' : 'Great Southern Fuels'
      },
      unassignedRate: {
        Stevemacs: smbStats.unassignedRate,
        'Great Southern Fuels': gsfStatsData.unassignedRate,
        winner: smbStats.unassignedRate < gsfStatsData.unassignedRate ? 'Stevemacs' : 'Great Southern Fuels'
      },
      coachableEvents: {
        Stevemacs: smbStats.coachableEvents,
        'Great Southern Fuels': gsfStatsData.coachableEvents,
        winner: smbStats.coachableEvents < gsfStatsData.coachableEvents ? 'Stevemacs' : 'Great Southern Fuels'
      },
      driverTaggedEvents: {
        Stevemacs: smbStats.driverTaggedEvents,
        'Great Southern Fuels': gsfStatsData.driverTaggedEvents,
        winner: smbStats.driverTaggedEvents < gsfStatsData.driverTaggedEvents ? 'Stevemacs' : 'Great Southern Fuels'
      }
    };
  }, [stevemacsStats.data, gsfStats.data]);

  // Combined trend data
  const combinedTrends = useMemo(() => {
    if (!stevemacsTrends.data || !gsfTrends.data) return [];

    const smbTrends = stevemacsTrends.data;
    const gsfTrendsData = gsfTrends.data;

    // Create map of months
    const monthMap = new Map();
    
    smbTrends.forEach(trend => {
      monthMap.set(trend.month, {
        month: trend.month,
        stevemacsTotal: trend.total,
        stevemacsResolved: trend.resolved,
        stevemacsAvgScore: trend.avgScore,
        stevemacsResolutionRate: trend.resolutionRate,
        gsfTotal: 0,
        gsfResolved: 0,
        gsfAvgScore: 0,
        gsfResolutionRate: 0
      });
    });

    gsfTrendsData.forEach(trend => {
      const existing = monthMap.get(trend.month) || {
        month: trend.month,
        stevemacsTotal: 0,
        stevemacsResolved: 0,
        stevemacsAvgScore: 0,
        stevemacsResolutionRate: 0,
        gsfTotal: 0,
        gsfResolved: 0,
        gsfAvgScore: 0,
        gsfResolutionRate: 0
      };
      
      existing.gsfTotal = trend.total;
      existing.gsfResolved = trend.resolved;
      existing.gsfAvgScore = trend.avgScore;
      existing.gsfResolutionRate = trend.resolutionRate;
      
      monthMap.set(trend.month, existing);
    });

    return Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [stevemacsTrends.data, gsfTrends.data]);

  // Performance scoring
  const performanceScores = useMemo(() => {
    if (!comparisonMetrics) return null;

    const calculateScore = (carrier: 'Stevemacs' | 'Great Southern Fuels') => {
      let score = 0;
      
      // Resolution rate (40% weight)
      const resolutionRate = comparisonMetrics.resolutionRate[carrier];
      score += (resolutionRate / 100) * 40;
      
      // Average score - lower is better (30% weight)
      const avgScore = comparisonMetrics.avgScore[carrier];
      score += (1 - (avgScore / 10)) * 30;
      
      // Unassigned rate - lower is better (20% weight)  
      const unassignedRate = comparisonMetrics.unassignedRate[carrier];
      score += (1 - (unassignedRate / 100)) * 20;
      
      // Event volume - lower is better (10% weight)
      const totalEvents = comparisonMetrics.totalEvents[carrier];
      const maxEvents = Math.max(
        comparisonMetrics.totalEvents.Stevemacs,
        comparisonMetrics.totalEvents['Great Southern Fuels']
      );
      score += (1 - (totalEvents / maxEvents)) * 10;

      return Math.round(score);
    };

    return {
      Stevemacs: calculateScore('Stevemacs'),
      'Great Southern Fuels': calculateScore('Great Southern Fuels')
    };
  }, [comparisonMetrics]);

  // Top issues for each carrier
  const carrierIssues = useMemo(() => {
    const smbTriggers = stevemacsTriggers.data?.slice(0, 5) || [];
    const gsfTriggersData = gsfTriggers.data?.slice(0, 5) || [];

    return {
      Stevemacs: smbTriggers,
      'Great Southern Fuels': gsfTriggersData
    };
  }, [stevemacsTriggers.data, gsfTriggers.data]);

  if (stevemacsStats.isLoading || gsfStats.isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading carrier comparison data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Performance Scores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stevemacs Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-6 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-600 rounded-lg">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-blue-900">Stevemacs</h3>
                <p className="text-blue-700 text-sm">Kewdale Operations</p>
              </div>
            </div>
            {performanceScores && (
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-900">{performanceScores.Stevemacs}</div>
                <div className="text-blue-700 text-sm">Performance Score</div>
              </div>
            )}
          </div>
          
          {comparisonMetrics && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-blue-700">Total Events</p>
                <p className="font-bold text-blue-900">{comparisonMetrics.totalEvents.Stevemacs.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-blue-700">Resolution Rate</p>
                <p className="font-bold text-blue-900">{comparisonMetrics.resolutionRate.Stevemacs.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-blue-700">Avg Score</p>
                <p className="font-bold text-blue-900">{comparisonMetrics.avgScore.Stevemacs}</p>
              </div>
              <div>
                <p className="text-blue-700">Unassigned</p>
                <p className="font-bold text-blue-900">{comparisonMetrics.unassignedRate.Stevemacs.toFixed(1)}%</p>
              </div>
            </div>
          )}
        </div>

        {/* Great Southern Fuels Card */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-md p-6 border-2 border-green-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-600 rounded-lg">
                <Truck className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-green-900">Great Southern Fuels</h3>
                <p className="text-green-700 text-sm">Multi-Depot Operations</p>
              </div>
            </div>
            {performanceScores && (
              <div className="text-right">
                <div className="text-3xl font-bold text-green-900">{performanceScores['Great Southern Fuels']}</div>
                <div className="text-green-700 text-sm">Performance Score</div>
              </div>
            )}
          </div>
          
          {comparisonMetrics && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-green-700">Total Events</p>
                <p className="font-bold text-green-900">{comparisonMetrics.totalEvents['Great Southern Fuels'].toLocaleString()}</p>
              </div>
              <div>
                <p className="text-green-700">Resolution Rate</p>
                <p className="font-bold text-green-900">{comparisonMetrics.resolutionRate['Great Southern Fuels'].toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-green-700">Avg Score</p>
                <p className="font-bold text-green-900">{comparisonMetrics.avgScore['Great Southern Fuels']}</p>
              </div>
              <div>
                <p className="text-green-700">Unassigned</p>
                <p className="font-bold text-green-900">{comparisonMetrics.unassignedRate['Great Southern Fuels'].toFixed(1)}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Head-to-Head Metrics */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Head-to-Head Comparison</h3>
        
        {comparisonMetrics && (
          <div className="space-y-4">
            {[
              { key: 'resolutionRate', label: 'Resolution Rate', unit: '%', higher: true },
              { key: 'avgScore', label: 'Average Safety Score', unit: '', higher: false },
              { key: 'unassignedRate', label: 'Unassigned Rate', unit: '%', higher: false },
              { key: 'totalEvents', label: 'Total Events', unit: '', higher: false }
            ].map((metric) => {
              const data = comparisonMetrics[metric.key as keyof typeof comparisonMetrics];
              const smbValue = data.Stevemacs;
              const gsfValue = data['Great Southern Fuels'];
              const winner = data.winner;
              
              return (
                <div key={metric.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{metric.label}</h4>
                  </div>
                  
                  <div className="flex items-center gap-8">
                    <div className={`text-center p-2 rounded ${
                      winner === 'Stevemacs' ? 'bg-blue-100 border-2 border-blue-300' : ''
                    }`}>
                      <p className="text-sm text-gray-600">Stevemacs</p>
                      <p className="font-bold text-lg">{smbValue}{metric.unit}</p>
                      {winner === 'Stevemacs' && <Award className="h-4 w-4 text-blue-600 mx-auto mt-1" />}
                    </div>
                    
                    <div className="text-gray-400">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                    
                    <div className={`text-center p-2 rounded ${
                      winner === 'Great Southern Fuels' ? 'bg-green-100 border-2 border-green-300' : ''
                    }`}>
                      <p className="text-sm text-gray-600">GSF</p>
                      <p className="font-bold text-lg">{gsfValue}{metric.unit}</p>
                      {winner === 'Great Southern Fuels' && <Award className="h-4 w-4 text-green-600 mx-auto mt-1" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trend Analysis */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Monthly Trends Comparison</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedMetric('events')}
              className={`px-3 py-1 text-sm rounded ${
                selectedMetric === 'events' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Events
            </button>
            <button
              onClick={() => setSelectedMetric('resolution')}
              className={`px-3 py-1 text-sm rounded ${
                selectedMetric === 'resolution' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Resolution Rate
            </button>
            <button
              onClick={() => setSelectedMetric('scores')}
              className={`px-3 py-1 text-sm rounded ${
                selectedMetric === 'scores' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              Avg Scores
            </button>
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            {selectedMetric === 'events' ? (
              <ComposedChart data={combinedTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="stevemacsTotal" fill={CARRIER_COLORS.Stevemacs} name="Stevemacs Events" />
                <Bar dataKey="gsfTotal" fill={CARRIER_COLORS['Great Southern Fuels']} name="GSF Events" />
              </ComposedChart>
            ) : selectedMetric === 'resolution' ? (
              <LineChart data={combinedTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="stevemacsResolutionRate" 
                  stroke={CARRIER_COLORS.Stevemacs} 
                  strokeWidth={3}
                  name="Stevemacs Resolution Rate"
                />
                <Line 
                  type="monotone" 
                  dataKey="gsfResolutionRate" 
                  stroke={CARRIER_COLORS['Great Southern Fuels']} 
                  strokeWidth={3}
                  name="GSF Resolution Rate"
                />
              </LineChart>
            ) : (
              <LineChart data={combinedTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="stevemacsAvgScore" 
                  stroke={CARRIER_COLORS.Stevemacs} 
                  strokeWidth={3}
                  name="Stevemacs Avg Score"
                />
                <Line 
                  type="monotone" 
                  dataKey="gsfAvgScore" 
                  stroke={CARRIER_COLORS['Great Southern Fuels']} 
                  strokeWidth={3}
                  name="GSF Avg Score"
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Issues Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Issues - Stevemacs</h3>
          <div className="space-y-3">
            {carrierIssues.Stevemacs.map((trigger, index) => (
              <div key={trigger.trigger} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{trigger.trigger}</p>
                  <p className="text-sm text-gray-600">{trigger.percentage.toFixed(1)}% of events</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-blue-600">{trigger.count}</p>
                  <p className="text-xs text-gray-500">Avg: {trigger.avgScore}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Issues - Great Southern Fuels</h3>
          <div className="space-y-3">
            {carrierIssues['Great Southern Fuels'].map((trigger, index) => (
              <div key={trigger.trigger} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{trigger.trigger}</p>
                  <p className="text-sm text-gray-600">{trigger.percentage.toFixed(1)}% of events</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">{trigger.count}</p>
                  <p className="text-xs text-gray-500">Avg: {trigger.avgScore}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Depot Performance Comparison */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Depot Performance Comparison</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={[
                ...(stevemacsDepots.data || []).map(d => ({ ...d, carrier: 'Stevemacs' })),
                ...(gsfDepots.data || []).map(d => ({ ...d, carrier: 'Great Southern Fuels' }))
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="depot" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar 
                dataKey="totalEvents" 
                fill={(entry) => entry.carrier === 'Stevemacs' ? CARRIER_COLORS.Stevemacs : CARRIER_COLORS['Great Southern Fuels']}
                name="Total Events"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Action Items and Recommendations */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {performanceScores && performanceScores.Stevemacs < performanceScores['Great Southern Fuels'] && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-800">Stevemacs Improvement</span>
              </div>
              <p className="text-sm text-blue-700">
                Focus on improving resolution rate and reducing average safety scores to match GSF performance.
              </p>
            </div>
          )}
          
          {performanceScores && performanceScores['Great Southern Fuels'] < performanceScores.Stevemacs && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">GSF Improvement</span>
              </div>
              <p className="text-sm text-green-700">
                Focus on improving resolution rate and reducing average safety scores to match Stevemacs performance.
              </p>
            </div>
          )}
          
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-5 w-5 text-yellow-600" />
              <span className="font-medium text-yellow-800">Driver Assignment</span>
            </div>
            <p className="text-sm text-yellow-700">
              Both carriers should focus on reducing unassigned driver rates for better accountability.
            </p>
          </div>
          
          <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-purple-800">Best Practices</span>
            </div>
            <p className="text-sm text-purple-700">
              Share successful depot strategies between carriers to improve overall fleet safety.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LytxCarrierComparison;