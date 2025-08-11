/**
 * LYTX Driver Detail Modal
 * Comprehensive individual driver performance analysis and coaching insights
 * Provides detailed analytics for driver-specific safety events and trends
 */

import React, { useState, useMemo } from 'react';
import { 
  X, User, Calendar, MapPin, TrendingUp, TrendingDown, 
  AlertTriangle, Target, Award, Clock, Car, FileText,
  BarChart3, PieChart, Activity, CheckCircle
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, PieChart as RechartsPie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  useLytxHistoricalEvents,
  type LytxAnalyticsFilters,
  type LytxHistoricalEvent
} from '@/hooks/useLytxHistoricalData';
import { LytxAnalyticsService } from '@/services/lytxAnalyticsService';

interface LytxDriverDetailModalProps {
  driverName: string;
  isOpen: boolean;
  onClose: () => void;
  baseFilters?: LytxAnalyticsFilters;
}

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];
const STATUS_COLORS = {
  'New': '#EF4444',
  'Face-To-Face': '#F59E0B', 
  'FYI Notify': '#3B82F6',
  'Resolved': '#10B981'
};

export const LytxDriverDetailModal: React.FC<LytxDriverDetailModalProps> = ({
  driverName,
  isOpen,
  onClose,
  baseFilters = {}
}) => {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'timeline' | 'coaching'>('overview');

  // Fetch driver-specific events
  const driverFilters: LytxAnalyticsFilters = {
    ...baseFilters,
    driverAssigned: 'Assigned'
  };

  const { data: allEvents, isLoading } = useLytxHistoricalEvents(driverFilters);
  
  // Filter events for specific driver
  const driverEvents = useMemo(() => {
    return allEvents?.filter(event => event.driver_name === driverName) || [];
  }, [allEvents, driverName]);

  // Calculate driver analytics
  const analytics = useMemo(() => {
    if (!driverEvents.length) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const recent30 = driverEvents.filter(e => new Date(e.event_datetime) >= thirtyDaysAgo);
    const recent90 = driverEvents.filter(e => new Date(e.event_datetime) >= ninetyDaysAgo);

    // Status distribution
    const statusDistribution = {
      'New': driverEvents.filter(e => e.status === 'New').length,
      'Face-To-Face': driverEvents.filter(e => e.status === 'Face-To-Face').length,
      'FYI Notify': driverEvents.filter(e => e.status === 'FYI Notify').length,
      'Resolved': driverEvents.filter(e => e.status === 'Resolved').length,
    };

    // Trigger analysis
    const triggerCounts: Record<string, number> = {};
    driverEvents.forEach(event => {
      triggerCounts[event.trigger] = (triggerCounts[event.trigger] || 0) + 1;
    });
    const topTriggers = Object.entries(triggerCounts)
      .map(([trigger, count]) => ({ trigger, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Monthly trends (last 12 months)
    const monthlyTrends: Record<string, { month: string; count: number; avgScore: number; totalScore: number }> = {};
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    
    driverEvents
      .filter(e => new Date(e.event_datetime) >= twelveMonthsAgo)
      .forEach(event => {
        const date = new Date(event.event_datetime);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        
        if (!monthlyTrends[monthKey]) {
          monthlyTrends[monthKey] = { month: monthName, count: 0, avgScore: 0, totalScore: 0 };
        }
        
        monthlyTrends[monthKey].count++;
        monthlyTrends[monthKey].totalScore += event.score;
      });

    // Calculate averages
    Object.values(monthlyTrends).forEach(trend => {
      trend.avgScore = trend.count > 0 ? Math.round((trend.totalScore / trend.count) * 10) / 10 : 0;
    });

    // Score analysis
    const scores = driverEvents.map(e => e.score);
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const highRiskEvents = driverEvents.filter(e => e.score >= 7).length;
    const mediumRiskEvents = driverEvents.filter(e => e.score >= 4 && e.score < 7).length;
    const lowRiskEvents = driverEvents.filter(e => e.score < 4).length;

    // Performance trends
    const trend30vs90 = recent90.length > 0 ? ((recent30.length - (recent90.length - recent30.length)) / (recent90.length - recent30.length)) * 100 : 0;

    return {
      totalEvents: driverEvents.length,
      recent30: recent30.length,
      recent90: recent90.length,
      avgScore: Math.round(avgScore * 10) / 10,
      resolutionRate: Math.round((statusDistribution.Resolved / driverEvents.length) * 100),
      statusDistribution,
      topTriggers,
      monthlyTrends: Object.values(monthlyTrends).sort((a, b) => a.month.localeCompare(b.month)),
      riskDistribution: [
        { name: 'Low Risk (0-3)', value: lowRiskEvents, color: '#10B981' },
        { name: 'Medium Risk (4-6)', value: mediumRiskEvents, color: '#F59E0B' },
        { name: 'High Risk (7+)', value: highRiskEvents, color: '#EF4444' }
      ].filter(r => r.value > 0),
      trend30vs90,
      carrier: driverEvents[0]?.carrier || 'Unknown',
      latestEvent: driverEvents.sort((a, b) => new Date(b.event_datetime).getTime() - new Date(a.event_datetime).getTime())[0],
      coachingOpportunities: highRiskEvents + (statusDistribution.New || 0)
    };
  }, [driverEvents]);

  const handleExportDriverReport = async () => {
    if (!analytics) return;
    
    try {
      const report = await LytxAnalyticsService.analyzeDriverPerformance(driverName, baseFilters);
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `driver_report_${driverName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{driverName}</h2>
              <p className="text-sm text-gray-600">
                {analytics?.carrier} • {analytics?.totalEvents} total events
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportDriverReport}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
            >
              Export Report
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading driver analytics...</p>
          </div>
        )}

        {/* Content */}
        {!isLoading && analytics && (
          <>
            {/* Key Metrics */}
            <div className="p-6 border-b border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{analytics.totalEvents}</p>
                  <p className="text-sm text-gray-600">Total Events</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-2xl font-bold text-orange-600">{analytics.avgScore}</p>
                  <p className="text-sm text-gray-600">Avg Score</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{analytics.resolutionRate}%</p>
                  <p className="text-sm text-gray-600">Resolution Rate</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{analytics.coachingOpportunities}</p>
                  <p className="text-sm text-gray-600">Coaching Opps</p>
                </div>
              </div>

              {/* Trend Indicator */}
              <div className="mt-4 flex items-center justify-center gap-2">
                {analytics.trend30vs90 > 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600">
                      {Math.abs(analytics.trend30vs90).toFixed(1)}% increase in recent activity
                    </span>
                  </>
                ) : analytics.trend30vs90 < 0 ? (
                  <>
                    <TrendingDown className="h-4 w-4 text-green-500" />
                    <span className="text-sm text-green-600">
                      {Math.abs(analytics.trend30vs90).toFixed(1)}% decrease in recent activity
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-gray-600">Stable activity levels</span>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                {[
                  { id: 'overview', name: 'Overview', icon: BarChart3 },
                  { id: 'timeline', name: 'Timeline', icon: Calendar },
                  { id: 'coaching', name: 'Coaching Insights', icon: Target }
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

            {/* Tab Content */}
            <div className="p-6 max-h-96 overflow-y-auto">
              {selectedTab === 'overview' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Status Distribution */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie cx="50%" cy="50%" outerRadius={80} dataKey="value">
                          {Object.entries(analytics.statusDistribution).map(([status, count], index) => (
                            <Cell key={status} fill={STATUS_COLORS[status as keyof typeof STATUS_COLORS]} />
                          ))}
                        </RechartsPie>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(analytics.statusDistribution).map(([status, count]) => (
                        <div key={status} className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: STATUS_COLORS[status as keyof typeof STATUS_COLORS] }}
                          />
                          <span>{status}: {count}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Risk Distribution */}
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Risk Distribution</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie cx="50%" cy="50%" outerRadius={80} dataKey="value">
                          {analytics.riskDistribution.map((entry, index) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </RechartsPie>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      {analytics.riskDistribution.map((item) => (
                        <div key={item.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: item.color }}
                            />
                            <span>{item.name}</span>
                          </div>
                          <span className="font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top Triggers */}
                  <div className="lg:col-span-2">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Most Common Triggers</h4>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.topTriggers}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="trigger" 
                            angle={-45}
                            textAnchor="end"
                            height={80}
                            fontSize={12}
                          />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#6366F1" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {selectedTab === 'timeline' && (
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Monthly Event Trends</h4>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.monthlyTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="count" orientation="left" />
                        <YAxis yAxisId="score" orientation="right" />
                        <Tooltip />
                        <Bar yAxisId="count" dataKey="count" fill="#6366F1" name="Event Count" />
                        <Line 
                          yAxisId="score" 
                          type="monotone" 
                          dataKey="avgScore" 
                          stroke="#F59E0B" 
                          strokeWidth={3} 
                          name="Avg Score" 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Recent Events */}
                  <div className="mt-6">
                    <h5 className="font-medium text-gray-900 mb-3">Recent Events (Last 30 Days)</h5>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {driverEvents
                        .filter(e => new Date(e.event_datetime) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
                        .sort((a, b) => new Date(b.event_datetime).getTime() - new Date(a.event_datetime).getTime())
                        .slice(0, 10)
                        .map((event) => (
                          <div key={event.event_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                            <div>
                              <span className="font-medium">{event.trigger}</span>
                              <span className="text-gray-500 ml-2">
                                {new Date(event.event_datetime).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className={`font-bold ${
                                event.score >= 7 ? 'text-red-600' : 
                                event.score >= 4 ? 'text-yellow-600' : 'text-green-600'
                              }`}>
                                {event.score}
                              </span>
                              <span className={`px-2 py-1 rounded text-xs ${
                                event.status === 'Resolved' ? 'bg-green-100 text-green-800' :
                                event.status === 'Face-To-Face' ? 'bg-yellow-100 text-yellow-800' :
                                event.status === 'FYI Notify' ? 'bg-blue-100 text-blue-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {event.status}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedTab === 'coaching' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Coaching Recommendations</h4>
                    <div className="space-y-4">
                      {analytics.riskDistribution.find(r => r.name.includes('High Risk'))?.value > 0 && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                            <span className="font-medium text-red-800">High Priority</span>
                          </div>
                          <p className="text-sm text-red-700">
                            {analytics.riskDistribution.find(r => r.name.includes('High Risk'))?.value} high-risk events require immediate attention. 
                            Focus on {analytics.topTriggers[0]?.trigger} which is the most common trigger.
                          </p>
                        </div>
                      )}

                      {analytics.statusDistribution.New > 0 && (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-5 w-5 text-yellow-600" />
                            <span className="font-medium text-yellow-800">Action Required</span>
                          </div>
                          <p className="text-sm text-yellow-700">
                            {analytics.statusDistribution.New} events are unresolved and need follow-up action.
                          </p>
                        </div>
                      )}

                      {analytics.resolutionRate < 70 && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Target className="h-5 w-5 text-blue-600" />
                            <span className="font-medium text-blue-800">Improvement Opportunity</span>
                          </div>
                          <p className="text-sm text-blue-700">
                            Resolution rate of {analytics.resolutionRate}% is below target. Consider implementing a structured coaching program.
                          </p>
                        </div>
                      )}

                      {analytics.resolutionRate >= 85 && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Award className="h-5 w-5 text-green-600" />
                            <span className="font-medium text-green-800">Excellent Performance</span>
                          </div>
                          <p className="text-sm text-green-700">
                            Outstanding resolution rate of {analytics.resolutionRate}%. This driver shows strong safety commitment.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coaching History */}
                  <div>
                    <h5 className="font-medium text-gray-900 mb-3">Coaching History</h5>
                    <div className="space-y-2">
                      {driverEvents
                        .filter(e => e.status === 'Face-To-Face' && e.reviewed_by)
                        .sort((a, b) => new Date(b.event_datetime).getTime() - new Date(a.event_datetime).getTime())
                        .slice(0, 5)
                        .map((event) => (
                          <div key={event.event_id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg text-sm">
                            <div>
                              <span className="font-medium">{event.trigger}</span>
                              <span className="text-gray-500 ml-2">
                                coached by {event.reviewed_by}
                              </span>
                            </div>
                            <span className="text-green-600 text-xs">
                              {new Date(event.event_datetime).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      
                      {driverEvents.filter(e => e.status === 'Face-To-Face').length === 0 && (
                        <p className="text-gray-500 text-sm italic">No coaching sessions recorded yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* No Data State */}
        {!isLoading && (!analytics || analytics.totalEvents === 0) && (
          <div className="p-8 text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
            <p className="text-gray-600">No safety events found for {driverName} with the current filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LytxDriverDetailModal;