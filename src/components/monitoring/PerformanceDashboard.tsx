import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Zap, 
  Clock, 
  Users, 
  AlertTriangle, 
  TrendingUp,
  Download,
  RefreshCw
} from 'lucide-react';
import { usePerformanceMonitor } from '@/lib/performance-monitor';

interface PerformanceCardProps {
  title: string;
  value: string | number;
  unit?: string;
  status: 'good' | 'warning' | 'poor';
  description: string;
  icon: React.ComponentType<any>;
  trend?: 'up' | 'down' | 'stable';
}

function PerformanceCard({ 
  title, 
  value, 
  unit = '', 
  status, 
  description, 
  icon: Icon,
  trend 
}: PerformanceCardProps) {
  const statusColors = {
    good: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-amber-600 bg-amber-50 border-amber-200',
    poor: 'text-red-600 bg-red-50 border-red-200'
  };

  const trendIcons = {
    up: '↗️',
    down: '↘️',
    stable: '➡️'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`p-6 ${statusColors[status]}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-white">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-xs opacity-75">{description}</p>
            </div>
          </div>
          {trend && (
            <span className="text-lg">{trendIcons[trend]}</span>
          )}
        </div>
        
        <div className="mt-4 flex items-baseline space-x-2">
          <span className="text-3xl font-bold">
            {typeof value === 'number' ? value.toFixed(1) : value}
          </span>
          <span className="text-sm font-medium opacity-75">{unit}</span>
        </div>
      </Card>
    </motion.div>
  );
}

interface WebVitalsProps {
  cls: number | null;
  fid: number | null;
  fcp: number | null;
  lcp: number | null;
  ttfb: number | null;
}

function WebVitalsSection({ cls, fid, fcp, lcp, ttfb }: WebVitalsProps) {
  const getVitalStatus = (metric: string, value: number | null): 'good' | 'warning' | 'poor' => {
    if (value === null) return 'warning';
    
    switch (metric) {
      case 'cls':
        if (value <= 0.1) return 'good';
        if (value <= 0.25) return 'warning';
        return 'poor';
      case 'fid':
        if (value <= 100) return 'good';
        if (value <= 300) return 'warning';
        return 'poor';
      case 'fcp':
        if (value <= 1800) return 'good';
        if (value <= 3000) return 'warning';
        return 'poor';
      case 'lcp':
        if (value <= 2500) return 'good';
        if (value <= 4000) return 'warning';
        return 'poor';
      case 'ttfb':
        if (value <= 600) return 'good';
        if (value <= 1500) return 'warning';
        return 'poor';
      default:
        return 'warning';
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center space-x-2">
        <Zap className="h-5 w-5" />
        <span>Core Web Vitals</span>
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <PerformanceCard
          title="CLS"
          value={cls || 'N/A'}
          status={getVitalStatus('cls', cls)}
          description="Cumulative Layout Shift"
          icon={Activity}
        />
        
        <PerformanceCard
          title="FID"
          value={fid || 'N/A'}
          unit="ms"
          status={getVitalStatus('fid', fid)}
          description="First Input Delay"
          icon={Clock}
        />
        
        <PerformanceCard
          title="FCP"
          value={fcp || 'N/A'}
          unit="ms"
          status={getVitalStatus('fcp', fcp)}
          description="First Contentful Paint"
          icon={Zap}
        />
        
        <PerformanceCard
          title="LCP"
          value={lcp || 'N/A'}
          unit="ms"
          status={getVitalStatus('lcp', lcp)}
          description="Largest Contentful Paint"
          icon={TrendingUp}
        />
        
        <PerformanceCard
          title="TTFB"
          value={ttfb || 'N/A'}
          unit="ms"
          status={getVitalStatus('ttfb', ttfb)}
          description="Time to First Byte"
          icon={Activity}
        />
      </div>
    </div>
  );
}

interface SessionMetricsProps {
  userInteractions: number;
  errorCount: number;
  sessionDuration: number;
  pageViews: number;
}

function SessionMetricsSection({ 
  userInteractions, 
  errorCount, 
  sessionDuration, 
  pageViews 
}: SessionMetricsProps) {
  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center space-x-2">
        <Users className="h-5 w-5" />
        <span>Session Metrics</span>
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <PerformanceCard
          title="Interactions"
          value={userInteractions || 0}
          status={userInteractions > 10 ? 'good' : userInteractions > 5 ? 'warning' : 'poor'}
          description="User interactions count"
          icon={Users}
        />
        
        <PerformanceCard
          title="Errors"
          value={errorCount || 0}
          status={errorCount === 0 ? 'good' : errorCount < 3 ? 'warning' : 'poor'}
          description="JavaScript errors"
          icon={AlertTriangle}
        />
        
        <PerformanceCard
          title="Session Time"
          value={formatDuration(sessionDuration || 0)}
          status={sessionDuration > 300000 ? 'good' : sessionDuration > 60000 ? 'warning' : 'poor'}
          description="Time spent on site"
          icon={Clock}
        />
        
        <PerformanceCard
          title="Page Views"
          value={pageViews || 1}
          status={pageViews > 3 ? 'good' : pageViews > 1 ? 'warning' : 'poor'}
          description="Pages visited"
          icon={Activity}
        />
      </div>
    </div>
  );
}

interface RecentEventsProps {
  events: Array<{
    type: string;
    timestamp: number;
    data?: any;
  }>;
}

function RecentEventsSection({ events }: RecentEventsProps) {
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'performance_metric':
        return <Zap className="h-4 w-4" />;
      case 'custom_event':
        return <Activity className="h-4 w-4" />;
      case 'api_response':
        return <TrendingUp className="h-4 w-4" />;
      case 'tank_load':
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'performance_metric':
        return 'bg-blue-100 text-blue-800';
      case 'custom_event':
        return 'bg-green-100 text-green-800';
      case 'api_response':
        return 'bg-purple-100 text-purple-800';
      case 'tank_load':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center space-x-2">
        <Activity className="h-5 w-5" />
        <span>Recent Events</span>
      </h2>
      
      <Card className="p-4">
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No events recorded yet</p>
          ) : (
            events.slice(-10).reverse().map((event, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center space-x-3 p-2 rounded-lg bg-gray-50"
              >
                <div className={`p-1 rounded ${getEventColor(event.type)}`}>
                  {getEventIcon(event.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium capitalize">
                      {event.type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                  {event.data && (
                    <p className="text-xs text-gray-600 mt-1">
                      {JSON.stringify(event.data).slice(0, 50)}...
                    </p>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

export function PerformanceDashboard() {
  const { getMetrics, getSession } = usePerformanceMonitor();
  const [metrics, setMetrics] = useState(getMetrics());
  const [session, setSession] = useState(getSession());
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    // Update metrics every 5 seconds
    const interval = setInterval(() => {
      setMetrics(getMetrics());
      setSession(getSession());
      
      // Load events from localStorage
      try {
        const storedEvents = JSON.parse(localStorage.getItem('performance_analytics') || '[]');
        setEvents(storedEvents);
      } catch (error) {
        console.error('Failed to load events:', error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [getMetrics, getSession]);

  const exportData = () => {
    const data = {
      metrics,
      session,
      events,
      exportTime: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-data-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearData = () => {
    localStorage.removeItem('performance_analytics');
    setEvents([]);
  };

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performance Dashboard</h1>
          <p className="text-gray-600">Real-time application performance monitoring</p>
        </div>
        
        <div className="flex space-x-2">
          <Button onClick={exportData} variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
          <Button onClick={clearData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear Data
          </Button>
        </div>
      </div>

      <WebVitalsSection
        cls={metrics.cls}
        fid={metrics.fid}
        fcp={metrics.fcp}
        lcp={metrics.lcp}
        ttfb={metrics.ttfb}
      />

      <SessionMetricsSection
        userInteractions={metrics.userInteractions || 0}
        errorCount={metrics.errorCount || 0}
        sessionDuration={session.performance?.sessionDuration || 0}
        pageViews={session.pageViews?.length || 1}
      />

      <RecentEventsSection events={events} />

      {/* Performance Score */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold mb-4">Performance Score</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {metrics.lcp && metrics.fcp ? 
                Math.max(0, 100 - (metrics.lcp + metrics.fcp) / 100).toFixed(0) : 
                'N/A'
              }
            </div>
            <p className="text-sm text-gray-600">Overall Score</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {session.pageViews?.length || 1}
            </div>
            <p className="text-sm text-gray-600">Pages Visited</p>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {events.filter(e => e.type === 'api_response').length}
            </div>
            <p className="text-sm text-gray-600">API Calls</p>
          </div>
        </div>
      </Card>
    </div>
  );
}