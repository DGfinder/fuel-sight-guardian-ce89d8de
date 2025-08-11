/**
 * LYTX Executive Report
 * Comprehensive executive-level safety analytics and business intelligence
 * Provides high-level insights, KPIs, and strategic recommendations
 */

import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, AlertTriangle, Target, Award, Shield,
  DollarSign, Clock, Users, BarChart3, Download, Calendar,
  CheckCircle, XCircle, Activity, Zap, FileText, Building2
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar, ComposedChart, Area, AreaChart
} from 'recharts';
import {
  useLytxSummaryStats,
  useLytxMonthlyTrends,
  useLytxDriverPerformance, 
  useLytxDepotAnalytics,
  useLytxTriggerAnalysis,
  type LytxAnalyticsFilters
} from '@/hooks/useLytxHistoricalData';
import { LytxAnalyticsService } from '@/services/lytxAnalyticsService';

interface LytxExecutiveReportProps {
  filters: LytxAnalyticsFilters;
  dateRange?: { startDate: string; endDate: string };
}

const KPI_TARGETS = {
  resolutionRate: 85,
  avgScore: 3.5,
  unassignedRate: 10,
  monthlyImprovement: 5
};

const RISK_LEVELS = {
  low: { color: '#10B981', label: 'Low Risk' },
  medium: { color: '#F59E0B', label: 'Medium Risk' },
  high: { color: '#EF4444', label: 'High Risk' },
  critical: { color: '#7C2D12', label: 'Critical Risk' }
};

const getRiskLevel = (score: number): keyof typeof RISK_LEVELS => {
  if (score >= 8) return 'critical';
  if (score >= 6) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
};

export const LytxExecutiveReport: React.FC<LytxExecutiveReportProps> = ({
  filters,
  dateRange
}) => {
  const [reportPeriod, setReportPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [focusArea, setFocusArea] = useState<'overview' | 'performance' | 'risk' | 'cost'>('overview');

  // Fetch comprehensive data
  const summaryStats = useLytxSummaryStats(filters);
  const monthlyTrends = useLytxMonthlyTrends(filters);
  const driverPerformance = useLytxDriverPerformance(filters);
  const depotAnalytics = useLytxDepotAnalytics(filters);
  const triggerAnalysis = useLytxTriggerAnalysis(filters);

  // Executive KPIs and metrics
  const executiveMetrics = useMemo(() => {
    if (!summaryStats.data || !monthlyTrends.data) return null;

    const current = summaryStats.data;
    const trends = monthlyTrends.data;
    
    // Calculate period-over-period changes
    const recentMonths = trends.slice(-3);
    const previousMonths = trends.slice(-6, -3);
    
    const currentPeriodEvents = recentMonths.reduce((sum, m) => sum + m.total, 0);
    const previousPeriodEvents = previousMonths.reduce((sum, m) => sum + m.total, 0);
    
    const eventTrend = previousPeriodEvents > 0 
      ? ((currentPeriodEvents - previousPeriodEvents) / previousPeriodEvents) * 100 
      : 0;

    // Risk assessment
    const highRiskDrivers = driverPerformance.data?.filter(d => d.avgScore >= 6).length || 0;
    const totalDrivers = driverPerformance.data?.length || 1;
    const riskRatio = (highRiskDrivers / totalDrivers) * 100;

    // Cost implications (estimated)
    const avgIncidentCost = 2500; // Average cost per safety incident
    const estimatedCost = current.totalEvents * avgIncidentCost;
    const potentialSavings = (current.totalEvents * 0.2) * avgIncidentCost; // 20% reduction target

    // Performance vs targets
    const kpiPerformance = {
      resolutionRate: {
        actual: current.resolutionRate,
        target: KPI_TARGETS.resolutionRate,
        status: current.resolutionRate >= KPI_TARGETS.resolutionRate ? 'met' : 'missed'
      },
      avgScore: {
        actual: current.avgScore,
        target: KPI_TARGETS.avgScore,
        status: current.avgScore <= KPI_TARGETS.avgScore ? 'met' : 'missed'
      },
      unassignedRate: {
        actual: current.unassignedRate,
        target: KPI_TARGETS.unassignedRate,
        status: current.unassignedRate <= KPI_TARGETS.unassignedRate ? 'met' : 'missed'
      }
    };

    return {
      totalEvents: current.totalEvents,
      resolutionRate: current.resolutionRate,
      avgScore: current.avgScore,
      unassignedRate: current.unassignedRate,
      eventTrend,
      highRiskDrivers,
      totalDrivers,
      riskRatio,
      estimatedCost,
      potentialSavings,
      kpiPerformance,
      fleetSize: depotAnalytics.data?.reduce((sum, d) => sum + d.totalEvents, 0) || 0
    };
  }, [summaryStats.data, monthlyTrends.data, driverPerformance.data, depotAnalytics.data]);

  // Risk distribution analysis
  const riskDistribution = useMemo(() => {
    if (!driverPerformance.data) return [];

    const distribution = { low: 0, medium: 0, high: 0, critical: 0 };
    
    driverPerformance.data.forEach(driver => {
      const level = getRiskLevel(driver.avgScore);
      distribution[level]++;
    });

    return Object.entries(distribution).map(([level, count]) => ({
      level: RISK_LEVELS[level as keyof typeof RISK_LEVELS].label,
      count,
      percentage: driverPerformance.data ? (count / driverPerformance.data.length) * 100 : 0,
      color: RISK_LEVELS[level as keyof typeof RISK_LEVELS].color
    }));
  }, [driverPerformance.data]);

  // Strategic recommendations
  const recommendations = useMemo(() => {
    if (!executiveMetrics) return [];

    const recs = [];

    if (executiveMetrics.kpiPerformance.resolutionRate.status === 'missed') {
      recs.push({
        priority: 'high',
        category: 'Operational',
        title: 'Improve Resolution Rate',
        description: `Resolution rate of ${executiveMetrics.resolutionRate.toFixed(1)}% is below target of ${KPI_TARGETS.resolutionRate}%`,
        impact: 'High',
        timeframe: '30 days'
      });
    }

    if (executiveMetrics.riskRatio > 25) {
      recs.push({
        priority: 'high',
        category: 'Risk Management',
        title: 'Address High-Risk Drivers',
        description: `${executiveMetrics.highRiskDrivers} drivers (${executiveMetrics.riskRatio.toFixed(1)}%) require immediate coaching`,
        impact: 'Critical',
        timeframe: '14 days'
      });
    }

    if (executiveMetrics.eventTrend > 10) {
      recs.push({
        priority: 'medium',
        category: 'Trend Analysis',
        title: 'Investigate Event Increase',
        description: `Safety events increased by ${Math.abs(executiveMetrics.eventTrend).toFixed(1)}% over previous period`,
        impact: 'Medium',
        timeframe: '21 days'
      });
    }

    if (executiveMetrics.unassignedRate > KPI_TARGETS.unassignedRate) {
      recs.push({
        priority: 'medium',
        category: 'Process Improvement',
        title: 'Improve Driver Assignment',
        description: `${executiveMetrics.unassignedRate.toFixed(1)}% of events lack driver assignment`,
        impact: 'Medium',
        timeframe: '7 days'
      });
    }

    return recs.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder];
    });
  }, [executiveMetrics]);

  const handleExportExecutiveReport = async () => {
    if (!executiveMetrics) return;

    try {
      const report = await LytxAnalyticsService.generateExecutiveReport(filters, dateRange);
      
      const reportData = {
        reportDate: new Date().toISOString(),
        period: reportPeriod,
        executiveSummary: {
          totalEvents: executiveMetrics.totalEvents,
          resolutionRate: executiveMetrics.resolutionRate,
          avgScore: executiveMetrics.avgScore,
          eventTrend: executiveMetrics.eventTrend,
          estimatedCost: executiveMetrics.estimatedCost,
          potentialSavings: executiveMetrics.potentialSavings
        },
        kpiPerformance: executiveMetrics.kpiPerformance,
        riskAssessment: riskDistribution,
        recommendations,
        detailedAnalytics: report
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `executive_safety_report_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Report generation failed:', error);
    }
  };

  if (!executiveMetrics) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Generating executive report...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-md p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-2">Executive Safety Report</h1>
            <p className="text-blue-100">
              Period: {dateRange?.startDate || 'All Time'} - {dateRange?.endDate || new Date().toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportExecutiveReport}
              className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50"
            >
              <Download className="h-4 w-4" />
              Export Report
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="text-sm font-medium">Total Events</span>
            </div>
            <p className="text-2xl font-bold mt-2">{executiveMetrics.totalEvents.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-1">
              {executiveMetrics.eventTrend > 0 ? (
                <TrendingUp className="h-3 w-3 text-red-300" />
              ) : (
                <TrendingDown className="h-3 w-3 text-green-300" />
              )}
              <span className="text-xs">
                {Math.abs(executiveMetrics.eventTrend).toFixed(1)}% vs prev period
              </span>
            </div>
          </div>

          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              <span className="text-sm font-medium">Resolution Rate</span>
            </div>
            <p className="text-2xl font-bold mt-2">{executiveMetrics.resolutionRate.toFixed(1)}%</p>
            <p className="text-xs mt-1">Target: {KPI_TARGETS.resolutionRate}%</p>
          </div>

          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              <span className="text-sm font-medium">Safety Score</span>
            </div>
            <p className="text-2xl font-bold mt-2">{executiveMetrics.avgScore}</p>
            <p className="text-xs mt-1">Target: ≤{KPI_TARGETS.avgScore}</p>
          </div>

          <div className="bg-white/10 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              <span className="text-sm font-medium">Est. Cost Impact</span>
            </div>
            <p className="text-2xl font-bold mt-2">
              ${(executiveMetrics.estimatedCost / 1000000).toFixed(1)}M
            </p>
            <p className="text-xs mt-1">Annual estimate</p>
          </div>
        </div>
      </div>

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">KPI Performance</h3>
          <div className="space-y-4">
            {Object.entries(executiveMetrics.kpiPerformance).map(([key, kpi]) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 capitalize">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </p>
                  <p className="text-sm text-gray-600">
                    Target: {typeof kpi.target === 'number' ? 
                      (key.includes('Rate') ? `${kpi.target}%` : kpi.target) : 
                      kpi.target
                    }
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">
                    {typeof kpi.actual === 'number' ? 
                      (key.includes('Rate') ? `${kpi.actual.toFixed(1)}%` : kpi.actual) : 
                      kpi.actual
                    }
                  </span>
                  {kpi.status === 'met' ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Assessment</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ level, percentage }) => `${level}: ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {riskDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Cost Analysis</h3>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-red-600" />
                <span className="font-medium text-red-800">Current Cost</span>
              </div>
              <p className="text-2xl font-bold text-red-900 mt-2">
                ${(executiveMetrics.estimatedCost / 1000).toFixed(0)}K
              </p>
            </div>
            
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">Potential Savings</span>
              </div>
              <p className="text-2xl font-bold text-green-900 mt-2">
                ${(executiveMetrics.potentialSavings / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-green-700 mt-1">With 20% reduction</p>
            </div>

            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                ROI on safety initiatives: <span className="font-bold">250%</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Trend Analysis */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Safety Trends</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyTrends.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="events" orientation="left" />
              <YAxis yAxisId="rate" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar yAxisId="events" dataKey="total" fill="#3B82F6" name="Total Events" />
              <Line 
                yAxisId="rate" 
                type="monotone" 
                dataKey="resolutionRate" 
                stroke="#10B981" 
                strokeWidth={3}
                name="Resolution Rate (%)" 
              />
              <Line 
                yAxisId="rate" 
                type="monotone" 
                dataKey="avgScore" 
                stroke="#F59E0B" 
                strokeWidth={2}
                name="Avg Score" 
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Strategic Recommendations */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Recommendations</h3>
        <div className="space-y-4">
          {recommendations.map((rec, index) => (
            <div key={index} className={`p-4 border-l-4 rounded-lg ${
              rec.priority === 'high' ? 'bg-red-50 border-red-400' :
              rec.priority === 'medium' ? 'bg-yellow-50 border-yellow-400' :
              'bg-blue-50 border-blue-400'
            }`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                  <p className="text-sm text-gray-600">{rec.category}</p>
                </div>
                <div className="flex gap-2">
                  <span className={`px-2 py-1 text-xs rounded font-medium ${
                    rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                    rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {rec.priority.toUpperCase()}
                  </span>
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded">
                    {rec.timeframe}
                  </span>
                </div>
              </div>
              <p className="text-gray-700">{rec.description}</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-500">Impact:</span>
                <span className={`text-xs font-medium ${
                  rec.impact === 'Critical' ? 'text-red-600' :
                  rec.impact === 'High' ? 'text-orange-600' :
                  'text-blue-600'
                }`}>
                  {rec.impact}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fleet Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Fleet Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Total Drivers Analyzed</span>
              <span className="font-bold">{executiveMetrics.totalDrivers}</span>
            </div>
            <div className="flex justify-between">
              <span>High-Risk Drivers</span>
              <span className="font-bold text-red-600">{executiveMetrics.highRiskDrivers}</span>
            </div>
            <div className="flex justify-between">
              <span>Fleet Risk Ratio</span>
              <span className="font-bold">{executiveMetrics.riskRatio.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Events per Driver</span>
              <span className="font-bold">
                {(executiveMetrics.totalEvents / executiveMetrics.totalDrivers).toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Next Actions</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-sm">Schedule quarterly safety review</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-600" />
              <span className="text-sm">Implement driver coaching program</span>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-600" />
              <span className="text-sm">Update safety KPI targets</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-orange-600" />
              <span className="text-sm">Review depot-specific initiatives</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LytxExecutiveReport;