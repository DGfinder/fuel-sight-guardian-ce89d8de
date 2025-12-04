import React, { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { SkeletonChart } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertCircle,
  Bell,
  CheckCircle,
  Clock,
  TrendingUp,
  Info,
  History,
  Droplets,
  AlertTriangle,
  Shield,
  Activity,
  Calendar,
  MapPin,
  BarChart3,
  TrendingDown,
  FileText,
  Timer,
} from 'lucide-react';
import { format } from 'date-fns';
import { Tank, TankAlert, DipReading } from '@/types/fuel';
import { useTankHistory } from '@/hooks/useTankHistory';
import { useTankAlerts } from '@/hooks/useTankAlerts';
import { SimplePreviousDips } from '@/components/SimplePreviousDips';
import { LocationTab } from '@/components/LocationTab';
import { ALERT_TYPE_CONFIG } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
  ChartData,
} from 'chart.js';
import AddDipModal from '@/components/modals/AddDipModal';
import { Z_INDEX } from '@/lib/z-index';
import { ModalErrorBoundary } from '@/components/ModalErrorBoundary';
import EditDipModal from '@/components/modals/EditDipModal';
import { useQueryClient } from '@tanstack/react-query';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface TankDetailsModalProps {
  tank: Tank | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Tank details are now included in the Tank type from useTanks (single source of truth)

// Main Component wrapped in React.memo for performance
export const TankDetailsModal = React.memo(function TankDetailsModal({
  tank,
  open,
  onOpenChange,
}: TankDetailsModalProps) {
  const [isDipFormOpen, setIsDipFormOpen] = useState(false);
  const [isEditDipOpen, setIsEditDipOpen] = useState(false);
  const [visibleAlerts, setVisibleAlerts] = useState(10);
  // Tank details are now included in the tank prop from useTanks (single source of truth)
  // TODO: Re-enable mobile gesture support after fixing ref compatibility
  // const modalContentRef = useRef<HTMLDivElement>(null);
  // const { attachListeners } = useModalGestures(() => onOpenChange(false));

  // Reset AddDipModal state when main modal closes
  useEffect(() => {
    if (!open) {
      setIsDipFormOpen(false);
    }
  }, [open]);

  const {
    alerts,
    acknowledgeAlert,
    snoozeAlert,
    isLoading: alertsLoading,
  } = useTankAlerts(tank?.id);

  const queryClient = useQueryClient();

  // Clear all alerts for this tank
  const clearAllAlerts = async () => {
    if (!alerts || alerts.length === 0 || !tank?.id) return;
    const alertIds = alerts.map(a => a.id);
    await supabase
      .from('tank_alerts')
      .update({ acknowledged_at: new Date().toISOString() })
      .in('id', alertIds);
    // Refresh the alerts list
    queryClient.invalidateQueries({ queryKey: ['tank-alerts', tank.id] });
    setVisibleAlerts(10); // Reset pagination
  };

  const dipHistoryQuery = useTankHistory({
    tankId: tank?.id || '',
    enabled: open && !!tank?.id,
    days: 30,
  });
  const dipHistory = useMemo(() => dipHistoryQuery.data?.readings || [], [dipHistoryQuery.data]);
  // Note: Removed redundant refetch() useEffect - the query's `enabled` condition handles this

  const sortedDipHistory = useMemo(() => 
    Array.isArray(dipHistory) ? [...dipHistory].sort((a: DipReading, b: DipReading) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ) : []
  , [dipHistory]);
  
  const last30Dips = useMemo(() => sortedDipHistory.slice(-30), [sortedDipHistory]);

  const volumeChartData: ChartData<'line'> = useMemo(() => ({
    labels:
      last30Dips.length > 0
        ? last30Dips.map((d: DipReading) => {
            try {
              return format(new Date(d.created_at), 'MMM d');
            } catch (e) {
              return 'Invalid Date';
            }
          })
        : ['No Data'],
    datasets: [
      {
        label: 'Volume (L)',
        data:
          last30Dips.length > 0
            ? last30Dips.map((d: DipReading) => typeof d.value === 'number' && isFinite(d.value) ? d.value : 0)
            : [0],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      },
      ...(tank?.min_level
        ? [
            {
              label: 'Minimum Level',
              data: Array(last30Dips.length || 1).fill(tank.min_level),
              borderColor: '#dc2626', // Bright red
              backgroundColor: 'rgba(220, 38, 38, 0.2)',
              borderWidth: 4, // Thicker line
              pointRadius: 0,
              fill: false,
              tension: 0,
              pointHoverRadius: 0,
              pointHitRadius: 0,
            },
          ]
        : []),
    ],
  }), [last30Dips, tank?.min_level]);

  const { burnRateData, burnRateLabels } = useMemo(() => {
    const data: number[] = [];
    const labels: string[] = [];
    
    for (let i = 1; i < last30Dips.length; i++) {
      const current = last30Dips[i];
      const previous = last30Dips[i - 1];
      const daysDiff = (new Date(current.created_at).getTime() - new Date(previous.created_at).getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysDiff > 0 && daysDiff <= 7 && 
          typeof previous.value === 'number' && 
          typeof current.value === 'number') {
        const volumeDiff = previous.value - current.value;
        const dailyBurnRate = volumeDiff / daysDiff;
        
        if (dailyBurnRate > 0 && isFinite(dailyBurnRate)) {
          data.push(dailyBurnRate);
          try {
            labels.push(format(new Date(current.created_at), 'MMM d'));
          } catch (e) {
            labels.push('Invalid Date');
          }
        }
      }
    }
    
    return { burnRateData: data, burnRateLabels: labels };
  }, [last30Dips]);

  const burnRateChartData: ChartData<'line'> = useMemo(() => ({
    labels: burnRateLabels.length > 0 ? burnRateLabels : ['No Data'],
    datasets: [
      {
        label: 'Daily Burn Rate (L/day)',
        data: burnRateData.length > 0 ? burnRateData : [0],
        borderColor: '#f59e0b', // amber-500
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        fill: true,
        tension: 0.4,
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      },
      // Add average burn rate reference line
      ...(tank?.rolling_avg
        ? [
            {
              label: 'Average Burn Rate',
              data: Array(burnRateLabels.length || 1).fill(tank.rolling_avg),
              borderColor: '#6b7280', // gray-500
              borderDash: [5, 5],
              pointRadius: 0,
              fill: false,
              tension: 0,
            },
          ]
        : []),
    ],
  }), [burnRateData, burnRateLabels, tank?.rolling_avg]);

  const volumeChartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          font: { size: 12, weight: 'bold' },
          padding: 20,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        cornerRadius: 8,
        padding: 12,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date',
          font: { size: 12, weight: 'bold' },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Volume (L)',
          font: { size: 12, weight: 'bold' },
        },
        beginAtZero: false,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  }), []);

  const burnRateChartOptions: ChartOptions<'line'> = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          font: { size: 12, weight: 'bold' },
          padding: 20,
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#ffffff',
        bodyColor: '#ffffff',
        cornerRadius: 8,
        padding: 12,
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${Math.round(context.parsed.y)} L/day`;
          }
        }
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date',
          font: { size: 12, weight: 'bold' },
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Burn Rate (L/day)',
          font: { size: 12, weight: 'bold' },
        },
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index',
    },
  }), []);

  // Get tank status based on current level - memoized for performance (must be before early return)
  const tankStatus = useMemo(() => {
    if (!tank?.current_level || !tank?.safe_level) return { status: 'unknown', color: 'gray', percentage: 0 };

    const percentage = (tank.current_level / tank.safe_level) * 100;

    // Use consistent status logic with TankStatusTable.tsx
    // Consider both percentage and days to minimum for accurate status
    const daysToMin = tank.days_to_min_level;

    // Critical: ≤1.5 days OR ≤10% fuel
    if (percentage <= 10 || (daysToMin !== null && daysToMin !== undefined && daysToMin <= 1.5)) {
      return { status: 'critical', color: 'red', percentage };
    }

    // Low: ≤2.5 days OR ≤20% fuel
    if (percentage <= 20 || (daysToMin !== null && daysToMin !== undefined && daysToMin <= 2.5)) {
      return { status: 'low', color: 'orange', percentage };
    }

    // Normal: >2.5 days AND >20% fuel
    if (percentage <= 75) return { status: 'normal', color: 'blue', percentage };
    return { status: 'high', color: 'green', percentage };
  }, [tank?.current_level, tank?.safe_level, tank?.days_to_min_level]);

  // Get the most recent dip reading - memoized
  const latestReading = useMemo(() => {
    if (dipHistory && dipHistory.length > 0) {
      const sortedDips = [...dipHistory].sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return sortedDips[0];
    }
    return null;
  }, [dipHistory]);

  // Early return if no tank - must be after all hooks
  if (!tank) return null;

  // Status badge component
  const StatusBadge = ({ status, color }: { status: string; color: string }) => {
    const getStatusIcon = () => {
      switch (status) {
        case 'critical': return <AlertTriangle className="w-3 h-3" />;
        case 'low': return <AlertCircle className="w-3 h-3" />;
        case 'normal': return <Activity className="w-3 h-3" />;
        case 'high': return <CheckCircle className="w-3 h-3" />;
        default: return <Shield className="w-3 h-3" />;
      }
    };

    const colorClasses = {
      red: 'bg-red-100 text-red-800 border-red-200',
      orange: 'bg-orange-100 text-orange-800 border-orange-200',
      blue: 'bg-blue-100 text-blue-800 border-blue-200',
      green: 'bg-green-100 text-green-800 border-green-200',
      gray: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    return (
      <Badge variant="outline" className={`${colorClasses[color as keyof typeof colorClasses]} font-medium capitalize`}>
        {getStatusIcon()}
        <span className="ml-1">{status}</span>
      </Badge>
    );
  };


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="bg-white/95 backdrop-blur-xl text-gray-900 max-w-4xl w-full p-0 rounded-2xl shadow-2xl border border-gray-200/50"
          style={{ zIndex: Z_INDEX.MODAL_CONTENT }}
        >
          <DialogDescription className="sr-only">
            Tank details and management for {tank?.location}
          </DialogDescription>
          <ModalErrorBoundary onReset={() => onOpenChange(false)}>
          {/* Redesigned Header with status-colored gradient icon */}
          <DialogHeader className="px-6 pt-6 pb-4 bg-gradient-to-r from-slate-50 to-white border-b">
            <div className="flex items-center gap-4">
              <div className={cn(
                "p-3 rounded-xl shadow-lg",
                tankStatus.color === 'red' && "bg-gradient-to-br from-red-500 to-red-600",
                tankStatus.color === 'orange' && "bg-gradient-to-br from-amber-500 to-amber-600",
                tankStatus.color === 'green' && "bg-gradient-to-br from-green-500 to-green-600",
                tankStatus.color === 'blue' && "bg-gradient-to-br from-blue-500 to-blue-600",
                tankStatus.color === 'gray' && "bg-gradient-to-br from-gray-400 to-gray-500"
              )}>
                <Droplets className="w-7 h-7 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900">
                  {tank.location}
                </DialogTitle>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm text-gray-500">{tank.product_type || 'N/A'}</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm text-gray-500">{tank.group_name || 'N/A'}</span>
                  <StatusBadge status={tankStatus.status} color={tankStatus.color} />
                </div>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="overview" className="flex-grow flex flex-col">
            {/* Simplified Tab Navigation */}
            <TabsList className="px-6 py-2 border-b bg-gray-50">
              <TabsTrigger value="overview">
                <Info className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="trends">
                <TrendingUp className="w-4 h-4 mr-2" />
                Trends
              </TabsTrigger>
              <TabsTrigger value="dips">
                <History className="w-4 h-4 mr-2" />
                Previous Dips
              </TabsTrigger>
              <TabsTrigger value="notes">
                <FileText className="w-4 h-4 mr-2" />
                Notes
              </TabsTrigger>
              <TabsTrigger value="alerts">
                <Bell className="w-4 h-4 mr-2" />
                Alerts
                {alerts && alerts.length > 0 && (
                  <Badge className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5">{alerts.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="analytics">
                <BarChart3 className="w-4 h-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="location">
                <MapPin className="w-4 h-4 mr-2" />
                Location
              </TabsTrigger>
            </TabsList>

            <div className="flex-grow overflow-y-auto">
              {/* Redesigned Overview Tab */}
              <TabsContent value="overview" className="p-6 space-y-6">
                {/* Hero KPI Cards - Status colored */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Current Level - Status colored */}
                  <div className={cn(
                    "p-4 rounded-xl border shadow-sm backdrop-blur-sm",
                    tankStatus.color === 'red' && "bg-red-50/90 border-red-200",
                    tankStatus.color === 'orange' && "bg-amber-50/90 border-amber-200",
                    tankStatus.color === 'green' && "bg-green-50/90 border-green-200",
                    tankStatus.color === 'blue' && "bg-blue-50/90 border-blue-200",
                    tankStatus.color === 'gray' && "bg-gray-50/90 border-gray-200"
                  )}>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Current Level</div>
                    <div className="text-3xl font-bold text-gray-900">
                      {Math.round(tankStatus.percentage)}%
                    </div>
                  </div>

                  {/* Trend - replaces duplicated Burn Rate */}
                  <div className={cn(
                    "p-4 rounded-xl border shadow-sm backdrop-blur-sm",
                    tank.trend_direction === 'increasing' && "bg-red-50/90 border-red-200",
                    tank.trend_direction === 'decreasing' && "bg-green-50/90 border-green-200",
                    (!tank.trend_direction || tank.trend_direction === 'stable') && "bg-white/90 border-gray-200"
                  )}>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Trend</div>
                    <div className="text-2xl font-bold text-gray-900 flex items-center gap-1">
                      {tank.trend_direction === 'increasing' && <TrendingUp className="w-5 h-5 text-red-500" />}
                      {tank.trend_direction === 'decreasing' && <TrendingDown className="w-5 h-5 text-green-500" />}
                      {(!tank.trend_direction || tank.trend_direction === 'stable') && <span className="text-gray-400">→</span>}
                      <span>{tank.trend_percent_change ? `${Math.abs(Math.round(tank.trend_percent_change))}%` : 'Stable'}</span>
                    </div>
                  </div>

                  {/* Days to Min - Color coded */}
                  <div className={cn(
                    "p-4 rounded-xl border shadow-sm backdrop-blur-sm",
                    (tank.days_to_min_level ?? 999) <= 2 ? "bg-red-50/90 border-red-200" :
                    (tank.days_to_min_level ?? 999) <= 5 ? "bg-amber-50/90 border-amber-200" :
                    "bg-white/90 border-gray-200"
                  )}>
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Days to Min</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {tank.days_to_min_level ?? 'N/A'}
                    </div>
                  </div>

                  {/* Last Dip - Fixed with fallback */}
                  <div className="p-4 rounded-xl border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Last Dip</div>
                    <div className="text-lg font-bold text-gray-900">
                      {tank.latest_dip_date
                        ? format(new Date(tank.latest_dip_date), 'MMM d')
                        : latestReading
                          ? format(new Date(latestReading.created_at), 'MMM d')
                          : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* LEFT - Live Metrics (prominent, actionable) */}
                  <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-lg">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="w-5 h-5 text-[#008457]" />
                        Live Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Large Fuel Gauge */}
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-slate-50 rounded-xl border border-blue-100">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-sm font-medium text-blue-700">Current Volume</span>
                          <span className="text-xl font-bold text-blue-900">
                            {typeof tank.current_level === 'number' ? tank.current_level.toLocaleString() : 'N/A'} L
                          </span>
                        </div>
                        <Progress value={tankStatus.percentage} className="h-4 mb-2" />
                        <div className="flex justify-between text-xs text-blue-600">
                          <span>0 L</span>
                          <span className="font-semibold">{Math.round(tankStatus.percentage)}%</span>
                          <span>{typeof tank.safe_level === 'number' ? tank.safe_level.toLocaleString() : 'N/A'} L</span>
                        </div>
                      </div>

                      {/* Metric rows with colored icon badges */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-lg border border-gray-100">
                          <div className="p-2 bg-amber-100 rounded-lg">
                            <TrendingDown className="w-4 h-4 text-amber-600" />
                          </div>
                          <div className="flex-1">
                            <span className="text-xs text-gray-500">Burn Rate</span>
                            <p className="font-semibold">{tank.rolling_avg ? `${tank.rolling_avg} L/day` : 'Calculating...'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-lg border border-gray-100">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Calendar className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <span className="text-xs text-gray-500">Last Reading</span>
                            <p className="font-semibold text-sm">
                              {latestReading
                                ? `${latestReading.value.toLocaleString()}L • ${format(new Date(latestReading.created_at), 'MMM d, HH:mm')}`
                                : 'No readings yet'
                              }
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 p-3 bg-gray-50/80 rounded-lg border border-gray-100">
                          <div className="p-2 bg-orange-100 rounded-lg">
                            <Activity className="w-4 h-4 text-orange-600" />
                          </div>
                          <div className="flex-1">
                            <span className="text-xs text-gray-500">Yesterday's Usage</span>
                            <p className="font-semibold">{tank.prev_day_used ? `${tank.prev_day_used.toLocaleString()} L` : 'No data'}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* RIGHT - Tank Information (static details) */}
                  <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Info className="w-5 h-5 text-gray-600" />
                        Tank Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Info grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wider">Depot</span>
                          <p className="font-semibold text-gray-900">{tank.group_name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wider">Product</span>
                          <p className="font-semibold text-gray-900">{tank.product_type || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wider">Min Level</span>
                          <p className="font-semibold text-gray-900">{typeof tank.min_level === 'number' ? tank.min_level.toLocaleString() + ' L' : 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 uppercase tracking-wider">Safe Fill</span>
                          <p className="font-semibold text-gray-900">{typeof tank.safe_level === 'number' ? tank.safe_level.toLocaleString() + ' L' : 'N/A'}</p>
                        </div>
                      </div>

                      {/* Separator */}
                      <div className="border-t border-gray-100"></div>

                      {/* Capacity stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-gray-50/80 rounded-lg border border-gray-100">
                          <span className="text-xs text-gray-500">Capacity</span>
                          <p className="font-semibold">{typeof tank.safe_level === 'number' ? tank.safe_level.toLocaleString() + ' L' : 'N/A'}</p>
                        </div>
                        <div className="p-3 bg-gray-50/80 rounded-lg border border-gray-100">
                          <span className="text-xs text-gray-500">Ullage</span>
                          <p className="font-semibold">
                            {typeof tank.safe_level === 'number' && typeof tank.current_level === 'number'
                              ? (tank.safe_level - tank.current_level).toLocaleString() + ' L'
                              : 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Primary CTA - at bottom of right panel for left-to-right flow */}
                      <Button
                        onClick={() => {
                          setIsDipFormOpen(true);
                        }}
                        className="w-full bg-[#008457] hover:bg-[#008457]/90 text-white font-semibold shadow-md h-12 mt-2"
                      >
                        <Droplets className="w-5 h-5 mr-2" />
                        Add New Dip Reading
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Enhanced Trends Tab with Two Charts */}
              <TabsContent value="trends" className="p-6 space-y-6">
                {/* Volume Trends Chart */}
                <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      Volume Trends
                      {tank.min_level && (
                        <Badge variant="outline" className="text-xs">
                          Min Level: {tank.min_level.toLocaleString()}L
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 relative">
                      {dipHistoryQuery.isLoading ? (
                        <SkeletonChart className="h-full" />
                      ) : last30Dips.length > 0 ? (
                        <Line data={volumeChartData} options={volumeChartOptions} />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                          <BarChart3 className="w-12 h-12 text-gray-300 mb-3" />
                          <h3 className="font-medium text-gray-600 mb-2">No Volume Data</h3>
                          <p className="text-sm text-center">
                            Add dip readings to see volume trends.
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Burn Rate Chart */}
                <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Activity className="w-5 h-5 text-orange-600" />
                      Daily Consumption Rate
                      {tank.rolling_avg && (
                        <Badge variant="outline" className="text-xs">
                          Avg: {tank.rolling_avg}L/day
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 relative">
                      {dipHistoryQuery.isLoading ? (
                        <SkeletonChart className="h-full" />
                      ) : burnRateData.length > 0 ? (
                        <Line data={burnRateChartData} options={burnRateChartOptions} />
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                          <Activity className="w-12 h-12 text-gray-300 mb-3" />
                          <h3 className="font-medium text-gray-600 mb-2">Insufficient Data</h3>
                          <p className="text-sm text-center">
                            Need multiple readings to calculate consumption rates.
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Add Quick Action */}
                <div className="flex justify-center">
                  <Button
                    onClick={() => setIsDipFormOpen(true)}
                    className="bg-[#008457] hover:bg-[#008457]/90 text-white font-semibold shadow-md"
                    size="sm"
                  >
                    <Droplets className="w-4 h-4 mr-2" />
                    Add Reading to Improve Trends
                  </Button>
                </div>
              </TabsContent>

              {/* Simplified Previous Dips Tab */}
              <TabsContent value="dips" className="p-6">
                <SimplePreviousDips 
                  tank={tank} 
                  dipHistory={dipHistory} 
                  isLoading={dipHistoryQuery.isLoading} 
                />
              </TabsContent>

              {/* Enhanced Notes Tab with Tank Details */}
              <TabsContent value="notes" className="p-6 space-y-4">
                {/* Tank Details Card */}
                <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Info className="w-5 h-5 text-gray-600" />
                      Tank Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Address</span>
                        <p className="font-medium">{tank?.address || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Vehicle</span>
                        <p className="font-medium">{tank?.vehicle || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Discharge</span>
                        <p className="font-medium">{tank?.discharge || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">BP Portal</span>
                        <p className="font-medium">{tank?.bp_portal || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Min Level</span>
                        <p className="font-medium">{tank.min_level ? `${tank.min_level.toLocaleString()} L` : 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Delivery Window</span>
                        <p className="font-medium">{tank?.delivery_window || 'N/A'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-xs text-gray-500 uppercase tracking-wider">Afterhours Contact</span>
                        <p className="font-medium">{tank?.afterhours_contact || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Notes Card */}
                <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-gray-600" />
                      Depot Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EditableNotesSection
                      notes={tank?.notes || ''}
                      onSave={async (newNotes) => {
                        await supabase.from('fuel_tanks').update({ notes: newNotes }).eq('id', tank.id);
                        // Notes will be updated on next refetch of useTanks
                      }}
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Alerts Tab with Pagination */}
              <TabsContent value="alerts" className="p-6">
                <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg flex items-center gap-2">
                      Alerts
                      {alerts && alerts.length > 0 && (
                        <Badge className="bg-red-500 text-white text-xs">
                          {alerts.length}
                        </Badge>
                      )}
                    </CardTitle>
                    {alerts && alerts.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllAlerts}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        Clear All
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    {alertsLoading ? (
                      <div className="space-y-3">
                        {[...Array(2)].map((_, i) => (
                          <div key={i} className="animate-pulse p-3 bg-gray-100 rounded-lg">
                            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                          </div>
                        ))}
                      </div>
                    ) : alerts && alerts.length > 0 ? (
                      <div className="space-y-3">
                        {alerts.slice(0, visibleAlerts).map((alert) => (
                          <div
                            key={alert.id}
                            className="p-3 border rounded-lg bg-gray-50/80 border-gray-100"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <Badge variant="outline" className="text-xs mb-1">
                                  {ALERT_TYPE_CONFIG[alert.type]?.label || alert.type}
                                </Badge>
                                <p className="font-medium text-sm">{alert.message}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {format(new Date(alert.created_at), 'MMM d, HH:mm')}
                                </p>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="outline" size="sm" onClick={() => acknowledgeAlert(alert.id)}>
                                  <CheckCircle className="w-3 h-3" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => snoozeAlert(alert.id)}>
                                  <Clock className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {alerts.length > visibleAlerts && (
                          <Button
                            variant="ghost"
                            className="w-full mt-2 text-gray-600 hover:text-gray-800"
                            onClick={() => setVisibleAlerts(v => v + 10)}
                          >
                            Show More ({alerts.length - visibleAlerts} remaining)
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                        <CheckCircle className="w-12 h-12 text-green-400 mb-3" />
                        <p className="text-sm">No active alerts</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Analytics Tab - Enhanced Metrics */}
              <TabsContent value="analytics" className="p-6 space-y-4">
                {/* Consumption Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-600">7-Day Consumption</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {tank.consumption_7_days?.toLocaleString() || 0} L
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-medium text-gray-600">30-Day Consumption</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {tank.consumption_30_days?.toLocaleString() || 0} L
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Trend & Predictability */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {tank.trend_direction === 'increasing' ? (
                          <TrendingUp className="w-4 h-4 text-red-500" />
                        ) : tank.trend_direction === 'decreasing' ? (
                          <TrendingDown className="w-4 h-4 text-green-500" />
                        ) : (
                          <Activity className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="text-sm font-medium text-gray-600">Consumption Trend</span>
                      </div>
                      <p className="text-lg font-bold capitalize">
                        {tank.trend_direction || 'Stable'}
                        {tank.trend_percent_change !== 0 && (
                          <span className={`ml-2 text-sm ${(tank.trend_percent_change || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>
                            {(tank.trend_percent_change || 0) > 0 ? '+' : ''}{tank.trend_percent_change}%
                          </span>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-gray-600">Predictability</span>
                      </div>
                      <Badge className={`
                        ${tank.predictability === 'high' ? 'bg-green-100 text-green-800' : ''}
                        ${tank.predictability === 'medium' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${tank.predictability === 'low' ? 'bg-red-100 text-red-800' : ''}
                        ${tank.predictability === 'unknown' ? 'bg-gray-100 text-gray-800' : ''}
                      `}>
                        {tank.predictability?.toUpperCase() || 'UNKNOWN'}
                      </Badge>
                      {tank.consumption_stddev ? (
                        <p className="text-xs text-gray-500 mt-1">±{tank.consumption_stddev} L/day variance</p>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>

                {/* Data Quality & Peak */}
                <div className="grid grid-cols-2 gap-3">
                  <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-600">Data Freshness</span>
                      </div>
                      <Badge className={`
                        ${tank.data_quality === 'fresh' ? 'bg-green-100 text-green-800' : ''}
                        ${tank.data_quality === 'stale' ? 'bg-yellow-100 text-yellow-800' : ''}
                        ${tank.data_quality === 'outdated' ? 'bg-red-100 text-red-800' : ''}
                        ${tank.data_quality === 'no_data' ? 'bg-gray-100 text-gray-800' : ''}
                      `}>
                        {tank.data_quality?.toUpperCase().replace('_', ' ') || 'NO DATA'}
                      </Badge>
                      {tank.days_since_last_dip !== undefined && tank.days_since_last_dip < 999 && (
                        <p className="text-xs text-gray-500 mt-1">{tank.days_since_last_dip} days since last dip</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-orange-600" />
                        <span className="text-sm font-medium text-gray-600">Peak Daily Usage</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {tank.peak_daily_consumption?.toLocaleString() || 0} L/day
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Last Refill */}
                <Card className="border border-gray-200 bg-white/90 backdrop-blur-sm shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Droplets className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-600">Last Refill</span>
                    </div>
                    {tank.last_refill_date ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold">{format(new Date(tank.last_refill_date), 'MMM d, yyyy')}</p>
                          <p className="text-sm text-gray-500">{tank.last_refill_volume?.toLocaleString()} L delivered</p>
                        </div>
                        {tank.avg_refill_interval_days && (
                          <div className="text-right">
                            <p className="text-sm text-gray-500">Avg cycle</p>
                            <p className="font-medium">{tank.avg_refill_interval_days} days</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-500">No refill detected in last 30 days</p>
                    )}
                  </CardContent>
                </Card>

                {/* Order Recommendation */}
                <Card className={`
                  ${tank.order_urgency === 'order_now' ? 'border-red-300 bg-red-50' : ''}
                  ${tank.order_urgency === 'order_soon' ? 'border-yellow-300 bg-yellow-50' : ''}
                `}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      <span className="text-sm font-medium text-gray-600">Order Recommendation</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`
                        ${tank.order_urgency === 'order_now' ? 'bg-red-500 text-white' : ''}
                        ${tank.order_urgency === 'order_soon' ? 'bg-yellow-500 text-white' : ''}
                        ${tank.order_urgency === 'ok' ? 'bg-green-100 text-green-800' : ''}
                      `}>
                        {tank.order_urgency === 'order_now' ? 'ORDER NOW' :
                         tank.order_urgency === 'order_soon' ? 'ORDER SOON' : 'OK'}
                      </Badge>
                      {tank.optimal_order_date && (
                        <span className="text-sm text-gray-600">
                          Order by {format(new Date(tank.optimal_order_date), 'MMM d')} (3-day lead time)
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Anomaly Alert */}
                {tank.is_anomaly && (
                  <Card className="border-orange-300 bg-orange-50">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600" />
                        <div>
                          <p className="font-medium text-orange-800">Anomaly Detected</p>
                          <p className="text-sm text-orange-700">
                            {tank.anomaly_type === 'high_usage' ? 'Usage is significantly higher than normal' :
                             tank.anomaly_type === 'low_usage' ? 'Usage is significantly lower than normal' :
                             'Unusual consumption pattern detected'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Group Comparison & Efficiency */}
                <div className="grid grid-cols-2 gap-3">
                  {tank.consumption_vs_group_percent !== undefined && tank.consumption_vs_group_percent !== null && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-600">vs Group Average</span>
                        </div>
                        <p className={`text-lg font-bold ${
                          tank.consumption_vs_group_percent > 20 ? 'text-red-600' :
                          tank.consumption_vs_group_percent < -20 ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {tank.consumption_vs_group_percent > 0 ? '+' : ''}{tank.consumption_vs_group_percent}%
                        </p>
                      </CardContent>
                    </Card>
                  )}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-600">Efficiency Trend</span>
                      </div>
                      <Badge className={`
                        ${tank.efficiency_trend === 'improving' ? 'bg-green-100 text-green-800' : ''}
                        ${tank.efficiency_trend === 'degrading' ? 'bg-red-100 text-red-800' : ''}
                        ${tank.efficiency_trend === 'stable' ? 'bg-gray-100 text-gray-800' : ''}
                      `}>
                        {tank.efficiency_trend?.toUpperCase() || 'STABLE'}
                      </Badge>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Location Tab */}
              <TabsContent value="location" className="p-0">
                <LocationTab tank={tank} />
              </TabsContent>

            </div>
          </Tabs>

          </ModalErrorBoundary>
        </DialogContent>
      </Dialog>

      {/* AddDipModal rendered separately to avoid overlay conflicts */}
      {isDipFormOpen && (
        <AddDipModal
          open={isDipFormOpen}
          onOpenChange={(isOpen) => {
            setIsDipFormOpen(isOpen);
            // Refetch dip history when modal closes to ensure latest data is displayed
            if (!isOpen) {
              dipHistoryQuery.refetch();
            }
          }}
          initialTankId={tank?.id}
          initialGroupId={tank?.group_id}
          onSubmit={async () => {
            // This is a dummy function to satisfy the prop type.
            // The modal handles its own submission.
          }}
        />
      )}
      <EditDipModal
        isOpen={isEditDipOpen}
        onClose={() => setIsEditDipOpen(false)}
        initialTankId={tank?.id}
        initialGroupId={tank?.group_id}
      />
    </>
  );
});

function EditableNotesSection({ notes: initialNotes, onSave }: { notes: string; onSave: (newNotes: string) => Promise<void> }) {
  const [notes, setNotes] = React.useState(initialNotes);
  const [editing, setEditing] = React.useState(false);
  const [tempNotes, setTempNotes] = React.useState(notes);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    setNotes(initialNotes);
    setTempNotes(initialNotes);
  }, [initialNotes]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(tempNotes);
      setNotes(tempNotes);
      setEditing(false);
      // Invalidate queries to refetch tank data
      await queryClient.invalidateQueries({ queryKey: ['tanks'] });
      await queryClient.invalidateQueries({ queryKey: ['tank', tempNotes] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full">
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            className="w-full border rounded px-3 py-2 min-h-[100px]"
            value={tempNotes}
            onChange={e => setTempNotes(e.target.value)}
            placeholder="Enter depot notes here..."
            autoFocus
            disabled={saving}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-gray-500">
          <FileText className="w-12 h-12 text-gray-300 mb-3" />
          {notes ? (
            <p className="text-sm text-center whitespace-pre-line text-gray-700 mb-4">{notes}</p>
          ) : (
            <p className="text-sm text-center">No notes available</p>
          )}
          <Button size="sm" onClick={() => setEditing(true)}>
            {notes ? "Edit Notes" : "Add Notes"}
          </Button>
        </div>
      )}
    </div>
  );
}