/**
 * Driver Profile Modal
 * Comprehensive driver analytics modal with multi-tab interface
 * Integrates MtData trips, LYTX safety events, and Guardian distraction/fatigue monitoring
 */

import React, { useState, useMemo } from 'react';
import { 
  X, User, BarChart3, Car, Shield, TrendingUp, 
  MapPin, Clock, Award, AlertTriangle, FileText,
  Calendar, Activity, Target, CheckCircle
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Area, AreaChart
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import DriverProfileService, { type UnifiedDriverProfile } from '@/services/driverProfileService';

interface DriverProfileModalProps {
  driverId: string;
  driverName: string;
  isOpen: boolean;
  onClose: () => void;
  timeframe?: '30d' | '90d' | '1y';
}

type TabId = 'overview' | 'trips' | 'safety' | 'guardian' | 'performance';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];
const RISK_COLORS = {
  'Low': '#10B981',
  'Medium': '#F59E0B', 
  'High': '#EF4444',
  'Critical': '#DC2626'
};

export const DriverProfileModal: React.FC<DriverProfileModalProps> = ({
  driverId,
  driverName,
  isOpen,
  onClose,
  timeframe = '30d'
}) => {
  const [selectedTab, setSelectedTab] = useState<TabId>('overview');
  const [currentTimeframe, setCurrentTimeframe] = useState(timeframe);

  // Fetch comprehensive driver profile
  const { 
    data: driverProfile, 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ['driverProfile', driverId, currentTimeframe],
    queryFn: () => DriverProfileService.getDriverProfile(driverId, currentTimeframe),
    enabled: isOpen && !!driverId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleExportReport = async () => {
    if (!driverProfile) return;
    
    try {
      const report = {
        driver: driverProfile.summary,
        analytics: {
          trips: driverProfile.trip_analytics,
          safety: driverProfile.safety_analytics,
          performance: driverProfile.performance_comparison
        },
        generated: new Date().toISOString(),
        timeframe: currentTimeframe
      };
      
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `driver_profile_${driverName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{driverName}</h2>
              {driverProfile && (
                <p className="text-sm text-gray-600">
                  {driverProfile.summary.fleet} • {driverProfile.summary.depot} • 
                  Safety Score: {driverProfile.summary.overall_safety_score}/100
                </p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Timeframe Selector */}
            <select
              value={currentTimeframe}
              onChange={(e) => setCurrentTimeframe(e.target.value as any)}
              className="px-3 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
            </select>
            
            <button
              onClick={handleExportReport}
              disabled={!driverProfile}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
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
            <p className="text-gray-600">Loading driver profile...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Profile</h3>
            <p className="text-gray-600">Unable to load driver data. Please try again.</p>
          </div>
        )}

        {/* Content */}
        {!isLoading && !error && driverProfile && (
          <>
            {/* Key Metrics Bar */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                  <p className="text-lg font-bold text-blue-600">{driverProfile.summary.total_trips_30d}</p>
                  <p className="text-xs text-gray-600">Trips</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                  <p className="text-lg font-bold text-green-600">{Math.round(driverProfile.summary.total_km_30d)}</p>
                  <p className="text-xs text-gray-600">KM</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                  <p className="text-lg font-bold text-orange-600">{driverProfile.summary.overall_safety_score}</p>
                  <p className="text-xs text-gray-600">Safety Score</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                  <p className="text-lg font-bold text-red-600">{driverProfile.summary.high_risk_events_30d}</p>
                  <p className="text-xs text-gray-600">High Risk</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                  <p className="text-lg font-bold text-purple-600">{driverProfile.summary.lytx_events_30d}</p>
                  <p className="text-xs text-gray-600">LYTX Events</p>
                </div>
                <div className="text-center p-3 bg-white rounded-lg shadow-sm">
                  <p className="text-lg font-bold text-indigo-600">{driverProfile.summary.guardian_events_30d}</p>
                  <p className="text-xs text-gray-600">Guardian Events</p>
                </div>
              </div>

              {/* Risk Level Badge */}
              <div className="mt-4 flex items-center justify-center">
                <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                  driverProfile.summary.guardian_risk_level === 'Critical' ? 'bg-red-100 text-red-800' :
                  driverProfile.summary.guardian_risk_level === 'High' ? 'bg-orange-100 text-orange-800' :
                  driverProfile.summary.guardian_risk_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  Risk Level: {driverProfile.summary.guardian_risk_level}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                {[
                  { id: 'overview', name: 'Overview', icon: BarChart3 },
                  { id: 'trips', name: 'Trip Analytics', icon: Car },
                  { id: 'safety', name: 'LYTX Safety', icon: Shield },
                  { id: 'guardian', name: 'Guardian Events', icon: Activity },
                  { id: 'performance', name: 'Performance', icon: Target }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedTab(tab.id as TabId)}
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
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {selectedTab === 'overview' && (
                <OverviewTab driverProfile={driverProfile} />
              )}
              
              {selectedTab === 'trips' && (
                <TripAnalyticsTab driverProfile={driverProfile} />
              )}
              
              {selectedTab === 'safety' && (
                <SafetyEventsTab driverProfile={driverProfile} />
              )}
              
              {selectedTab === 'guardian' && (
                <GuardianEventsTab driverProfile={driverProfile} />
              )}
              
              {selectedTab === 'performance' && (
                <PerformanceTab driverProfile={driverProfile} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Tab Components
const OverviewTab: React.FC<{ driverProfile: UnifiedDriverProfile }> = ({ driverProfile }) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* Driver Summary */}
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Driver Information</h3>
      <div className="bg-gray-50 p-4 rounded-lg space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Employee ID:</span>
          <span className="text-sm font-medium">{driverProfile.summary.employee_id || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Fleet:</span>
          <span className="text-sm font-medium">{driverProfile.summary.fleet}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Depot:</span>
          <span className="text-sm font-medium">{driverProfile.summary.depot || 'N/A'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Status:</span>
          <span className={`text-sm font-medium ${
            driverProfile.summary.status === 'Active' ? 'text-green-600' : 'text-red-600'
          }`}>
            {driverProfile.summary.status}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Last Activity:</span>
          <span className="text-sm font-medium">
            {driverProfile.summary.last_activity_date 
              ? new Date(driverProfile.summary.last_activity_date).toLocaleDateString()
              : 'N/A'
            }
          </span>
        </div>
      </div>
    </div>

    {/* Quick Stats */}
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Quick Statistics</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">{driverProfile.performance_comparison.fleet_rank}</p>
          <p className="text-xs text-gray-600">Fleet Rank</p>
        </div>
        <div className="bg-green-50 p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">{driverProfile.performance_comparison.fleet_percentile}%</p>
          <p className="text-xs text-gray-600">Percentile</p>
        </div>
        <div className="bg-orange-50 p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-orange-600">{driverProfile.summary.active_days_30d}</p>
          <p className="text-xs text-gray-600">Active Days</p>
        </div>
        <div className="bg-purple-50 p-3 rounded-lg text-center">
          <p className="text-2xl font-bold text-purple-600">{driverProfile.trip_analytics.vehicles_driven}</p>
          <p className="text-xs text-gray-600">Vehicles Used</p>
        </div>
      </div>
    </div>

    {/* Safety Trends */}
    <div className="lg:col-span-2">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Safety Trend Analysis</h3>
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          {driverProfile.safety_analytics.risk_trend === 'Improving' ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : driverProfile.safety_analytics.risk_trend === 'Deteriorating' ? (
            <AlertTriangle className="h-5 w-5 text-red-500" />
          ) : (
            <Clock className="h-5 w-5 text-yellow-500" />
          )}
          <span className={`font-medium ${
            driverProfile.safety_analytics.risk_trend === 'Improving' ? 'text-green-600' :
            driverProfile.safety_analytics.risk_trend === 'Deteriorating' ? 'text-red-600' :
            'text-yellow-600'
          }`}>
            {driverProfile.safety_analytics.risk_trend}
          </span>
        </div>
        
        {driverProfile.safety_analytics.coaching_recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Coaching Recommendations:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {driverProfile.safety_analytics.coaching_recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-blue-500">•</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  </div>
);

const TripAnalyticsTab: React.FC<{ driverProfile: UnifiedDriverProfile }> = ({ driverProfile }) => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Trip Statistics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Trip Statistics</h3>
        <div className="space-y-3">
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">Total Trips:</span>
            <span className="font-medium">{driverProfile.trip_analytics.total_trips}</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">Total Distance:</span>
            <span className="font-medium">{Math.round(driverProfile.trip_analytics.total_km)} km</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">Avg Trip Distance:</span>
            <span className="font-medium">{Math.round(driverProfile.trip_analytics.avg_trip_distance)} km</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">Avg Trip Duration:</span>
            <span className="font-medium">{Math.round(driverProfile.trip_analytics.avg_trip_duration)} min</span>
          </div>
        </div>
      </div>

      {/* Vehicle Usage */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Usage</h3>
        <div className="space-y-3">
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">Vehicles Driven:</span>
            <span className="font-medium">{driverProfile.trip_analytics.vehicles_driven}</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">Primary Vehicle:</span>
            <span className="font-medium">{driverProfile.trip_analytics.primary_vehicle || 'N/A'}</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">Depot Coverage:</span>
            <span className="font-medium">{driverProfile.trip_analytics.depot_coverage.length} depots</span>
          </div>
        </div>
      </div>
    </div>

    {/* Monthly Trends Chart */}
    {driverProfile.trip_analytics.monthly_trends.length > 0 && (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trip Trends</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={driverProfile.trip_analytics.monthly_trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="trips" orientation="left" />
              <YAxis yAxisId="km" orientation="right" />
              <Tooltip />
              <Bar yAxisId="trips" dataKey="trips" fill="#3B82F6" name="Trips" />
              <Line yAxisId="km" type="monotone" dataKey="km" stroke="#10B981" strokeWidth={2} name="KM" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}
  </div>
);

const SafetyEventsTab: React.FC<{ driverProfile: UnifiedDriverProfile }> = ({ driverProfile }) => (
  <div className="space-y-6">
    {/* LYTX Summary */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="text-center p-4 bg-blue-50 rounded-lg">
        <p className="text-2xl font-bold text-blue-600">{driverProfile.safety_analytics.lytx_total_events}</p>
        <p className="text-sm text-gray-600">Total Events</p>
      </div>
      <div className="text-center p-4 bg-green-50 rounded-lg">
        <p className="text-2xl font-bold text-green-600">{driverProfile.safety_analytics.lytx_resolution_rate}%</p>
        <p className="text-sm text-gray-600">Resolution Rate</p>
      </div>
      <div className="text-center p-4 bg-orange-50 rounded-lg">
        <p className="text-2xl font-bold text-orange-600">{driverProfile.safety_analytics.lytx_coaching_history.length}</p>
        <p className="text-sm text-gray-600">Coaching Sessions</p>
      </div>
    </div>

    {/* Events by Trigger */}
    {driverProfile.safety_analytics.lytx_events_by_trigger.length > 0 && (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Events by Trigger Type</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={driverProfile.safety_analytics.lytx_events_by_trigger}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="trigger" angle={-45} textAnchor="end" height={80} fontSize={12} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6366F1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}

    {/* Coaching History */}
    {driverProfile.safety_analytics.lytx_coaching_history.length > 0 && (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Coaching Sessions</h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {driverProfile.safety_analytics.lytx_coaching_history.slice(0, 10).map((session, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
              <div>
                <span className="font-medium">{session.trigger}</span>
                <span className="text-gray-500 ml-2">by {session.coach}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-600">{new Date(session.date).toLocaleDateString()}</span>
                <span className={`px-2 py-1 rounded text-xs ${
                  session.status === 'Resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {session.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

const GuardianEventsTab: React.FC<{ driverProfile: UnifiedDriverProfile }> = ({ driverProfile }) => (
  <div className="space-y-6">
    {/* Guardian Summary */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="text-center p-4 bg-purple-50 rounded-lg">
        <p className="text-2xl font-bold text-purple-600">{driverProfile.safety_analytics.guardian_total_events}</p>
        <p className="text-sm text-gray-600">Total Events</p>
      </div>
      <div className="text-center p-4 bg-green-50 rounded-lg">
        <p className="text-2xl font-bold text-green-600">{driverProfile.safety_analytics.guardian_confirmation_rate}%</p>
        <p className="text-sm text-gray-600">Confirmation Rate</p>
      </div>
      <div className="text-center p-4 bg-orange-50 rounded-lg">
        <p className="text-2xl font-bold text-orange-600">
          {driverProfile.safety_analytics.guardian_events_by_type.reduce((acc, type) => 
            acc + Object.values(type.severity_breakdown).reduce((sum, val) => sum + val, 0), 0
          )}
        </p>
        <p className="text-sm text-gray-600">High Risk Events</p>
      </div>
    </div>

    {/* Events by Type */}
    {driverProfile.safety_analytics.guardian_events_by_type.length > 0 && (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Events by Type</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {driverProfile.safety_analytics.guardian_events_by_type.map((eventType, index) => (
            <div key={index} className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">{eventType.type}</h4>
              <p className="text-2xl font-bold text-indigo-600 mb-2">{eventType.count}</p>
              <div className="space-y-1 text-sm">
                {Object.entries(eventType.severity_breakdown).map(([severity, count]) => (
                  <div key={severity} className="flex justify-between">
                    <span className="text-gray-600">{severity}:</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Severity Trends */}
    {driverProfile.safety_analytics.guardian_severity_trends.length > 0 && (
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Severity Trends Over Time</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={driverProfile.safety_analytics.guardian_severity_trends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area stackId="1" dataKey="critical" stroke="#DC2626" fill="#DC2626" />
              <Area stackId="1" dataKey="high" stroke="#EF4444" fill="#EF4444" />
              <Area stackId="1" dataKey="medium" stroke="#F59E0B" fill="#F59E0B" />
              <Area stackId="1" dataKey="low" stroke="#10B981" fill="#10B981" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    )}
  </div>
);

const PerformanceTab: React.FC<{ driverProfile: UnifiedDriverProfile }> = ({ driverProfile }) => (
  <div className="space-y-6">
    {/* Performance Comparison */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Fleet Comparison</h3>
        <div className="space-y-3">
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">Fleet Rank:</span>
            <span className="font-medium">#{driverProfile.performance_comparison.fleet_rank}</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">Percentile:</span>
            <span className="font-medium">{driverProfile.performance_comparison.fleet_percentile}%</span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">Safety vs Fleet:</span>
            <span className={`font-medium ${
              driverProfile.performance_comparison.peer_comparison.safety_score_vs_fleet > 0 
                ? 'text-green-600' : 'text-red-600'
            }`}>
              {driverProfile.performance_comparison.peer_comparison.safety_score_vs_fleet > 0 ? '+' : ''}
              {driverProfile.performance_comparison.peer_comparison.safety_score_vs_fleet}%
            </span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity vs Fleet</h3>
        <div className="space-y-3">
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">Trips vs Fleet:</span>
            <span className={`font-medium ${
              driverProfile.performance_comparison.peer_comparison.trips_vs_fleet > 0 
                ? 'text-green-600' : 'text-red-600'
            }`}>
              {driverProfile.performance_comparison.peer_comparison.trips_vs_fleet > 0 ? '+' : ''}
              {driverProfile.performance_comparison.peer_comparison.trips_vs_fleet}%
            </span>
          </div>
          <div className="flex justify-between p-3 bg-gray-50 rounded">
            <span className="text-gray-600">KM vs Fleet:</span>
            <span className={`font-medium ${
              driverProfile.performance_comparison.peer_comparison.km_vs_fleet > 0 
                ? 'text-green-600' : 'text-red-600'
            }`}>
              {driverProfile.performance_comparison.peer_comparison.km_vs_fleet > 0 ? '+' : ''}
              {driverProfile.performance_comparison.peer_comparison.km_vs_fleet}%
            </span>
          </div>
        </div>
      </div>
    </div>

    {/* Strengths and Improvement Areas */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Strengths */}
      {driverProfile.performance_comparison.strengths.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-green-700 mb-4">Strengths</h3>
          <div className="space-y-2">
            {driverProfile.performance_comparison.strengths.map((strength, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-800">{strength}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement Areas */}
      {driverProfile.performance_comparison.improvement_areas.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-orange-700 mb-4">Improvement Areas</h3>
          <div className="space-y-2">
            {driverProfile.performance_comparison.improvement_areas.map((area, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-orange-50 rounded-lg">
                <Target className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-orange-800">{area}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  </div>
);

export default DriverProfileModal;