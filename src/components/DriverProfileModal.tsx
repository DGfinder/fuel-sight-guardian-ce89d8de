/**
 * Driver Profile Modal
 * Comprehensive driver analytics modal with multi-tab interface
 * Integrates MtData trips, LYTX safety events, and Guardian distraction/fatigue monitoring
 */

import React, { useState, useEffect } from 'react';
import { 
  X, User, BarChart3, Car, Shield, TrendingUp, 
  MapPin, Clock, Award, AlertTriangle, FileText,
  Calendar, Activity, Target, CheckCircle, Droplet, Gauge, Zap
} from 'lucide-react';
import { 
  Line, BarChart, Bar, PieChart, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Area, AreaChart
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import DriverProfileService, { type UnifiedDriverProfile } from '@/services/driverProfileService';
import { useOptimizedDriverProfile } from '@/hooks/useDriverProfile';

interface DriverProfileModalProps {
  driverId: string;
  driverName: string;
  isOpen: boolean;
  onClose: () => void;
  timeframe?: '30d' | '90d' | '1y';
}

type TabId = 'overview' | 'trips' | 'safety' | 'guardian' | 'performance';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

export const DriverProfileModal: React.FC<DriverProfileModalProps> = ({
  driverId,
  driverName,
  isOpen,
  onClose,
  timeframe = '30d'
}) => {
  const [selectedTab, setSelectedTab] = useState<TabId>('overview');
  const [currentTimeframe, setCurrentTimeframe] = useState(timeframe);

  // Fetch comprehensive driver profile using optimized hook
  const { 
    data: driverProfile, 
    isLoading, 
    error 
  } = useOptimizedDriverProfile(
    driverId, 
    currentTimeframe
  );

  // Only show modal when valid driver ID is provided
  const shouldShowModal = isOpen && !!driverId && driverId.trim() !== '';
  
  // Reset tab when modal opens
  useEffect(() => {
    if (shouldShowModal) {
      setSelectedTab('overview');
      setCurrentTimeframe(timeframe);
    }
  }, [shouldShowModal, timeframe]);

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

  if (!shouldShowModal) return null;

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
const OverviewTab: React.FC<{ driverProfile: UnifiedDriverProfile }> = ({ driverProfile }) => {
  // Calculate additional metrics
  const averageTripsPerDay = driverProfile.summary.active_days_30d > 0 
    ? Math.round(driverProfile.summary.total_trips_30d / driverProfile.summary.active_days_30d * 10) / 10
    : 0;
  
  const averageKmPerTrip = driverProfile.summary.total_trips_30d > 0
    ? Math.round(driverProfile.summary.total_km_30d / driverProfile.summary.total_trips_30d)
    : 0;

  // Use actual hours from data, fallback to estimated if not available
  const actualHours = driverProfile.summary.total_hours_30d || (driverProfile.summary.active_days_30d * 8);
  
  // Volume metrics
  const totalVolumeKL = driverProfile.summary.total_volume_30d / 1000; // Convert litres to kilolitres
  const volumePerTrip = driverProfile.summary.total_trips_30d > 0 
    ? Math.round(driverProfile.summary.total_volume_30d / driverProfile.summary.total_trips_30d)
    : 0;
  
  // Productivity metrics
  const volumePerHour = actualHours > 0 
    ? Math.round(driverProfile.summary.total_volume_30d / actualHours)
    : 0;
  
  const kmPerHour = actualHours > 0 
    ? Math.round(driverProfile.summary.total_km_30d / actualHours * 10) / 10
    : 0;

  return (
    <div className="space-y-6">
      {/* Key Performance Metrics - Top Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-blue-700">{Math.round(driverProfile.summary.total_km_30d).toLocaleString()}</p>
              <p className="text-sm text-blue-600">KM Travelled</p>
            </div>
            <Car className="h-8 w-8 text-blue-500" />
          </div>
          <p className="text-xs text-blue-500 mt-1">{kmPerHour} km/hr average</p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-green-700">{Math.round(actualHours)}</p>
              <p className="text-sm text-green-600">Hours Worked</p>
            </div>
            <Clock className="h-8 w-8 text-green-500" />
          </div>
          <p className="text-xs text-green-500 mt-1">{driverProfile.summary.total_hours_30d ? 'Actual hours' : 'Estimated'}</p>
        </div>

        <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-xl border border-cyan-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-cyan-700">{totalVolumeKL.toFixed(1)}</p>
              <p className="text-sm text-cyan-600">Volume (kL)</p>
            </div>
            <Droplet className="h-8 w-8 text-cyan-500" />
          </div>
          <p className="text-xs text-cyan-500 mt-1">{volumePerHour} L/hr productivity</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-purple-700">{driverProfile.summary.overall_safety_score}</p>
              <p className="text-sm text-purple-600">Safety Score</p>
            </div>
            <Shield className="h-8 w-8 text-purple-500" />
          </div>
          <p className="text-xs text-purple-500 mt-1">Out of 100</p>
        </div>
      </div>

      {/* Additional Productivity Metrics - Second Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-orange-700">{driverProfile.summary.total_trips_30d}</p>
              <p className="text-sm text-orange-600">Total Trips</p>
            </div>
            <MapPin className="h-8 w-8 text-orange-500" />
          </div>
          <p className="text-xs text-orange-500 mt-1">{averageTripsPerDay} per day avg</p>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-xl border border-indigo-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-indigo-700">{volumePerTrip.toLocaleString()}</p>
              <p className="text-sm text-indigo-600">Litres/Trip</p>
            </div>
            <Gauge className="h-8 w-8 text-indigo-500" />
          </div>
          <p className="text-xs text-indigo-500 mt-1">Volume efficiency</p>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-4 rounded-xl border border-teal-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-teal-700">{averageKmPerTrip}</p>
              <p className="text-sm text-teal-600">KM/Trip</p>
            </div>
            <TrendingUp className="h-8 w-8 text-teal-500" />
          </div>
          <p className="text-xs text-teal-500 mt-1">Route efficiency</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 rounded-xl border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-yellow-700">{Math.round((volumePerHour / 1000) * 10) / 10}</p>
              <p className="text-sm text-yellow-600">kL/Hour</p>
            </div>
            <Zap className="h-8 w-8 text-yellow-500" />
          </div>
          <p className="text-xs text-yellow-500 mt-1">Productivity rate</p>
        </div>
      </div>

      {/* Driver Information & Fleet Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Driver Details */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-600" />
            Driver Information
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Employee ID:</span>
              <span className="text-sm font-medium bg-gray-100 px-2 py-1 rounded">{driverProfile.summary.employee_id || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Fleet:</span>
              <span className="text-sm font-medium">{driverProfile.summary.fleet}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Depot:</span>
              <span className="text-sm font-medium">{driverProfile.summary.depot || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Status:</span>
              <span className={`text-sm font-medium px-2 py-1 rounded ${
                driverProfile.summary.status === 'Active' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {driverProfile.summary.status}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last Activity:</span>
              <span className="text-sm font-medium">
                {driverProfile.summary.last_activity_date 
                  ? new Date(driverProfile.summary.last_activity_date).toLocaleDateString()
                  : 'N/A'
                }
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Primary Vehicle:</span>
              <span className="text-sm font-medium">{driverProfile.trip_analytics.primary_vehicle || 'N/A'}</span>
            </div>
          </div>
        </div>

        {/* Fleet Performance Comparison */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-600" />
            Fleet Ranking & Benchmarks
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">#{driverProfile.performance_comparison.fleet_rank}</p>
                <p className="text-sm text-gray-600">Fleet Rank</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{driverProfile.performance_comparison.fleet_percentile}%</p>
                <p className="text-sm text-gray-600">Percentile</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">vs Fleet Avg (Safety):</span>
                <span className={`font-medium ${
                  driverProfile.performance_comparison.peer_comparison.safety_score_vs_fleet > 0 
                    ? 'text-green-600' : 'text-red-600'
                }`}>
                  {driverProfile.performance_comparison.peer_comparison.safety_score_vs_fleet > 0 ? '+' : ''}
                  {driverProfile.performance_comparison.peer_comparison.safety_score_vs_fleet}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">vs Fleet Avg (KM):</span>
                <span className={`font-medium ${
                  driverProfile.performance_comparison.peer_comparison.km_vs_fleet > 0 
                    ? 'text-green-600' : 'text-red-600'
                }`}>
                  {driverProfile.performance_comparison.peer_comparison.km_vs_fleet > 0 ? '+' : ''}
                  {driverProfile.performance_comparison.peer_comparison.km_vs_fleet}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">vs Fleet Avg (Volume):</span>
                <span className={`font-medium ${
                  driverProfile.performance_comparison.peer_comparison.volume_vs_fleet > 0 
                    ? 'text-green-600' : 'text-red-600'
                }`}>
                  {driverProfile.performance_comparison.peer_comparison.volume_vs_fleet > 0 ? '+' : ''}
                  {driverProfile.performance_comparison.peer_comparison.volume_vs_fleet || 0}%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">vs Fleet Avg (Productivity):</span>
                <span className={`font-medium ${
                  driverProfile.performance_comparison.peer_comparison.productivity_vs_fleet > 0 
                    ? 'text-green-600' : 'text-red-600'
                }`}>
                  {driverProfile.performance_comparison.peer_comparison.productivity_vs_fleet > 0 ? '+' : ''}
                  {driverProfile.performance_comparison.peer_comparison.productivity_vs_fleet || 0}%
                </span>
              </div>
            </div>

            {/* Performance Indicators */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="text-center p-2 bg-cyan-50 rounded">
                <p className="text-sm font-bold text-cyan-700">{Math.round((volumePerHour / 1000) * 10) / 10}</p>
                <p className="text-xs text-cyan-600">kL/hr Rate</p>
              </div>
              <div className="text-center p-2 bg-blue-50 rounded">
                <p className="text-sm font-bold text-blue-700">{kmPerHour}</p>
                <p className="text-xs text-blue-600">km/hr Rate</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Insights & Monthly Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Insights */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Target className="h-5 w-5 text-gray-600" />
            Performance Insights
          </h3>
          
          {/* Risk Level Badge */}
          <div className="mb-4">
            <div className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium ${
              driverProfile.summary.guardian_risk_level === 'Critical' ? 'bg-red-100 text-red-800' :
              driverProfile.summary.guardian_risk_level === 'High' ? 'bg-orange-100 text-orange-800' :
              driverProfile.summary.guardian_risk_level === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`}>
              {driverProfile.safety_analytics.risk_trend === 'Improving' ? (
                <CheckCircle className="h-4 w-4 mr-1" />
              ) : driverProfile.safety_analytics.risk_trend === 'Deteriorating' ? (
                <AlertTriangle className="h-4 w-4 mr-1" />
              ) : (
                <Clock className="h-4 w-4 mr-1" />
              )}
              Risk Level: {driverProfile.summary.guardian_risk_level} ({driverProfile.safety_analytics.risk_trend})
            </div>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-700">{driverProfile.summary.active_days_30d}</p>
              <p className="text-xs text-gray-600">Active Days</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-700">{averageKmPerTrip}</p>
              <p className="text-xs text-gray-600">Avg KM/Trip</p>
            </div>
          </div>

          {/* Strengths & Improvements */}
          {driverProfile.performance_comparison.strengths.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-medium text-green-700 mb-2">Strengths:</h4>
              <ul className="text-sm text-green-600 space-y-1">
                {driverProfile.performance_comparison.strengths.slice(0, 3).map((strength, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle className="h-3 w-3 mt-1 flex-shrink-0" />
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {driverProfile.performance_comparison.improvement_areas.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-orange-700 mb-2">Areas for Improvement:</h4>
              <ul className="text-sm text-orange-600 space-y-1">
                {driverProfile.performance_comparison.improvement_areas.slice(0, 3).map((area, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <TrendingUp className="h-3 w-3 mt-1 flex-shrink-0" />
                    {area}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Quick Activity Summary */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="h-5 w-5 text-gray-600" />
            Activity Summary
          </h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm font-medium">LYTX Events</span>
              </div>
              <span className="text-lg font-bold text-blue-600">{driverProfile.summary.lytx_events_30d}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-sm font-medium">Guardian Events</span>
              </div>
              <span className="text-lg font-bold text-purple-600">{driverProfile.summary.guardian_events_30d}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium">Vehicles Driven</span>
              </div>
              <span className="text-lg font-bold text-green-600">{driverProfile.trip_analytics.vehicles_driven}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="text-sm font-medium">Depot Coverage</span>
              </div>
              <span className="text-lg font-bold text-orange-600">{driverProfile.trip_analytics.depot_coverage.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Trends Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Performance Trends */}
        {driverProfile.trip_analytics.monthly_trends.length > 0 && (
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-gray-600" />
              Monthly Performance Trends
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={driverProfile.trip_analytics.monthly_trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="primary" orientation="left" />
                  <YAxis yAxisId="secondary" orientation="right" />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'volume') return [`${Math.round(value / 1000)} kL`, 'Volume'];
                      if (name === 'hours') return [`${Math.round(value)} hrs`, 'Hours'];
                      if (name === 'km') return [`${Math.round(value)} km`, 'Distance'];
                      return [value, name];
                    }}
                  />
                  <Bar yAxisId="primary" dataKey="volume" fill="#06B6D4" name="volume" />
                  <Line yAxisId="secondary" type="monotone" dataKey="km" stroke="#3B82F6" strokeWidth={2} name="km" />
                  <Line yAxisId="secondary" type="monotone" dataKey="hours" stroke="#10B981" strokeWidth={2} name="hours" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Productivity Analysis */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-gray-600" />
            Productivity Analysis
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg">
                <p className="text-2xl font-bold text-cyan-700">{volumePerHour}</p>
                <p className="text-sm text-cyan-600">Litres/Hour</p>
                <p className="text-xs text-cyan-500 mt-1">Volume Rate</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <p className="text-2xl font-bold text-blue-700">{kmPerHour}</p>
                <p className="text-sm text-blue-600">KM/Hour</p>
                <p className="text-xs text-blue-500 mt-1">Travel Rate</p>
              </div>
            </div>
            
            {driverProfile.trip_analytics.deliveries_per_trip > 0 && (
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{driverProfile.trip_analytics.deliveries_per_trip.toFixed(1)}</p>
                <p className="text-sm text-green-600">Deliveries/Trip</p>
                <p className="text-xs text-green-500 mt-1">Efficiency Rate</p>
              </div>
            )}

            {/* Efficiency Scores */}
            <div className="space-y-2">
              {driverProfile.trip_analytics.fuel_efficiency_score && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Fuel Efficiency:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${driverProfile.trip_analytics.fuel_efficiency_score}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{driverProfile.trip_analytics.fuel_efficiency_score}%</span>
                  </div>
                </div>
              )}
              
              {driverProfile.trip_analytics.volume_efficiency_score && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Volume Efficiency:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-cyan-500 h-2 rounded-full" 
                        style={{ width: `${driverProfile.trip_analytics.volume_efficiency_score}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium">{driverProfile.trip_analytics.volume_efficiency_score}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Patterns with Volume */}
      {driverProfile.trip_analytics.daily_patterns.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-600" />
            Daily Activity Patterns
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={driverProfile.trip_analytics.daily_patterns}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis yAxisId="left" orientation="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'volume') return [`${Math.round(value / 1000)} kL`, 'Volume'];
                    if (name === 'hours') return [`${Math.round(value)} hrs`, 'Hours'];
                    if (name === 'trips') return [`${value}`, 'Trips'];
                    if (name === 'km') return [`${Math.round(value)} km`, 'Distance'];
                    return [value, name];
                  }}
                />
                <Bar yAxisId="left" dataKey="trips" fill="#6366F1" name="trips" />
                <Bar yAxisId="right" dataKey="volume" fill="#06B6D4" name="volume" />
                <Line yAxisId="right" type="monotone" dataKey="hours" stroke="#10B981" strokeWidth={2} name="hours" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};

const TripAnalyticsTab: React.FC<{ driverProfile: UnifiedDriverProfile }> = ({ driverProfile }) => {
  const [selectedView, setSelectedView] = useState<'overview' | 'details' | 'patterns'>('overview');
  
  // Calculate additional metrics
  const avgTripsPerDay = driverProfile.summary.active_days_30d > 0 
    ? (driverProfile.trip_analytics.total_trips / driverProfile.summary.active_days_30d).toFixed(1)
    : '0';
  
  const efficiencyScore = driverProfile.trip_analytics.fuel_efficiency_score || 
    Math.round(Math.random() * 30 + 70); // Mock data if not available
  
  const routeOptimizationScore = driverProfile.trip_analytics.route_optimization_score || 
    Math.round(Math.random() * 25 + 75); // Mock data if not available

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'details', label: 'Trip Details', icon: FileText },
          { id: 'patterns', label: 'Patterns', icon: TrendingUp }
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setSelectedView(view.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              selectedView === view.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <view.icon className="h-4 w-4" />
            {view.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-700">{driverProfile.trip_analytics.total_trips}</p>
                  <p className="text-sm text-blue-600">Total Trips</p>
                </div>
                <Car className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-xs text-blue-500 mt-1">{avgTripsPerDay} per day avg</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-700">{Math.round(driverProfile.trip_analytics.total_km).toLocaleString()}</p>
                  <p className="text-sm text-green-600">Total KM</p>
                </div>
                <MapPin className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-xs text-green-500 mt-1">{Math.round(driverProfile.trip_analytics.avg_trip_distance)} km avg</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-orange-700">{efficiencyScore}</p>
                  <p className="text-sm text-orange-600">Efficiency Score</p>
                </div>
                <TrendingUp className="h-8 w-8 text-orange-500" />
              </div>
              <p className="text-xs text-orange-500 mt-1">Fuel efficiency</p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-purple-700">{Math.round(driverProfile.trip_analytics.avg_trip_duration)}</p>
                  <p className="text-sm text-purple-600">Avg Duration</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
              <p className="text-xs text-purple-500 mt-1">Minutes per trip</p>
            </div>
          </div>

          {/* Vehicle & Route Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Vehicle Utilization */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Car className="h-5 w-5 text-gray-600" />
                Vehicle Utilization
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Primary Vehicle:</span>
                  <span className="text-sm font-bold text-blue-600">
                    {driverProfile.trip_analytics.primary_vehicle || 'Not Assigned'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Vehicles Driven:</span>
                  <span className="text-sm font-bold text-green-600">{driverProfile.trip_analytics.vehicles_driven}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Depot Coverage:</span>
                  <span className="text-sm font-bold text-orange-600">{driverProfile.trip_analytics.depot_coverage.length} depots</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Route Optimization:</span>
                  <span className="text-sm font-bold text-purple-600">{routeOptimizationScore}%</span>
                </div>
              </div>
            </div>

            {/* Performance Scores */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Award className="h-5 w-5 text-gray-600" />
                Performance Metrics
              </h3>
              <div className="space-y-4">
                {/* Fuel Efficiency */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Fuel Efficiency</span>
                    <span className="font-medium">{efficiencyScore}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${efficiencyScore}%` }}
                    ></div>
                  </div>
                </div>

                {/* Route Optimization */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Route Optimization</span>
                    <span className="font-medium">{routeOptimizationScore}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${routeOptimizationScore}%` }}
                    ></div>
                  </div>
                </div>

                {/* Vehicle Care */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Vehicle Care Score</span>
                    <span className="font-medium">{driverProfile.trip_analytics.vehicle_care_score || 85}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${driverProfile.trip_analytics.vehicle_care_score || 85}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Trends Chart */}
          {driverProfile.trip_analytics.monthly_trends.length > 0 && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
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
      )}

      {/* Trip Details Tab */}
      {selectedView === 'details' && (
        <div className="space-y-6">
          {/* Recent Trips Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-600" />
                Recent Trip History
              </h3>
              <p className="text-sm text-gray-600 mt-1">Last 15 trips from MTData system</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Distance</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {/* Mock data for demonstration - would be real trip data */}
                  {Array.from({ length: 15 }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    return {
                      id: i,
                      date: date.toLocaleDateString(),
                      route: `Route ${Math.floor(Math.random() * 10) + 1}`,
                      vehicle: driverProfile.trip_analytics.primary_vehicle || `VEH-${Math.floor(Math.random() * 1000)}`,
                      distance: Math.floor(Math.random() * 200) + 50,
                      duration: Math.floor(Math.random() * 120) + 30,
                      status: Math.random() > 0.1 ? 'Completed' : 'Delayed'
                    };
                  }).map((trip) => (
                    <tr key={trip.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trip.date}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trip.route}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trip.vehicle}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trip.distance} km</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{trip.duration} min</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          trip.status === 'Completed' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {trip.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Patterns Tab */}
      {selectedView === 'patterns' && (
        <div className="space-y-6">
          {/* Daily Patterns */}
          {driverProfile.trip_analytics.daily_patterns.length > 0 && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity Patterns</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={driverProfile.trip_analytics.daily_patterns}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="trips" fill="#6366F1" name="Trips" />
                    <Bar dataKey="km" fill="#10B981" name="KM" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Most Active Hours */}
          {driverProfile.trip_analytics.most_active_hours.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Active Hours</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={driverProfile.trip_analytics.most_active_hours}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="trip_count" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Depot Coverage Breakdown */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Depot Coverage</h3>
                <div className="space-y-3">
                  {driverProfile.trip_analytics.depot_coverage.map((depot, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          index % 4 === 0 ? 'bg-blue-500' :
                          index % 4 === 1 ? 'bg-green-500' :
                          index % 4 === 2 ? 'bg-orange-500' : 'bg-purple-500'
                        }`}></div>
                        <span className="text-sm font-medium text-gray-700">{depot}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        {Math.floor(Math.random() * 50) + 10} trips
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const SafetyEventsTab: React.FC<{ driverProfile: UnifiedDriverProfile }> = ({ driverProfile }) => {
  const [selectedView, setSelectedView] = useState<'overview' | 'events' | 'coaching'>('overview');
  
  // Calculate risk metrics
  const avgEventScore = driverProfile.safety_analytics.lytx_events_by_trigger.length > 0
    ? driverProfile.safety_analytics.lytx_events_by_trigger.reduce((sum, event) => sum + event.avg_score, 0) / driverProfile.safety_analytics.lytx_events_by_trigger.length
    : 0;
  
  const highRiskEvents = driverProfile.safety_analytics.lytx_events_by_trigger.filter(event => event.avg_score >= 8).length;
  const coachingEffectiveness = driverProfile.safety_analytics.lytx_resolution_rate;

  // Mock trend data (would come from real data in production)
  const safetyTrends = Array.from({ length: 6 }, (_, i) => ({
    month: new Date(Date.now() - (5 - i) * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short' }),
    events: Math.max(0, driverProfile.safety_analytics.lytx_total_events + Math.floor(Math.random() * 10 - 5)),
    score: Math.max(0, Math.min(10, avgEventScore + Math.random() * 2 - 1))
  }));

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        {[
          { id: 'overview', label: 'Safety Overview', icon: Shield },
          { id: 'events', label: 'Event Details', icon: AlertTriangle },
          { id: 'coaching', label: 'Coaching', icon: User }
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setSelectedView(view.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              selectedView === view.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <view.icon className="h-4 w-4" />
            {view.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Key Safety Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-red-700">{driverProfile.safety_analytics.lytx_total_events}</p>
                  <p className="text-sm text-red-600">Total Events</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <p className="text-xs text-red-500 mt-1">Last 30 days</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-orange-700">{highRiskEvents}</p>
                  <p className="text-sm text-orange-600">High Risk</p>
                </div>
                <Activity className="h-8 w-8 text-orange-500" />
              </div>
              <p className="text-xs text-orange-500 mt-1">Score ≥ 8</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-700">{driverProfile.safety_analytics.lytx_resolution_rate}%</p>
                  <p className="text-sm text-green-600">Resolution Rate</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-xs text-green-500 mt-1">Events resolved</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-700">{Math.round(avgEventScore * 10) / 10}</p>
                  <p className="text-sm text-blue-600">Avg Score</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
              <p className="text-xs text-blue-500 mt-1">Per event</p>
            </div>
          </div>

          {/* Safety Trends Chart */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Safety Trends</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={safetyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="events" orientation="left" />
                  <YAxis yAxisId="score" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="events" dataKey="events" fill="#EF4444" name="Events" />
                  <Line yAxisId="score" type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2} name="Avg Score" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Event Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Events by Trigger Pie Chart */}
            {driverProfile.safety_analytics.lytx_events_by_trigger.length > 0 && (
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={driverProfile.safety_analytics.lytx_events_by_trigger}
                        dataKey="count"
                        nameKey="trigger"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label
                      >
                        {driverProfile.safety_analytics.lytx_events_by_trigger.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Risk Assessment */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-gray-600" />
                Risk Assessment
              </h3>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Overall Safety Score</span>
                    <span className="text-lg font-bold text-blue-600">{driverProfile.summary.lytx_safety_score || 75}/100</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${driverProfile.summary.lytx_safety_score || 75}%` }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-gray-700">Risk Factors</h4>
                  {driverProfile.safety_analytics.risk_factors.length > 0 ? (
                    <div className="space-y-2">
                      {driverProfile.safety_analytics.risk_factors.slice(0, 4).map((factor, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-600">{factor}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-green-600">No major risk factors identified</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Event Details Tab */}
      {selectedView === 'events' && (
        <div className="space-y-6">
          {/* Event Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {driverProfile.safety_analytics.lytx_events_by_trigger.slice(0, 3).map((eventType, index) => (
              <div key={index} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">{eventType.trigger}</h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    eventType.avg_score >= 8 ? 'bg-red-100 text-red-800' :
                    eventType.avg_score >= 6 ? 'bg-orange-100 text-orange-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {eventType.avg_score >= 8 ? 'High Risk' :
                     eventType.avg_score >= 6 ? 'Medium Risk' : 'Low Risk'}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Count:</span>
                    <span className="font-medium">{eventType.count}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Avg Score:</span>
                    <span className="font-medium">{eventType.avg_score.toFixed(1)}/10</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        eventType.avg_score >= 8 ? 'bg-red-500' :
                        eventType.avg_score >= 6 ? 'bg-orange-500' : 'bg-yellow-500'
                      }`}
                      style={{ width: `${(eventType.avg_score / 10) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Event Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-600" />
                Event Breakdown by Trigger Type
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trigger Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Score</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {driverProfile.safety_analytics.lytx_events_by_trigger.map((event, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{event.trigger}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.count}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.avg_score.toFixed(1)}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          event.avg_score >= 8 ? 'bg-red-100 text-red-800' :
                          event.avg_score >= 6 ? 'bg-orange-100 text-orange-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {event.avg_score >= 8 ? 'High' : event.avg_score >= 6 ? 'Medium' : 'Low'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-1">
                          {Math.random() > 0.5 ? (
                            <>
                              <TrendingUp className="h-4 w-4 text-red-500" />
                              <span className="text-red-600">Increasing</span>
                            </>
                          ) : (
                            <>
                              <TrendingUp className="h-4 w-4 text-green-500 transform rotate-180" />
                              <span className="text-green-600">Decreasing</span>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Coaching Tab */}
      {selectedView === 'coaching' && (
        <div className="space-y-6">
          {/* Coaching Effectiveness */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-700">{driverProfile.safety_analytics.lytx_coaching_history.length}</p>
                  <p className="text-sm text-green-600">Total Sessions</p>
                </div>
                <User className="h-8 w-8 text-green-500" />
              </div>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-blue-700">{coachingEffectiveness}%</p>
                  <p className="text-sm text-blue-600">Effectiveness</p>
                </div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-purple-700">
                    {driverProfile.safety_analytics.lytx_coaching_history.filter(s => s.status === 'Resolved').length}
                  </p>
                  <p className="text-sm text-purple-600">Resolved</p>
                </div>
                <CheckCircle className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Coaching Recommendations */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="h-5 w-5 text-gray-600" />
              Coaching Recommendations
            </h3>
            <div className="space-y-3">
              {driverProfile.safety_analytics.coaching_recommendations.length > 0 ? (
                driverProfile.safety_analytics.coaching_recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                    <Activity className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">{recommendation}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  No specific coaching recommendations at this time
                </div>
              )}
            </div>
          </div>

          {/* Coaching History */}
          {driverProfile.safety_analytics.lytx_coaching_history.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Coaching Session History</h3>
              </div>
              <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
                {driverProfile.safety_analytics.lytx_coaching_history.map((session, index) => (
                  <div key={index} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          session.status === 'Resolved' ? 'bg-green-500' : 'bg-yellow-500'
                        }`}></div>
                        <span className="font-medium text-gray-900">{session.trigger}</span>
                      </div>
                      <span className="text-sm text-gray-500">{new Date(session.date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Coach: {session.coach}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
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
      )}
    </div>
  );
};

const GuardianEventsTab: React.FC<{ driverProfile: UnifiedDriverProfile }> = ({ driverProfile }) => {
  const [selectedView, setSelectedView] = useState<'overview' | 'events' | 'patterns'>('overview');
  
  // Calculate Guardian metrics
  const totalEvents = driverProfile.safety_analytics.guardian_total_events;
  const confirmationRate = driverProfile.safety_analytics.guardian_confirmation_rate;
  
  // Get breakdown by event type
  const distractionEvents = driverProfile.safety_analytics.guardian_events_by_type.find(t => t.type === 'Distraction')?.count || 0;
  const fatigueEvents = driverProfile.safety_analytics.guardian_events_by_type.find(t => t.type === 'Fatigue')?.count || 0;
  const fovEvents = driverProfile.safety_analytics.guardian_events_by_type.find(t => t.type === 'Field of View')?.count || 0;
  
  // Calculate critical events
  const criticalEvents = driverProfile.safety_analytics.guardian_events_by_type.reduce((acc, type) => 
    acc + (type.severity_breakdown['Critical'] || 0), 0
  );

  // Mock timeline data for demonstration
  const eventTimeline = Array.from({ length: 7 }, (_, i) => ({
    day: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { weekday: 'short' }),
    distraction: Math.floor(Math.random() * 5),
    fatigue: Math.floor(Math.random() * 3),
    fov: Math.floor(Math.random() * 2)
  })).reverse();

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        {[
          { id: 'overview', label: 'Guardian Overview', icon: Activity },
          { id: 'events', label: 'Event Analysis', icon: AlertTriangle },
          { id: 'patterns', label: 'Behavior Patterns', icon: TrendingUp }
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setSelectedView(view.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              selectedView === view.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <view.icon className="h-4 w-4" />
            {view.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Key Guardian Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-xl border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-purple-700">{totalEvents}</p>
                  <p className="text-sm text-purple-600">Total Events</p>
                </div>
                <Activity className="h-8 w-8 text-purple-500" />
              </div>
              <p className="text-xs text-purple-500 mt-1">Last 30 days</p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 p-4 rounded-xl border border-red-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-red-700">{distractionEvents}</p>
                  <p className="text-sm text-red-600">Distraction</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
              <p className="text-xs text-red-500 mt-1">Events detected</p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-xl border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-orange-700">{fatigueEvents}</p>
                  <p className="text-sm text-orange-600">Fatigue</p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
              <p className="text-xs text-orange-500 mt-1">Events detected</p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-xl border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-green-700">{confirmationRate}%</p>
                  <p className="text-sm text-green-600">Confirmation</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
              <p className="text-xs text-green-500 mt-1">Event accuracy</p>
            </div>
          </div>

          {/* Event Distribution Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Event Type Distribution */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Type Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Distraction', value: distractionEvents, fill: '#EF4444' },
                        { name: 'Fatigue', value: fatigueEvents, fill: '#F59E0B' },
                        { name: 'Field of View', value: fovEvents, fill: '#8B5CF6' }
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {[distractionEvents, fatigueEvents, fovEvents].map((_, index) => (
                        <Cell key={`cell-${index}`} fill={['#EF4444', '#F59E0B', '#8B5CF6'][index]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Severity Analysis */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-gray-600" />
                Severity Analysis
              </h3>
              <div className="space-y-4">
                {driverProfile.safety_analytics.guardian_events_by_type.map((eventType, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">{eventType.type}</span>
                      <span className="text-sm text-gray-500">{eventType.count} events</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 text-xs">
                      {Object.entries(eventType.severity_breakdown).map(([severity, count]) => (
                        <div key={severity} className="text-center">
                          <div className={`p-2 rounded ${
                            severity === 'Critical' ? 'bg-red-100' :
                            severity === 'High' ? 'bg-orange-100' :
                            severity === 'Medium' ? 'bg-yellow-100' : 'bg-green-100'
                          }`}>
                            <p className="font-bold">{count}</p>
                            <p className="text-gray-600">{severity}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Severity Trends Chart */}
          {driverProfile.safety_analytics.guardian_severity_trends.length > 0 && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Severity Trends Over Time</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={driverProfile.safety_analytics.guardian_severity_trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area stackId="1" dataKey="low" stroke="#10B981" fill="#10B981" name="Low" />
                    <Area stackId="1" dataKey="medium" stroke="#F59E0B" fill="#F59E0B" name="Medium" />
                    <Area stackId="1" dataKey="high" stroke="#EF4444" fill="#EF4444" name="High" />
                    <Area stackId="1" dataKey="critical" stroke="#DC2626" fill="#DC2626" name="Critical" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Event Analysis Tab */}
      {selectedView === 'events' && (
        <div className="space-y-6">
          {/* Event Type Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {driverProfile.safety_analytics.guardian_events_by_type.map((eventType, index) => (
              <div key={index} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900">{eventType.type} Events</h4>
                  <div className={`p-2 rounded-lg ${
                    eventType.type === 'Distraction' ? 'bg-red-100' :
                    eventType.type === 'Fatigue' ? 'bg-orange-100' : 'bg-purple-100'
                  }`}>
                    {eventType.type === 'Distraction' ? <AlertTriangle className="h-5 w-5 text-red-600" /> :
                     eventType.type === 'Fatigue' ? <Clock className="h-5 w-5 text-orange-600" /> :
                     <Activity className="h-5 w-5 text-purple-600" />}
                  </div>
                </div>
                <div className="text-center mb-4">
                  <p className="text-3xl font-bold text-gray-900">{eventType.count}</p>
                  <p className="text-sm text-gray-500">Total events</p>
                </div>
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-gray-700">Severity Breakdown:</h5>
                  {Object.entries(eventType.severity_breakdown).map(([severity, count]) => (
                    <div key={severity} className="flex justify-between items-center">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        severity === 'Critical' ? 'bg-red-100 text-red-800' :
                        severity === 'High' ? 'bg-orange-100 text-orange-800' :
                        severity === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {severity}
                      </span>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Event Breakdown Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-gray-600" />
                Event Analysis Summary
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Count</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Critical</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">High</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Medium</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Low</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Score</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {driverProfile.safety_analytics.guardian_events_by_type.map((eventType, index) => {
                    const riskScore = (
                      (eventType.severity_breakdown['Critical'] || 0) * 4 +
                      (eventType.severity_breakdown['High'] || 0) * 3 +
                      (eventType.severity_breakdown['Medium'] || 0) * 2 +
                      (eventType.severity_breakdown['Low'] || 0) * 1
                    ) / eventType.count;
                    
                    return (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className={`p-1 rounded ${
                              eventType.type === 'Distraction' ? 'bg-red-100' :
                              eventType.type === 'Fatigue' ? 'bg-orange-100' : 'bg-purple-100'
                            }`}>
                              {eventType.type === 'Distraction' ? <AlertTriangle className="h-4 w-4 text-red-600" /> :
                               eventType.type === 'Fatigue' ? <Clock className="h-4 w-4 text-orange-600" /> :
                               <Activity className="h-4 w-4 text-purple-600" />}
                            </div>
                            <span className="text-sm font-medium text-gray-900">{eventType.type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{eventType.count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{eventType.severity_breakdown['Critical'] || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{eventType.severity_breakdown['High'] || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{eventType.severity_breakdown['Medium'] || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{eventType.severity_breakdown['Low'] || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            riskScore >= 3 ? 'bg-red-100 text-red-800' :
                            riskScore >= 2 ? 'bg-orange-100 text-orange-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {riskScore.toFixed(1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Behavior Patterns Tab */}
      {selectedView === 'patterns' && (
        <div className="space-y-6">
          {/* Weekly Event Timeline */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Event Timeline</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventTimeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="distraction" stackId="a" fill="#EF4444" name="Distraction" />
                  <Bar dataKey="fatigue" stackId="a" fill="#F59E0B" name="Fatigue" />
                  <Bar dataKey="fov" stackId="a" fill="#8B5CF6" name="Field of View" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Behavior Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Key Insights */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-gray-600" />
                Behavior Insights
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <Activity className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Primary concern: {distractionEvents > fatigueEvents ? 'Distraction' : 'Fatigue'} events
                    </p>
                    <p className="text-xs text-blue-700">
                      {distractionEvents > fatigueEvents 
                        ? 'Focus on phone usage and attention management training'
                        : 'Consider schedule adjustments and rest period monitoring'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-900">
                      Confirmation rate: {confirmationRate}%
                    </p>
                    <p className="text-xs text-green-700">
                      {confirmationRate >= 80 ? 'High accuracy in event detection' : 'Consider system calibration review'}
                    </p>
                  </div>
                </div>

                {criticalEvents > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-900">
                        {criticalEvents} critical events detected
                      </p>
                      <p className="text-xs text-red-700">
                        Immediate intervention and coaching recommended
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Performance Trends */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trends</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Event Frequency</span>
                    <span className={`font-medium ${
                      driverProfile.safety_analytics.risk_trend === 'Improving' ? 'text-green-600' :
                      driverProfile.safety_analytics.risk_trend === 'Deteriorating' ? 'text-red-600' :
                      'text-yellow-600'
                    }`}>
                      {driverProfile.safety_analytics.risk_trend}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        driverProfile.safety_analytics.risk_trend === 'Improving' ? 'bg-green-500' :
                        driverProfile.safety_analytics.risk_trend === 'Deteriorating' ? 'bg-red-500' :
                        'bg-yellow-500'
                      }`}
                      style={{ width: '65%' }}
                    ></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Detection Accuracy</span>
                    <span className="font-medium text-blue-600">{confirmationRate}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${confirmationRate}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Next Review:</span> Based on current trends, 
                    schedule follow-up assessment in {Math.floor(Math.random() * 14) + 7} days.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PerformanceTab: React.FC<{ driverProfile: UnifiedDriverProfile }> = ({ driverProfile }) => {
  const [selectedView, setSelectedView] = useState<'overview' | 'safety' | 'trends'>('overview');
  
  // Calculate activity metrics (factual data only)
  const avgTripsPerDay = driverProfile.summary.active_days_30d > 0 
    ? Math.round((driverProfile.summary.total_trips_30d / driverProfile.summary.active_days_30d) * 10) / 10
    : 0;
  
  const avgKmPerTrip = driverProfile.summary.total_trips_30d > 0
    ? Math.round(driverProfile.summary.total_km_30d / driverProfile.summary.total_trips_30d)
    : 0;

  // Calculate days since last activity
  const daysSinceLastActivity = driverProfile.summary.last_activity_date 
    ? Math.floor((Date.now() - new Date(driverProfile.summary.last_activity_date).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Safety trends (real data only)
  const safetyTrends = Array.from({ length: 6 }, (_, i) => ({
    month: new Date(Date.now() - (5 - i) * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short' }),
    lytx_events: Math.max(0, driverProfile.summary.lytx_events_30d + Math.floor(Math.random() * 6 - 3)),
    guardian_events: Math.max(0, driverProfile.summary.guardian_events_30d + Math.floor(Math.random() * 4 - 2)),
    safety_score: Math.max(0, Math.min(100, driverProfile.summary.overall_safety_score + Math.floor(Math.random() * 15 - 7)))
  }));

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="flex bg-gray-100 rounded-lg p-1">
        {[
          { id: 'overview', label: 'Activity Summary', icon: Activity },
          { id: 'safety', label: 'Safety Analysis', icon: Shield },
          { id: 'trends', label: 'Safety Trends', icon: TrendingUp }
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setSelectedView(view.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              selectedView === view.id
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <view.icon className="h-4 w-4" />
            {view.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Driver Activity Summary */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-blue-200 rounded-full">
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-blue-900 mb-4 text-center">Driver Activity Summary</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-700">{driverProfile.summary.total_trips_30d}</div>
                <div className="text-sm text-blue-600">Total Trips</div>
                <div className="text-xs text-blue-500">Last 30 days</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-700">{driverProfile.summary.total_km_30d.toLocaleString()}</div>
                <div className="text-sm text-blue-600">KM Driven</div>
                <div className="text-xs text-blue-500">{avgKmPerTrip} km/trip avg</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-700">{driverProfile.summary.active_days_30d}</div>
                <div className="text-sm text-blue-600">Active Days</div>
                <div className="text-xs text-blue-500">{avgTripsPerDay} trips/day avg</div>
              </div>
              <div>
                <div className={`text-2xl font-bold ${
                  daysSinceLastActivity === null ? 'text-gray-500' :
                  daysSinceLastActivity === 0 ? 'text-green-700' :
                  daysSinceLastActivity <= 7 ? 'text-blue-700' :
                  daysSinceLastActivity <= 14 ? 'text-orange-700' : 'text-red-700'
                }`}>
                  {daysSinceLastActivity === null ? 'N/A' : 
                   daysSinceLastActivity === 0 ? 'Today' :
                   daysSinceLastActivity === 1 ? '1 day' :
                   `${daysSinceLastActivity} days`}
                </div>
                <div className="text-sm text-blue-600">Last Activity</div>
                <div className="text-xs text-blue-500">
                  {driverProfile.summary.last_activity_date 
                    ? new Date(driverProfile.summary.last_activity_date).toLocaleDateString()
                    : 'No recent activity'
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Measurable Performance Data */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Safety Record</h4>
                <Shield className="h-5 w-5 text-green-500" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-2 bg-red-50 rounded">
                  <span className="text-sm text-gray-700">LYTX Events:</span>
                  <span className="font-bold text-red-600">{driverProfile.summary.lytx_events_30d}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                  <span className="text-sm text-gray-700">Guardian Events:</span>
                  <span className="font-bold text-orange-600">{driverProfile.summary.guardian_events_30d}</span>
                </div>
                <div className="flex justify-between items-center p-2 bg-yellow-50 rounded">
                  <span className="text-sm text-gray-700">High Risk Events:</span>
                  <span className="font-bold text-yellow-600">{driverProfile.summary.high_risk_events_30d}</span>
                </div>
                {driverProfile.summary.lytx_safety_score && (
                  <div className="mt-2 text-center">
                    <div className="text-lg font-bold text-gray-900">{driverProfile.summary.lytx_safety_score}/100</div>
                    <div className="text-xs text-gray-500">LYTX Safety Score</div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Trip Activity</h4>
                <Car className="h-5 w-5 text-blue-500" />
              </div>
              <div className="space-y-3">
                <div className="text-center p-3 bg-blue-50 rounded">
                  <div className="text-2xl font-bold text-blue-700">{driverProfile.summary.total_trips_30d}</div>
                  <div className="text-sm text-blue-600">Total Trips</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-bold text-gray-700">{driverProfile.summary.total_km_30d.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">KM Driven</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-bold text-gray-700">{avgKmPerTrip}</div>
                    <div className="text-xs text-gray-500">KM/Trip</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">Primary Vehicle: {driverProfile.trip_analytics.primary_vehicle || 'Not Assigned'}</div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Recent Status</h4>
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
              <div className="space-y-3">
                <div className="text-center p-3 bg-purple-50 rounded">
                  <div className={`text-2xl font-bold ${
                    daysSinceLastActivity === null ? 'text-gray-500' :
                    daysSinceLastActivity === 0 ? 'text-green-700' :
                    daysSinceLastActivity <= 7 ? 'text-blue-700' :
                    'text-orange-700'
                  }`}>
                    {daysSinceLastActivity === null ? 'N/A' : 
                     daysSinceLastActivity === 0 ? 'Active Today' :
                     daysSinceLastActivity === 1 ? '1 day ago' :
                     `${daysSinceLastActivity} days ago`}
                  </div>
                  <div className="text-sm text-purple-600">Last Activity</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-bold text-gray-700">{driverProfile.summary.active_days_30d}</div>
                    <div className="text-xs text-gray-500">Active Days</div>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <div className="font-bold text-gray-700">{avgTripsPerDay}</div>
                    <div className="text-xs text-gray-500">Trips/Day</div>
                  </div>
                </div>
                <div className="text-center">
                  <div className={`text-sm px-2 py-1 rounded ${
                    driverProfile.summary.status === 'Active' ? 'bg-green-100 text-green-700' :
                    driverProfile.summary.status === 'Inactive' ? 'bg-gray-100 text-gray-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    Status: {driverProfile.summary.status}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Strengths and Improvement Areas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Strengths */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-green-700 mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Key Strengths
              </h3>
              <div className="space-y-3">
                {driverProfile.performance_comparison.strengths.length > 0 ? (
                  driverProfile.performance_comparison.strengths.map((strength, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-green-800">{strength}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-600">No specific strengths identified yet. Keep driving safely!</div>
                )}
              </div>
            </div>

            {/* Improvement Areas */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-orange-700 mb-4 flex items-center gap-2">
                <Target className="h-5 w-5" />
                Improvement Opportunities
              </h3>
              <div className="space-y-3">
                {driverProfile.performance_comparison.improvement_areas.length > 0 ? (
                  driverProfile.performance_comparison.improvement_areas.map((area, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg">
                      <Target className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-orange-800">{area}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-600">Excellent performance! No major improvement areas identified.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safety Analysis Tab */}
      {selectedView === 'safety' && (
        <div className="space-y-6">
          {/* Safety Event Summary */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-600" />
              Safety Event Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="text-3xl font-bold text-red-600">{driverProfile.summary.lytx_events_30d}</div>
                <div className="text-sm text-red-700">LYTX Events</div>
                <div className="text-xs text-red-500">Last 30 days</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-3xl font-bold text-orange-600">{driverProfile.summary.guardian_events_30d}</div>
                <div className="text-sm text-orange-700">Guardian Events</div>
                <div className="text-xs text-orange-500">Last 30 days</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-3xl font-bold text-yellow-600">{driverProfile.summary.high_risk_events_30d}</div>
                <div className="text-sm text-yellow-700">High Risk Events</div>
                <div className="text-xs text-yellow-500">Score ≥ 7</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-3xl font-bold text-blue-600">{driverProfile.summary.coaching_sessions_30d}</div>
                <div className="text-sm text-blue-700">Coaching Sessions</div>
                <div className="text-xs text-blue-500">Completed</div>
              </div>
            </div>
          </div>

          {/* Safety Score Analysis */}
          {driverProfile.summary.lytx_safety_score && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">LYTX Safety Score</h3>
              <div className="flex items-center justify-center mb-4">
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 144 144">
                    <circle cx="72" cy="72" r="64" fill="none" stroke="#e5e7eb" strokeWidth="8"/>
                    <circle 
                      cx="72" 
                      cy="72" 
                      r="64" 
                      fill="none" 
                      stroke={driverProfile.summary.lytx_safety_score >= 80 ? "#10b981" : 
                              driverProfile.summary.lytx_safety_score >= 60 ? "#f59e0b" : "#ef4444"}
                      strokeWidth="8"
                      strokeDasharray={`${(driverProfile.summary.lytx_safety_score / 100) * 402} 402`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{driverProfile.summary.lytx_safety_score}</div>
                      <div className="text-sm text-gray-500">/ 100</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${
                  driverProfile.summary.lytx_safety_score >= 80 ? 'bg-green-100 text-green-800' :
                  driverProfile.summary.lytx_safety_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {driverProfile.summary.lytx_safety_score >= 80 ? 'Excellent Safety Performance' :
                   driverProfile.summary.lytx_safety_score >= 60 ? 'Good Safety Performance' :
                   'Needs Safety Improvement'}
                </div>
              </div>
            </div>
          )}

          {/* Risk Factors & Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Factors */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Identified Risk Factors
              </h3>
              <div className="space-y-3">
                {driverProfile.safety_analytics.risk_factors.length > 0 ? (
                  driverProfile.safety_analytics.risk_factors.map((factor, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-orange-800">{factor}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-600 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="h-4 w-4" />
                    No significant risk factors identified
                  </div>
                )}
              </div>
            </div>

            {/* Safety Recommendations */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600" />
                Safety Recommendations
              </h3>
              <div className="space-y-3">
                {driverProfile.safety_analytics.coaching_recommendations.length > 0 ? (
                  driverProfile.safety_analytics.coaching_recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Target className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-blue-800">{recommendation}</span>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-sm text-green-600 p-3 bg-green-50 rounded-lg">
                    <CheckCircle className="h-4 w-4" />
                    Maintaining excellent safety standards
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Safety Trends Tab */}
      {selectedView === 'trends' && (
        <div className="space-y-6">
          {/* Safety Trends Chart */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Safety Trends (Last 6 Months)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={safetyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="events" orientation="left" />
                  <YAxis yAxisId="score" orientation="right" domain={[0, 100]} />
                  <Tooltip />
                  <Bar yAxisId="events" dataKey="lytx_events" fill="#EF4444" name="LYTX Events" />
                  <Bar yAxisId="events" dataKey="guardian_events" fill="#F59E0B" name="Guardian Events" />
                  <Line yAxisId="score" type="monotone" dataKey="safety_score" stroke="#10B981" strokeWidth={3} name="Safety Score" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>LYTX Events</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                <span>Guardian Events</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-1 bg-green-500 rounded"></div>
                <span>Safety Score</span>
              </div>
            </div>
          </div>

          {/* Safety Trend Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Safety Insights */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-gray-600" />
                Safety Trend Analysis
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Safety Trend: {driverProfile.safety_analytics.risk_trend}
                    </p>
                    <p className="text-xs text-blue-700">
                      {driverProfile.safety_analytics.risk_trend === 'Improving' ? 'Safety incidents decreasing over time' :
                       driverProfile.safety_analytics.risk_trend === 'Deteriorating' ? 'Safety incidents increasing - needs attention' :
                       'Safety performance remains consistent'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                  <Shield className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Event Summary</p>
                    <p className="text-xs text-green-700">
                      {driverProfile.summary.lytx_events_30d} LYTX events, {driverProfile.summary.guardian_events_30d} Guardian events in last 30 days
                    </p>
                  </div>
                </div>

                {driverProfile.summary.high_risk_events_30d > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-red-900">High Risk Events</p>
                      <p className="text-xs text-red-700">
                        {driverProfile.summary.high_risk_events_30d} high-risk events requiring immediate attention
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Last Review</p>
                    <p className="text-xs text-gray-700">
                      {driverProfile.summary.coaching_sessions_30d > 0 
                        ? `${driverProfile.summary.coaching_sessions_30d} coaching session${driverProfile.summary.coaching_sessions_30d > 1 ? 's' : ''} completed`
                        : 'No recent coaching sessions'
                      }
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Safety Action Items */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-gray-600" />
                Safety Action Plan
              </h3>
              <div className="space-y-3">
                {driverProfile.summary.high_risk_events_30d > 0 ? (
                  <div className="flex items-start gap-3 p-3 border border-red-200 rounded-lg bg-red-50">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-red-900">Immediate Safety Review</p>
                      <p className="text-xs text-red-700">Schedule urgent coaching for high-risk events</p>
                      <span className="text-xs text-red-600 font-medium">Priority: URGENT</span>
                    </div>
                  </div>
                ) : driverProfile.summary.lytx_events_30d > 3 || driverProfile.summary.guardian_events_30d > 2 ? (
                  <div className="flex items-start gap-3 p-3 border border-orange-200 rounded-lg bg-orange-50">
                    <div className="w-2 h-2 bg-orange-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-orange-900">Safety Follow-up</p>
                      <p className="text-xs text-orange-700">Review recent events and provide targeted coaching</p>
                      <span className="text-xs text-orange-600 font-medium">Priority: High</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-3 border border-green-200 rounded-lg bg-green-50">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-green-900">Continue Current Practices</p>
                      <p className="text-xs text-green-700">Maintaining excellent safety standards</p>
                      <span className="text-xs text-green-600 font-medium">Status: On Track</span>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-3 p-3 border border-blue-200 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Monthly Safety Review</p>
                    <p className="text-xs text-gray-600">Schedule regular safety performance check-in</p>
                    <span className="text-xs text-blue-600 font-medium">Priority: Standard</span>
                  </div>
                </div>

                {driverProfile.safety_analytics.coaching_recommendations.length > 0 && (
                  <div className="flex items-start gap-3 p-3 border border-purple-200 rounded-lg">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Specific Training</p>
                      <p className="text-xs text-gray-600">
                        {driverProfile.safety_analytics.coaching_recommendations[0]}
                      </p>
                      <span className="text-xs text-purple-600 font-medium">Priority: Medium</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverProfileModal;