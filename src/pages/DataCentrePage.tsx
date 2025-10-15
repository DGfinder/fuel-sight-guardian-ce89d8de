import React, { useMemo } from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DataCentreLayout from '@/components/DataCentreLayout';
import { HeroStatsGrid } from '@/components/data-centre/HeroStatsGrid';
import { QualityDashboard } from '@/components/data-centre/QualityDashboard';
import { EventTimelineChart } from '@/components/data-centre/EventTimelineChart';
import { RelationshipExplorer } from '@/components/data-centre/RelationshipExplorer';
import { QuickActionsHub } from '@/components/data-centre/QuickActionsHub';
import { useVehicles } from '@/hooks/useVehicles';
import { useDataFreshness } from '@/hooks/useDataFreshness';
import { useDataQualityDashboard } from '@/hooks/useDataQualityDashboard';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const DataCentrePage = () => {
  const { data: vehicles = [] } = useVehicles();
  const { summary, isRefreshing, refreshAll } = useDataFreshness();
  const { data: qualityData } = useDataQualityDashboard();

  // Query real Guardian events count
  const { data: guardianCount } = useQuery({
    queryKey: ['guardian-events-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('guardian_events')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Query real Captive Payments count
  const { data: paymentsCount } = useQuery({
    queryKey: ['captive-payments-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('captive_payments_bol')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query real MtData trips count
  const { data: tripsCount } = useQuery({
    queryKey: ['mtdata-trips-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('mtdata_trip_history')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Query real active drivers count
  const { data: driversCount } = useQuery({
    queryKey: ['active-drivers-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('drivers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Active');
      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
  });

  const stats = useMemo(() => {
    const safetyScore = vehicles.length > 0
      ? Math.round((vehicles.reduce((sum, v) => sum + v.safety_score, 0) / vehicles.length) * 10) / 10
      : 0;

    return {
      guardianEvents: guardianCount || 0,
      paymentRecords: paymentsCount || 0,
      activeDrivers: driversCount || 0,
      totalTrips: tripsCount || 0,
      safetyScore,
      totalVehicles: vehicles.length,
      correlationRate: qualityData?.summary.relationshipHealth || 0,
      dataQuality: qualityData?.summary.avgQualityScore || 0,
    };
  }, [vehicles, qualityData, guardianCount, paymentsCount, driversCount, tripsCount]);

  // Add smooth scroll behavior
  React.useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  return (
    <DataCentreLayout>
      {/* Background Gradient - Professional */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-professional opacity-5 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-slate opacity-5 blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 space-y-8">
        {/* Hero Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Database className="w-8 h-8 text-slate-600 dark:text-slate-400" />
                <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                  Data Centre
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-lg">
                Analytics and insights across {(stats.guardianEvents + stats.paymentRecords + stats.totalTrips).toLocaleString()}+ fleet management records
              </p>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={refreshAll}
              disabled={isRefreshing}
              className="border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh All'}
            </Button>
          </div>

          {/* Data Freshness Indicator */}
          {summary?.last_refresh && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>Last updated {formatDistanceToNow(new Date(summary.last_refresh), { addSuffix: true })}</span>
            </div>
          )}
        </div>

        {/* Hero Stats Grid */}
        <HeroStatsGrid stats={stats} />

        {/* Data Quality Dashboard */}
        <div className="animate-fade-in" style={{ animationDelay: '0.6s', animationFillMode: 'both' }}>
          <QualityDashboard />
        </div>

        {/* Event Timeline Chart */}
        <div className="animate-fade-in" style={{ animationDelay: '0.8s', animationFillMode: 'both' }}>
          <EventTimelineChart />
        </div>

        {/* Relationship Explorer */}
        <div className="animate-fade-in" style={{ animationDelay: '1.0s', animationFillMode: 'both' }}>
          <RelationshipExplorer />
        </div>

        {/* Quick Actions Hub */}
        <div className="animate-fade-in" style={{ animationDelay: '1.2s', animationFillMode: 'both' }}>
          <QuickActionsHub />
        </div>

        {/* Footer Info */}
        <div className="pt-8 border-t border-slate-200/50 dark:border-slate-700/50">
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <div>
              Advanced correlation algorithms • 27+ optimized indexes • Real-time synchronization
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Systems operational</span>
            </div>
          </div>
        </div>
      </div>
    </DataCentreLayout>
  );
};

export default DataCentrePage;
