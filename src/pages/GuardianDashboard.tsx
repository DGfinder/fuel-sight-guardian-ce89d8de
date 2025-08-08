import React, { useState, useEffect } from 'react';
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
  Download,
  Calendar,
  Users,
  Clock,
  Loader2
} from 'lucide-react';
import DataCentreLayout from '@/components/DataCentreLayout';
import { supabase } from '@/lib/supabase';

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
  currentMonth: {
    period: string;
    totalEvents: number;
    distractionEvents: number;
    fatigueEvents: number;
    verifiedEvents: number;
    verificationRate: number;
    stevemacsEvents: number;
    gsfEvents: number;
    criticalEvents: number;
    highSeverityEvents: number;
    requiresAttentionCount: number;
  };
  recentEvents: GuardianEvent[];
  requiresAttention: RequiringAttentionEvent[];
  monthlyEvents: GuardianEvent[];
  topRiskVehicles: Array<{
    vehicle: string;
    events: number;
    fleet: string;
  }>;
}

const GuardianDashboard: React.FC<GuardianDashboardProps> = ({ fleet }) => {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<GuardianAnalytics | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  // Determine dashboard title and filter based on fleet prop
  const getDashboardTitle = () => {
    if (fleet === 'Stevemacs') return 'Stevemacs Guardian Analytics';
    if (fleet === 'Great Southern Fuels') return 'Great Southern Fuels Guardian Analytics';
    return 'Guardian Compliance Dashboard';
  };

  const fetchGuardianData = async () => {
    try {
      setLoading(true);

      // Get current month start date
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Base query with fleet filter if specified
      let eventsQuery = supabase
        .from('guardian_events')
        .select('*')
        .gte('detection_time', currentMonthStart.toISOString())
        .order('detection_time', { ascending: false });

      if (fleet) {
        eventsQuery = eventsQuery.eq('fleet', fleet);
      }

      // Get monthly events
      const { data: monthlyEvents, error: monthlyError } = await eventsQuery;

      if (monthlyError) {
        console.error('Error fetching monthly Guardian events:', monthlyError);
        throw monthlyError;
      }

      // Get recent events (last 20)
      let recentQuery = supabase
        .from('guardian_events')
        .select('*')
        .order('detection_time', { ascending: false })
        .limit(20);

      if (fleet) {
        recentQuery = recentQuery.eq('fleet', fleet);
      }

      const { data: recentEvents, error: recentError } = await recentQuery;

      if (recentError) {
        console.error('Error fetching recent Guardian events:', recentError);
        throw recentError;
      }

      // Get events requiring attention using the specialized view
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
        // Continue without failing if this view has issues
      }

      // Calculate analytics
      const currentMonth = now.toLocaleString('default', { month: 'long', year: 'numeric' });
      
      const distractionEvents = monthlyEvents?.filter(e => 
        e.event_type.toLowerCase().includes('distraction')
      ).length || 0;
      
      const fatigueEvents = monthlyEvents?.filter(e => 
        e.event_type.toLowerCase().includes('fatigue') || 
        e.event_type.toLowerCase().includes('microsleep')
      ).length || 0;

      // Count events that are either manually verified in our system OR confirmed by Guardian
      const verifiedEvents = monthlyEvents?.filter(e => 
        e.verified || e.confirmation === 'verified'
      ).length || 0;
      const totalEvents = monthlyEvents?.length || 0;
      const verificationRate = totalEvents > 0 ? (verifiedEvents / totalEvents) * 100 : 0;

      // High severity event counts
      const criticalEvents = monthlyEvents?.filter(e => e.severity === 'Critical').length || 0;
      const highSeverityEvents = monthlyEvents?.filter(e => 
        e.severity === 'High' || e.severity === 'Critical'
      ).length || 0;

      const stevemacsEvents = monthlyEvents?.filter(e => e.fleet === 'Stevemacs').length || 0;
      const gsfEvents = monthlyEvents?.filter(e => e.fleet === 'Great Southern Fuels').length || 0;

      const requiresAttentionCount = requiresAttention?.length || 0;

      // Calculate top risk vehicles
      const vehicleEventCounts = monthlyEvents?.reduce((acc, event) => {
        const vehicle = event.vehicle_registration;
        if (!acc[vehicle]) {
          acc[vehicle] = { count: 0, fleet: event.fleet };
        }
        acc[vehicle].count++;
        return acc;
      }, {} as Record<string, { count: number; fleet: string }>) || {};

      const topRiskVehicles = Object.entries(vehicleEventCounts)
        .map(([vehicle, data]) => ({
          vehicle,
          events: data.count,
          fleet: data.fleet
        }))
        .sort((a, b) => b.events - a.events)
        .slice(0, 5);

      const analyticsData: GuardianAnalytics = {
        currentMonth: {
          period: currentMonth,
          totalEvents,
          distractionEvents,
          fatigueEvents,
          verifiedEvents,
          verificationRate,
          stevemacsEvents,
          gsfEvents,
          criticalEvents,
          highSeverityEvents,
          requiresAttentionCount
        },
        recentEvents: recentEvents || [],
        requiresAttention: requiresAttention || [],
        monthlyEvents: monthlyEvents || [],
        topRiskVehicles
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
  }, [fleet]);

  const handleExportReport = () => {
    if (!analytics) return;
    
    const reportData = {
      fleet: fleet || 'All Fleets',
      period: analytics.currentMonth.period,
      summary: analytics.currentMonth,
      recentEvents: analytics.recentEvents.slice(0, 10),
      topRiskVehicles: analytics.topRiskVehicles
    };
    
    const dataStr = JSON.stringify(reportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `guardian-report-${fleet || 'all-fleets'}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

  if (!analytics) {
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

  const { currentMonth } = analytics;

  return (
    <DataCentreLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {getDashboardTitle()}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {fleet 
                ? `${fleet} distraction and fatigue events with verification workflows`
                : 'Monitor distraction and fatigue events with verification workflows'
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportReport}>
              <Download className="w-4 h-4 mr-2" />
              Export Report
            </Button>
            <Badge variant="secondary" className="text-green-700 bg-green-100">
              <Shield className="w-4 h-4 mr-1" />
              Live Data
            </Badge>
          </div>
        </div>

        {/* Fleet Navigation (only show on main dashboard) */}
        {!fleet && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => window.location.href = '/data-centre/guardian/smb'}
              className="text-blue-600 border-blue-200 hover:bg-blue-50"
            >
              Stevemacs Analytics ({currentMonth.stevemacsEvents} events)
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/data-centre/guardian/gsf'}
              className="text-green-600 border-green-200 hover:bg-green-50"
            >
              Great Southern Fuels Analytics ({currentMonth.gsfEvents} events)
            </Button>
          </div>
        )}

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Events ({currentMonth.period})
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentMonth.totalEvents.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {currentMonth.distractionEvents} distraction, {currentMonth.fatigueEvents} fatigue
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verification Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentMonth.verificationRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                {currentMonth.verifiedEvents} of {currentMonth.totalEvents} verified
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fleet Distribution</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {fleet ? '100%' : `${currentMonth.stevemacsEvents + currentMonth.gsfEvents}`}
              </div>
              <p className="text-xs text-muted-foreground">
                {fleet 
                  ? `${fleet} events only`
                  : `${currentMonth.stevemacsEvents} SMB, ${currentMonth.gsfEvents} GSF`
                }
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Requiring Attention</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {currentMonth.requiresAttentionCount}
              </div>
              <p className="text-xs text-muted-foreground">
                {currentMonth.criticalEvents} critical, {currentMonth.highSeverityEvents} high severity
              </p>
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

        {/* Charts and Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Event Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Event Type Breakdown
              </CardTitle>
              <CardDescription>
                Current month distraction vs fatigue events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="font-medium">Distraction Events</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{currentMonth.distractionEvents}</div>
                    <div className="text-sm text-gray-500">
                      {currentMonth.distractionEvents > 0 
                        ? ((analytics.monthlyEvents?.filter(e => 
                            e.event_type.toLowerCase().includes('distraction') && 
                            (e.verified || e.confirmation === 'verified')
                          ).length || 0) / currentMonth.distractionEvents * 100).toFixed(1)
                        : '0'
                      }% confirmed
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="font-medium">Fatigue Events</span>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{currentMonth.fatigueEvents}</div>
                    <div className="text-sm text-gray-500">
                      {currentMonth.fatigueEvents > 0
                        ? ((analytics.monthlyEvents?.filter(e => 
                            (e.event_type.toLowerCase().includes('fatigue') || 
                             e.event_type.toLowerCase().includes('microsleep')) && 
                            (e.verified || e.confirmation === 'verified')
                          ).length || 0) / currentMonth.fatigueEvents * 100).toFixed(1)
                        : '0'
                      }% confirmed
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Top Risk Vehicles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Top Risk Vehicles
              </CardTitle>
              <CardDescription>
                Vehicles with highest event frequency this month
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
                    No events recorded this month
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

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
                analytics.recentEvents.slice(0, 10).map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`w-3 h-3 rounded-full ${
                        event.event_type.toLowerCase().includes('distraction') ? 'bg-red-500' : 
                        event.event_type.toLowerCase().includes('fatigue') ? 'bg-orange-500' : 'bg-gray-500'
                      }`}></div>
                      <div>
                        <div className="font-medium">
                          {event.vehicle_registration} - {event.driver_name || 'Unknown Driver'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {event.event_type} • {event.duration_seconds}s • {event.speed_kph} km/h
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
                        {(event.verified || event.confirmation === 'verified') ? 'Confirmed' :
                         event.confirmation === 'criteria not met' ? 'Dismissed' :
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
      </div>
    </DataCentreLayout>
  );
};

export default GuardianDashboard;