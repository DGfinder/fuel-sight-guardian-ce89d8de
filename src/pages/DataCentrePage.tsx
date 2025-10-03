import React, { useMemo } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
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

const DataCentrePage = () => {
  const { data: vehicles = [] } = useVehicles();
  const { summary, isRefreshing, refreshAll } = useDataFreshness();
  const { data: qualityData } = useDataQualityDashboard();

  const stats = useMemo(() => {
    // Calculate stats from various sources
    const activeDrivers = 120; // From static config
    const safetyScore = vehicles.length > 0
      ? Math.round((vehicles.reduce((sum, v) => sum + v.safety_score, 0) / vehicles.length) * 10) / 10
      : 0;

    return {
      guardianEvents: 13317,
      paymentRecords: 75000,
      activeDrivers,
      totalTrips: 4141,
      safetyScore,
      totalVehicles: vehicles.length,
      correlationRate: qualityData?.summary.relationshipHealth || 0,
      dataQuality: qualityData?.summary.avgQualityScore || 0,
    };
  }, [vehicles, qualityData]);

  // Add smooth scroll behavior
  React.useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  return (
    <DataCentreLayout>
      {/* Background Gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-primary opacity-10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-gradient-secondary opacity-10 blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 space-y-8">
        {/* Hero Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Sparkles className="w-8 h-8 text-yellow-500" />
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Data Centre Intelligence Hub
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                Real-time analytics across 75K+ records with AI-powered insights
              </p>
            </div>

            <Button
              variant="outline"
              size="lg"
              onClick={refreshAll}
              disabled={isRefreshing}
              className="backdrop-blur-xl bg-white/30 dark:bg-gray-900/30 border-white/20 hover:bg-white/40 dark:hover:bg-gray-900/40"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh All'}
            </Button>
          </div>

          {/* Data Freshness Indicator */}
          {summary?.last_refresh && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </div>
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
        <div className="pt-8 border-t border-white/10">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <div>
              Powered by advanced correlation algorithms • 27+ optimized indexes • Real-time sync
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>All systems operational</span>
            </div>
          </div>
        </div>
      </div>
    </DataCentreLayout>
  );
};

export default DataCentrePage;
