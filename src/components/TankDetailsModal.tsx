import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  Edit,
  Flag,
  History,
  X,
  Phone,
  Droplets,
  BellOff,
  AlertTriangle,
  Shield,
  Zap,
  Activity,
  Gauge,
  Calendar,
  MapPin,
  Fuel,
  BarChart3,
  TrendingDown,
  FileText,
  Settings,
  Timer,
} from 'lucide-react';
import { format } from 'date-fns';
import { Tank, TankAlert, DipReading } from '@/types/fuel';
import { useTankHistory } from '@/hooks/useTankHistory';
import { useTankAlerts } from '@/hooks/useTankAlerts';
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

// Main Component - No React.memo
export function TankDetailsModal({
  tank,
  open,
  onOpenChange,
}: TankDetailsModalProps) {
  const [isDipFormOpen, setIsDipFormOpen] = useState(false);
  const [isEditDipOpen, setIsEditDipOpen] = useState(false);

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
    error: alertsError,
  } = useTankAlerts(tank?.id);

  const dipHistoryQuery = useTankHistory({
    tankId: tank?.id,
    enabled: open && !!tank?.id,
    days: 30,
  });
  const dipHistory = dipHistoryQuery.data || [];

  useEffect(() => {
    if (open && tank?.id) {
      dipHistoryQuery.refetch();
    }
  }, [open, tank?.id, dipHistoryQuery.refetch]);

  if (!tank) return null;

  const sortedDipHistory = [...dipHistory].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const last30Dips = sortedDipHistory.slice(-30);

  const volumeChartData: ChartData<'line'> = {
    labels:
      last30Dips.length > 0
        ? last30Dips.map((d: DipReading) => format(new Date(d.created_at), 'MMM d'))
        : ['No Data'],
    datasets: [
      {
        label: 'Volume (L)',
        data:
          last30Dips.length > 0
            ? last30Dips.map((d: DipReading) => d.value)
            : [0],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      },
      ...(tank.min_level
        ? [
            {
              label: 'Minimum Level',
              data: Array(last30Dips.length || 1).fill(tank.min_level),
              borderColor: '#ef4444',
              borderDash: [5, 5],
              pointRadius: 0,
              fill: false,
              tension: 0,
            },
          ]
        : []),
    ],
  };

  const burnRateData = [];
  const burnRateLabels = [];
  
  for (let i = 1; i < last30Dips.length; i++) {
    const current = last30Dips[i];
    const previous = last30Dips[i - 1];
    const daysDiff = (new Date(current.created_at).getTime() - new Date(previous.created_at).getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysDiff > 0 && daysDiff <= 7) {
      const volumeDiff = previous.value - current.value;
      const dailyBurnRate = volumeDiff / daysDiff;
      
      if (dailyBurnRate > 0) {
        burnRateData.push(dailyBurnRate);
        burnRateLabels.push(format(new Date(current.created_at), 'MMM d'));
      }
    }
  }

  const burnRateChartData: ChartData<'line'> = {
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
      ...(tank.rolling_avg
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
  };

  const volumeChartOptions: ChartOptions<'line'> = {
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
  };

  const burnRateChartOptions: ChartOptions<'line'> = {
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
  };

  // -- Depot Notes Logic --
  const depotNotes = 'No notes available.';

  // Get tank status based on current level
  const getTankStatus = () => {
    if (!tank.current_level || !tank.safe_level) return { status: 'unknown', color: 'gray', percentage: 0 };
    
    const percentage = (tank.current_level / tank.safe_level) * 100;
    
    if (percentage <= 20) return { status: 'critical', color: 'red', percentage };
    if (percentage <= 40) return { status: 'low', color: 'orange', percentage };
    if (percentage <= 75) return { status: 'normal', color: 'blue', percentage };
    return { status: 'high', color: 'green', percentage };
  };

  const tankStatus = getTankStatus();

  // Get the most recent dip reading
  const getLatestReading = () => {
    if (dipHistory && dipHistory.length > 0) {
      const sortedDips = [...dipHistory].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      return sortedDips[0];
    }
    return null;
  };

  const latestReading = getLatestReading();

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
      <Badge variant="outline" className={`${colorClasses[color]} font-medium capitalize`}>
        {getStatusIcon()}
        <span className="ml-1">{status}</span>
      </Badge>
    );
  };

  // Alerts rendering logic
  const renderAlert = (alert) => {
    const config = ALERT_TYPE_CONFIG[alert.type] || {};
    const Icon = config.icon || AlertCircle;
    const isSnoozed = alert.snoozed_until && new Date(alert.snoozed_until) > new Date();
    const isAcknowledged = !!alert.acknowledged_at;
    
    return (
      <div
        key={alert.id}
        className={`group flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${
          config.borderColor || 'border-gray-200'
        } ${config.bgColor || 'bg-gray-50'} ${
          (isSnoozed || isAcknowledged) ? 'opacity-60' : ''
        }`}
      >
        <div className={`p-2 rounded-lg ${config.bgColor || 'bg-gray-100'}`}>
          <Icon className={`w-5 h-5 ${config.color || 'text-gray-500'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={`${config.color || ''} font-medium`}>
                  {config.label || alert.type}
                </Badge>
                {isSnoozed && (
                  <Badge variant="outline" className="text-gray-500 bg-gray-50">
                    <BellOff className="w-3 h-3 mr-1" /> Snoozed
                  </Badge>
                )}
                {isAcknowledged && (
                  <Badge variant="outline" className="text-green-600 bg-green-50">
                    <CheckCircle className="w-3 h-3 mr-1" /> Acknowledged
                  </Badge>
                )}
              </div>
              <p className="font-medium text-gray-900 mb-1">{alert.message}</p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                {format(new Date(alert.created_at), 'MMM d, HH:mm')}
              </div>
            </div>
            {!isAcknowledged && !isSnoozed && (
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="hover:bg-green-50 hover:text-green-600 hover:border-green-200"
                >
                  <CheckCircle className="w-4 h-4 mr-1" /> Acknowledge
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => snoozeAlert(alert.id)}
                  className="hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                >
                  <Clock className="w-4 h-4 mr-1" /> Snooze
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-white text-gray-900 max-w-3xl w-full p-0 rounded-xl shadow-xl border" style={{ zIndex: Z_INDEX.MODAL_CONTENT }}>
          <DialogDescription className="sr-only">
            Tank details and management for {tank?.location}
          </DialogDescription>
          <ModalErrorBoundary onReset={() => onOpenChange(false)}>
          {/* Simplified Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Droplets className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold text-gray-900">
                    {tank.location}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600">{tank.product_type || 'N/A'}</span>
                    <StatusBadge status={tankStatus.status} color={tankStatus.color} />
                  </div>
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
            </TabsList>

            <div className="flex-grow overflow-y-auto">
              {/* Simplified Overview Tab */}
              <TabsContent value="overview" className="p-6 space-y-6">
                {/* Simplified Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <div className="text-xs text-gray-500 mb-1">Current Level</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {Math.round(tankStatus.percentage)}%
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <div className="text-xs text-gray-500 mb-1">Burn Rate</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {tank.rolling_avg ? `${tank.rolling_avg}L/d` : 'N/A'}
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <div className="text-xs text-gray-500 mb-1">Days to Min</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {tank.days_to_min_level ?? 'N/A'}
                    </div>
                  </div>
                  
                  <div className="p-3 bg-gray-50 rounded-lg border">
                    <div className="text-xs text-gray-500 mb-1">Last Dip</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {tank.latest_dip_date ? format(new Date(tank.latest_dip_date), 'MMM d') : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Simplified Tank Information Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Tank Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm text-gray-500">Depot</span>
                          <p className="font-medium">{tank.group_name || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Product</span>
                          <p className="font-medium">{tank.product_type || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Min Level</span>
                          <p className="font-medium">{typeof tank.min_level === 'number' ? tank.min_level.toLocaleString() : 'N/A'}</p>
                        </div>
                      </div>
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm text-blue-700">Current Volume</span>
                            <span className="font-semibold text-blue-900">
                              {typeof tank.current_level === 'number' ? tank.current_level.toLocaleString() : 'N/A'} L
                            </span>
                          </div>
                          <Progress 
                            value={tankStatus.percentage} 
                            className="h-2 mb-2"
                          />
                          <div className="flex justify-between text-xs text-blue-600">
                            <span>0 L</span>
                            <span>{Math.round(tankStatus.percentage)}%</span>
                            <span>{typeof tank.safe_level === 'number' ? tank.safe_level.toLocaleString() : 'N/A'} L</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2 bg-gray-50 rounded">
                            <span className="text-xs text-gray-500">Safe Fill</span>
                            <p className="font-medium text-sm">
                              {typeof tank.safe_level === 'number' ? tank.safe_level.toLocaleString() : 'N/A'} L
                            </p>
                          </div>
                          <div className="p-2 bg-gray-50 rounded">
                            <span className="text-xs text-gray-500">Ullage</span>
                            <p className="font-medium text-sm">
                              {typeof tank.safe_level === 'number' && typeof tank.current_level === 'number' 
                                ? (tank.safe_level - tank.current_level).toLocaleString() 
                                : 'N/A'} L
                            </p>
                          </div>
                        </div>
                        
                        <Button
                        onClick={() => {
                          console.log('=== ADD DIP BUTTON CLICKED ===');
                          console.log('tank prop:', tank);
                          console.log('tank?.id:', tank?.id);
                          console.log('tank?.group_id:', tank?.group_id);
                          setIsDipFormOpen(true);
                        }}
                        className="w-full border-2 border-blue-500 text-blue-700 font-semibold shadow-sm hover:bg-blue-50 focus:ring-2 focus:ring-blue-400"
                      >
                        <Droplets className="w-4 h-4 mr-2" />
                        Add New Dip Reading
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Simplified Live Metrics Card */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Live Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-gray-600" />
                            <div>
                              <span className="text-sm text-gray-500">Burn Rate</span>
                              <p className="font-medium">
                                {tank.rolling_avg ? `${tank.rolling_avg} L/day` : 'Calculating...'}
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-600" />
                            <div>
                              <span className="text-sm text-gray-500">Last Reading</span>
                              <p className="font-medium text-sm">
                                {latestReading 
                                  ? `${latestReading.value.toLocaleString()}L on ${format(new Date(latestReading.created_at), 'MMM d, HH:mm')}`
                                  : 'No readings yet'
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Timer className="w-4 h-4 text-gray-600" />
                            <div>
                              <span className="text-sm text-gray-500">Days to Min Level</span>
                              <p className="font-medium">
                                {tank.days_to_min_level ? `${tank.days_to_min_level} days` : 'Calculating...'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Enhanced Trends Tab with Two Charts */}
              <TabsContent value="trends" className="p-6 space-y-6">
                {/* Volume Trends Chart */}
                <Card>
                  <CardHeader>
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
                      {last30Dips.length > 0 ? (
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
                <Card>
                  <CardHeader>
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
                      {burnRateData.length > 0 ? (
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
                    variant="outline"
                    size="sm"
                  >
                    <Droplets className="w-4 h-4 mr-2" />
                    Add Reading to Improve Trends
                  </Button>
                </div>
              </TabsContent>

              {/* Previous Dips Tab */}
              <TabsContent value="dips" className="p-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <History className="w-5 h-5 text-blue-600" />
                      Previous Dip Readings
                      {dipHistory.length > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {dipHistory.length} readings
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dipHistoryQuery.isLoading ? (
                      <div className="space-y-3">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="animate-pulse p-3 bg-gray-100 rounded-lg">
                            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                          </div>
                        ))}
                      </div>
                    ) : dipHistory.length > 0 ? (
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        <div className="grid grid-cols-4 gap-4 py-2 px-3 bg-gray-50 rounded text-sm font-medium text-gray-700">
                          <div>Date</div>
                          <div>Reading (L)</div>
                          <div>Recorded By</div>
                          <div>Actions</div>
                        </div>
                        {dipHistory
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((dip, index) => (
                          <div key={dip.id || index} className="grid grid-cols-4 gap-4 py-3 px-3 border rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="text-sm">
                              <div className="font-medium">
                                {format(new Date(dip.created_at), 'MMM d, yyyy')}
                              </div>
                              <div className="text-xs text-gray-500">
                                {format(new Date(dip.created_at), 'h:mm a')}
                              </div>
                            </div>
                            <div className="text-sm">
                              <div className="font-medium">
                                {dip.value?.toLocaleString() || 'N/A'} L
                              </div>
                              {tank.safe_level && (
                                <div className="text-xs text-gray-500">
                                  {Math.round((dip.value / tank.safe_level) * 100)}% of capacity
                                </div>
                              )}
                            </div>
                            <div className="text-sm">
                              <div className="font-medium">
                                {dip.recorded_by || 'Unknown'}
                              </div>
                              {dip.notes && (
                                <div className="text-xs text-gray-500 truncate">
                                  {dip.notes}
                                </div>
                              )}
                            </div>
                            <div className="text-sm">
                              <div className="flex items-center gap-1">
                                {index === 0 && (
                                  <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                                    Latest
                                  </Badge>
                                )}
                                {dip.value < (tank.min_level || 0) && (
                                  <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
                                    Below Min
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                        <Droplets className="w-12 h-12 text-gray-300 mb-3" />
                        <h3 className="font-medium text-gray-600 mb-2">No Dip Readings</h3>
                        <p className="text-sm text-center">
                          No historical dip readings available for this tank.
                        </p>
                        <Button
                          onClick={() => setIsDipFormOpen(true)}
                          className="mt-4 border-2 border-blue-500 text-blue-700 font-semibold shadow-sm hover:bg-blue-50 focus:ring-2 focus:ring-blue-400"
                        >
                          <Droplets className="w-4 h-4 mr-2" />
                          Add New Dip Reading
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Enhanced Notes Tab with Tank Details */}
              <TabsContent value="notes" className="p-6 space-y-6">
                {/* Tank Details Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Tank Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-gray-500">Address</span>
                        <p className="font-medium">{tank.address || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Vehicle</span>
                        <p className="font-medium">{tank.vehicle || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Discharge</span>
                        <p className="font-medium">{tank.discharge || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">BP Portal</span>
                        <p className="font-medium">{tank.bp_portal || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Min Level</span>
                        <p className="font-medium">
                          {typeof tank.min_level === 'number' ? `${tank.min_level.toLocaleString()} L` : 'N/A'}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Delivery Window</span>
                        <p className="font-medium">{tank.delivery_window || 'N/A'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <span className="text-sm text-gray-500">Afterhours Contact</span>
                        <p className="font-medium">{tank.afterhours_contact || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Notes Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Depot Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <EditableNotesSection tank={tank} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Simplified Alerts Tab */}
              <TabsContent value="alerts" className="p-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      Alerts
                      {alerts && alerts.length > 0 && (
                        <Badge className="ml-2 bg-red-500 text-white text-xs">
                          {alerts.length}
                        </Badge>
                      )}
                    </CardTitle>
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
                        {alerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="p-3 border rounded-lg bg-gray-50"
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
            </div>
          </Tabs>

          {/* Simplified Bottom Bar */}
          <div className="px-6 py-4 border-t bg-gray-50">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <div className={`w-2 h-2 rounded-full ${
                tankStatus.color === 'green' ? 'bg-green-500' :
                tankStatus.color === 'blue' ? 'bg-blue-500' :
                tankStatus.color === 'orange' ? 'bg-orange-500' :
                'bg-red-500'
              }`}></div>
              <span>Status: {tankStatus.status}</span>
            </div>
          </div>
          </ModalErrorBoundary>
        </DialogContent>
      </Dialog>

      {/* AddDipModal rendered separately to avoid overlay conflicts */}
      {isDipFormOpen && (
        <AddDipModal
          open={isDipFormOpen}
          onOpenChange={setIsDipFormOpen}
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
}

function EditableNotesSection({ tank }: { tank: Tank }) {
  const [notes, setNotes] = React.useState(tank.notes || "");
  const [editing, setEditing] = React.useState(false);
  const [tempNotes, setTempNotes] = React.useState(notes);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setNotes(tank.notes || "");
    setTempNotes(tank.notes || "");
  }, [tank.notes]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const { error } = await supabase
      .from('fuel_tanks')
      .update({ notes: tempNotes })
      .eq('id', tank.id);
    setSaving(false);
    if (error) {
      setError(error.message);
    } else {
      setNotes(tempNotes);
      setEditing(false);
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