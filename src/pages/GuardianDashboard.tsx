import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Eye,
  Users,
  Clock,
  Loader2
} from 'lucide-react';
import DataCentreLayout from '@/components/DataCentreLayout';
import GuardianCriticalFatigueAlerts from '@/components/GuardianCriticalFatigueAlerts';
import GuardianComplianceCharts from '@/components/GuardianComplianceCharts';
import GuardianDateRangePicker from '@/components/GuardianDateRangePicker';
import GuardianComplianceExport from '@/components/GuardianComplianceExport';
import GuardianCorrelationBadge from '@/components/GuardianCorrelationBadge';
import { supabase } from '@/lib/supabase';
import { guardianAnalytics, ComplianceMetrics } from '@/services/guardianAnalyticsService';

interface GuardianDashboardProps {
  fleet?: 'Stevemacs' | 'Great Southern Fuels';
}

interface GuardianEvent {
  id: string;
  external_event_id: string;
  vehicle_registration: string;
  driver_name?: string;
  detection_time: string;
  event_type: string;
  duration_seconds?: number;
  speed_kph?: number;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  verified: boolean;
  status?: string;
  fleet: string;
  depot?: string;
  confirmation?: string;
  classification?: string;
}

interface RequiringAttentionEvent {
  id: string;
  external_event_id: string;
  vehicle_registration: string;
  driver_name?: string;
  detection_time: string;
  event_type: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  confirmation?: string;
  classification?: string;
  fleet: string;
  depot?: string;
  duration_seconds?: number;
  speed_kph?: number;
  verified: boolean;
  status?: string;
  created_at: string;
}

interface GuardianAnalytics {
  metrics: ComplianceMetrics | null;
  recentEvents: GuardianEvent[];
  requiresAttention: RequiringAttentionEvent[];
  topRiskVehicles: Array<{
    vehicle: string;
    events: number;
    fleet: string;
  }>;
  fovProblemVehicles: Array<{
    vehicle: string;
    fovEvents: number;
    fleet: string;
  }>;
}

const GuardianDashboard: React.FC<GuardianDashboardProps> = ({ fleet }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<GuardianAnalytics | null>(null);

  // Default date range: last 12 months
  const getDefaultDateRange = () => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 12);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  };

  const [dateRange, setDateRange] = useState(getDefaultDateRange());

  // Determine dashboard title and filter based on fleet prop
  const getDashboardTitle = () => {
    if (fleet === 'Stevemacs') return 'Stevemacs Guardian Analytics';
    if (fleet === 'Great Southern Fuels') return 'Great Southern Fuels Guardian Analytics';
    return 'Guardian Dashboard';
  };

  const fetchGuardianData = async () => {
    try {
      setLoading(true);

      // Fetch compliance metrics using new service
      const metrics = await guardianAnalytics.getComplianceMetrics(fleet, dateRange);

      // Get recent events with driver correlation data
      let recentQuery = supabase
        .from('guardian_events')
        .select(`
          *
        `)
        .gte('detection_time', dateRange.start)
        .lte('detection_time', dateRange.end)
        .order('detection_time', { ascending: false })
        .limit(20);

      if (fleet) {
        recentQuery = recentQuery.eq('fleet', fleet);
      }

      const { data: recentEvents, error: recentError } = await recentQuery;

      if (recentError) {
        console.error('Error fetching recent Guardian events:', recentError);
      }

      // Get events requiring attention
      let attentionQuery = supabase
        .from('guardian_events_requiring_attention')
        .select('*')
        .limit(10);

      if (fleet) {
        attentionQuery = attentionQuery.eq('fleet', fleet);
      }

      const { data: requiresAttention, error: attentionError } = await attentionQuery;

      if (attentionError) {
        console.error('Error fetching Guardian events requiring attention:', attentionError);
      }

      // For recent events, fetch driver correlations
      const eventIds = recentEvents?.map(e => e.id) || [];
      const { data: correlations } = await supabase
        .from('driver_event_correlation')
        .select('guardian_event_id, driver_id, driver_name, correlation_method, confidence')
        .in('guardian_event_id', eventIds);

      // Map correlations to events
      const correlationMap = new Map();
      correlations?.forEach(c => {
        correlationMap.set(c.guardian_event_id, c);
      });

      const enrichedRecentEvents = recentEvents?.map(event => ({
        ...event,
        correlation: correlationMap.get(event.id),
      })) || [];

      // Get all events in date range for vehicle analysis
      let allEventsQuery = supabase
        .from('guardian_events')
        .select('id, vehicle_registration, fleet, event_type, detection_time')
        .gte('detection_time', dateRange.start)
        .lte('detection_time', dateRange.end);

      if (fleet) {
        allEventsQuery = allEventsQuery.eq('fleet', fleet);
      }

      const { data: allEvents } = await allEventsQuery;

      // Calculate top risk vehicles
      const vehicleEventCounts: Record<string, { count: number; fleet: string }> = {};
      allEvents?.forEach(event => {
        const vehicle = event.vehicle_registration;
        if (!vehicleEventCounts[vehicle]) {
          vehicleEventCounts[vehicle] = { count: 0, fleet: event.fleet };
        }
        vehicleEventCounts[vehicle].count++;
      });

      const topRiskVehicles = Object.entries(vehicleEventCounts)
        .map(([vehicle, data]) => ({
          vehicle,
          events: data.count,
          fleet: data.fleet,
        }))
        .sort((a, b) => b.events - a.events)
        .slice(0, 5);

      // Calculate FOV problem vehicles (last 3 months from current date)
      const now = new Date();
      const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      const fovVehicleCounts: Record<string, { count: number; fleet: string }> = {};
      allEvents
        ?.filter(
          event =>
            event.event_type.toLowerCase().includes('field of view') &&
            new Date(event.detection_time) >= threeMonthsAgo
        )
        .forEach(event => {
          const vehicle = event.vehicle_registration;
          if (!fovVehicleCounts[vehicle]) {
            fovVehicleCounts[vehicle] = { count: 0, fleet: event.fleet };
          }
          fovVehicleCounts[vehicle].count++;
        });

      const fovProblemVehicles = Object.entries(fovVehicleCounts)
        .filter(([_, data]) => data.count >= 5)
        .map(([vehicle, data]) => ({
          vehicle,
          fovEvents: data.count,
          fleet: data.fleet,
        }))
        .sort((a, b) => b.fovEvents - a.fovEvents)
        .slice(0, 10);

      const analyticsData: GuardianAnalytics = {
        metrics,
        recentEvents: enrichedRecentEvents as any,
        requiresAttention: requiresAttention || [],
        topRiskVehicles,
        fovProblemVehicles,
      };

      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading Guardian dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuardianData();
  }, [fleet, dateRange]);

  if (loading) {
    return (
      <DataCentreLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading Guardian data...</p>
          </div>
        </div>
      </DataCentreLayout>
    );
  }

  if (!analytics || !analytics.metrics) {
    return (
      <DataCentreLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto" />
            <h2 className="text-lg font-semibold">Failed to Load Data</h2>
            <p className="text-sm text-muted-foreground">
              Unable to load Guardian analytics data. Please try again.
            </p>
            <Button onClick={fetchGuardianData}>
              Retry
            </Button>
          </div>
        </div>
      </DataCentreLayout>
    );
  }

  const { metrics } = analytics;

  return (
    <DataCentreLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-8 h-8 text-slate-600 dark:text-slate-400" />
                <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {getDashboardTitle()}
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400">
                {fleet
                  ? `${fleet} distraction and fatigue events with driver attribution`
                  : 'Monitor distraction and fatigue events with driver attribution'
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <GuardianComplianceExport fleet={fleet} dateRange={dateRange} />
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>Driver Attribution: {((metrics.distraction.driverAttributionRate + metrics.fatigue.driverAttributionRate) / 2).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Date Range Picker */}
          <GuardianDateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        {/* Fleet Navigation - Smart Switcher for All Pages */}
        <div className="flex gap-2">
          {!fleet ? (
            // Main Dashboard: Show both fleet options
            <>
              <Button
                variant="outline"
                onClick={() => navigate('/data-centre/guardian/smb')}
                className="border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Stevemacs Analytics
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/data-centre/guardian/gsf')}
                className="border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Great Southern Fuels Analytics
              </Button>
            </>
          ) : fleet === 'Stevemacs' ? (
            // SMB Page: Show back to all + switch to GSF
            <>
              <Button
                variant="outline"
                onClick={() => navigate('/data-centre/guardian')}
                className="border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                ← All Fleets
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/data-centre/guardian/gsf')}
                className="border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Switch to GSF →
              </Button>
            </>
          ) : (
            // GSF Page: Show back to all + switch to SMB
            <>
              <Button
                variant="outline"
                onClick={() => navigate('/data-centre/guardian')}
                className="border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                ← All Fleets
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/data-centre/guardian/smb')}
                className="border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                ← Switch to SMB
              </Button>
            </>
          )}
        </div>

        {/* Critical Fatigue Alerts - Top Priority */}
        <GuardianCriticalFatigueAlerts fleet={fleet} />

        {/* Compliance Charts - 4 charts (2x2 grid) */}
        <GuardianComplianceCharts fleet={fleet} dateRange={dateRange} />

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Distraction Events */}
          <Card className="border-slate-200/50 dark:border-slate-700/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Total Distraction Events
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {metrics.distraction.total.toLocaleString()}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
                {metrics.distraction.trend >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-orange-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-green-600" />
                )}
                {Math.abs(metrics.distraction.trend).toFixed(1)}% vs previous period
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {metrics.distraction.driverAttributionRate.toFixed(0)}% have known drivers
              </p>
            </CardContent>
          </Card>

          {/* Verified Distraction Events */}
          <Card className="border-slate-200/50 dark:border-slate-700/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Verified Distraction Events
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {metrics.distraction.verified.toLocaleString()}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {metrics.distraction.verificationRate.toFixed(1)}% verified
              </p>
              {metrics.distraction.verificationRate < 10 && (
                <p className="text-xs text-orange-600 mt-1">
                  ⚠ Low verification rate
                </p>
              )}
            </CardContent>
          </Card>

          {/* Total Fatigue Events */}
          <Card className="border-slate-200/50 dark:border-slate-700/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Total Fatigue Events
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-teal-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                {metrics.fatigue.total.toLocaleString()}
                {metrics.fatigue.last24h > 0 && (
                  <Badge className="bg-red-600 text-white text-xs px-2 py-0.5">
                    +{metrics.fatigue.last24h} last 24h
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
                {metrics.fatigue.trend >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-orange-600" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-green-600" />
                )}
                {Math.abs(metrics.fatigue.trend).toFixed(1)}% vs previous period
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {metrics.fatigue.driverAttributionRate.toFixed(0)}% have known drivers
              </p>
            </CardContent>
          </Card>

          {/* Verified Fatigue Events */}
          <Card className="border-slate-200/50 dark:border-slate-700/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Verified Fatigue Events
              </CardTitle>
              <CheckCircle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {metrics.fatigue.verified.toLocaleString()}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {metrics.fatigue.verificationRate.toFixed(1)}% verified
              </p>
              {metrics.fatigue.verificationRate < 5 && (
                <p className="text-xs text-red-600 mt-1">
                  🔴 Critical - needs attention
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Events Requiring Attention */}
        {analytics.requiresAttention.length > 0 && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                Events Requiring Immediate Attention ({analytics.requiresAttention.length})
              </CardTitle>
              <CardDescription>
                High priority unverified events, missing confirmations, and critical active events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {analytics.requiresAttention.map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${
                        event.severity === 'Critical' ? 'bg-red-600' : 
                        event.severity === 'High' ? 'bg-orange-500' : 'bg-yellow-500'
                      }`}></div>
                      <div>
                        <div className="font-medium">
                          {event.vehicle_registration} - {event.driver_name || 'Unknown Driver'}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {event.event_type}
                          {event.duration_seconds && ` • ${event.duration_seconds}s`}
                          {event.speed_kph && ` • ${event.speed_kph} km/h`}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(event.detection_time).toLocaleString()}
                          {!event.confirmation && ' • Missing confirmation'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline"
                        className={
                          event.severity === 'Critical' ? 'border-red-500 text-red-700 bg-red-50' :
                          event.severity === 'High' ? 'border-orange-500 text-orange-700 bg-orange-50' :
                          'border-yellow-500 text-yellow-700 bg-yellow-50'
                        }
                      >
                        {event.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {event.fleet === 'Stevemacs' ? 'SMB' : 'GSF'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Risk Vehicles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Top Risk Vehicles
            </CardTitle>
            <CardDescription>
              Vehicles with highest event frequency in selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topRiskVehicles.length > 0 ? (
                analytics.topRiskVehicles.map((vehicle, index) => (
                  <div key={vehicle.vehicle} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center text-xs font-medium">
                        {index + 1}
                      </div>
                      <span className="font-medium">{vehicle.vehicle}</span>
                      <Badge variant="outline" className="text-xs">
                        {vehicle.fleet === 'Stevemacs' ? 'SMB' : 'GSF'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-red-600 border-red-200">
                        {vehicle.events} events
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No events recorded in selected period
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Events
            </CardTitle>
            <CardDescription>
              Latest Guardian events from {fleet || 'all fleets'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.recentEvents.length > 0 ? (
                analytics.recentEvents.slice(0, 10).map((event: any) => (
                  <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${
                        event.event_type.toLowerCase().includes('distraction') ? 'bg-red-500' :
                        event.event_type.toLowerCase().includes('fatigue') ? 'bg-orange-500' :
                        event.event_type.toLowerCase().includes('field of view') ? 'bg-blue-500' : 'bg-gray-500'
                      }`}></div>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {event.vehicle_registration} - {event.correlation?.driver_name || event.driver_name || 'Unknown Driver'}
                          {event.correlation && (
                            <GuardianCorrelationBadge
                              driverName={event.correlation.driver_name}
                              correlationMethod={event.correlation.correlation_method}
                              confidence={event.correlation.confidence}
                              size="sm"
                              showIcon={false}
                            />
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {event.event_type} • {event.duration_seconds}s • {Math.round(event.speed_kph)} km/h
                        </div>
                        <div className="text-xs text-gray-400">
                          {new Date(event.detection_time).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={(event.verified || event.confirmation === 'verified') ? "default" : "secondary"}
                        className={
                          (event.verified || event.confirmation === 'verified') ? 'bg-green-100 text-green-700' :
                          event.confirmation === 'criteria not met' ? 'bg-gray-100 text-gray-700' :
                          event.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                          event.severity === 'High' ? 'bg-orange-100 text-orange-700' :
                          'bg-yellow-100 text-yellow-700'
                        }
                      >
                        {(event.verified || event.confirmation === 'verified') ? 'verified' :
                         event.confirmation === 'criteria not met' ? 'criteria not met' :
                         event.confirmation || event.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {event.fleet === 'Stevemacs' ? 'SMB' : 'GSF'}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No recent events found
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Field of View Issues */}
        <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Eye className="w-5 h-5" />
              Field of View Issues (Last 3 Months)
            </CardTitle>
            <CardDescription>
              Trucks with frequent FOV events - may indicate camera alignment issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.fovProblemVehicles.length > 0 ? (
              <div className="space-y-3">
                {analytics.fovProblemVehicles.map((vehicle) => (
                  <div key={vehicle.vehicle} className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <div>
                        <div className="font-medium">{vehicle.vehicle}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          Camera may need alignment check
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant="outline"
                        className="border-blue-500 text-blue-700 bg-blue-50"
                      >
                        {vehicle.fovEvents} FOV events
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {vehicle.fleet === 'Stevemacs' ? 'SMB' : 'GSF'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Eye className="w-12 h-12 mx-auto mb-4 text-green-300" />
                <p className="text-sm font-medium text-green-700 dark:text-green-400">No FOV Issues Detected</p>
                <p className="text-xs text-muted-foreground mt-1">All trucks have fewer than 5 FOV events in the last 3 months</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DataCentreLayout>
  );
};

export default GuardianDashboard;