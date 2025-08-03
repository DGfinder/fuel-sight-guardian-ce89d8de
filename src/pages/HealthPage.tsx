import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Activity, Database, Wifi, Clock, Users, AlertTriangle } from 'lucide-react';

interface SystemMetric {
  name: string;
  value: string;
  status: 'healthy' | 'warning' | 'critical';
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

function HealthPage() {
  // Fetch system metrics
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: async (): Promise<SystemMetric[]> => {
      try {
        // Check database connectivity
        const { data: dbTest, error: dbError } = await supabase.from('tanks').select('count').limit(1);
        const dbStatus: 'healthy' | 'warning' | 'critical' = dbError ? 'critical' : 'healthy';

        // Check recent tank readings
        const { data: recentReadings } = await supabase
          .from('tank_dips')
          .select('created_at')
          .order('created_at', { ascending: false })
          .limit(1);

        const lastReading = recentReadings?.[0]?.created_at;
        const timeSinceLastReading = lastReading 
          ? Math.floor((new Date().getTime() - new Date(lastReading).getTime()) / (1000 * 60))
          : null;

        const readingStatus: 'healthy' | 'warning' | 'critical' = 
          !timeSinceLastReading ? 'critical' :
          timeSinceLastReading > 120 ? 'warning' : 'healthy';

        // Check user count
        const { data: userCount } = await supabase
          .from('profiles')
          .select('id', { count: 'exact' });

        // Check active tanks
        const { data: tankCount } = await supabase
          .from('tanks')
          .select('id', { count: 'exact' });

        // Check alerts
        const { data: alertCount } = await supabase
          .from('tank_alerts')
          .select('id', { count: 'exact' })
          .eq('resolved', false);

        return [
          {
            name: 'Database Connection',
            value: dbStatus === 'healthy' ? 'Connected' : 'Disconnected',
            status: dbStatus,
            icon: Database,
            description: 'Supabase database connectivity status'
          },
          {
            name: 'Data Freshness',
            value: timeSinceLastReading 
              ? `${timeSinceLastReading} min ago`
              : 'No recent data',
            status: readingStatus,
            icon: Clock,
            description: 'Time since last tank reading'
          },
          {
            name: 'Active Users',
            value: userCount?.count?.toString() || '0',
            status: 'healthy',
            icon: Users,
            description: 'Total registered users in system'
          },
          {
            name: 'Monitored Tanks',
            value: tankCount?.count?.toString() || '0',
            status: 'healthy',
            icon: Activity,
            description: 'Total tanks being monitored'
          },
          {
            name: 'Active Alerts',
            value: alertCount?.count?.toString() || '0',
            status: (alertCount?.count || 0) > 0 ? 'warning' : 'healthy',
            icon: AlertTriangle,
            description: 'Unresolved alerts requiring attention'
          },
          {
            name: 'System Status',
            value: 'Operational',
            status: 'healthy',
            icon: Wifi,
            description: 'Overall system health status'
          }
        ];
      } catch (error) {
        console.error('Error fetching system health:', error);
        return [];
      }
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'warning': return 'bg-yellow-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-green-100 text-green-800">Healthy</Badge>;
      case 'warning': return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'critical': return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto w-full py-8 px-2 sm:px-4">
        <h1 className="text-3xl font-bold mb-6 text-center">System Health</h1>
        <div className="text-center py-8">Loading system metrics...</div>
      </div>
    );
  }

  const healthyCount = metrics?.filter(m => m.status === 'healthy').length || 0;
  const warningCount = metrics?.filter(m => m.status === 'warning').length || 0;
  const criticalCount = metrics?.filter(m => m.status === 'critical').length || 0;
  const totalMetrics = metrics?.length || 0;

  const overallStatus = criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'healthy';

  return (
    <div className="max-w-4xl mx-auto w-full py-8 px-2 sm:px-4 animate-fade-in">
      <h1 className="text-3xl font-bold mb-6 text-center">System Health</h1>
      
      {/* Overall Status Summary */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Overall Status</h2>
          {getStatusBadge(overallStatus)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{healthyCount}</div>
            <div className="text-sm text-muted-foreground">Healthy</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{warningCount}</div>
            <div className="text-sm text-muted-foreground">Warning</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{criticalCount}</div>
            <div className="text-sm text-muted-foreground">Critical</div>
          </div>
        </div>
      </Card>

      {/* Individual Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {metrics?.map((metric, index) => {
          const IconComponent = metric.icon;
          return (
            <Card key={index} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-full ${getStatusColor(metric.status)}`}>
                    <IconComponent className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium">{metric.name}</h3>
                    <p className="text-sm text-muted-foreground">{metric.description}</p>
                  </div>
                </div>
                {getStatusBadge(metric.status)}
              </div>
              <div className="text-2xl font-bold mt-2">{metric.value}</div>
            </Card>
          );
        })}
      </div>

      {/* Refresh Info */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        Last updated: {new Date().toLocaleTimeString()} • Refreshes every 30 seconds
      </div>
    </div>
  );
}

export default HealthPage;