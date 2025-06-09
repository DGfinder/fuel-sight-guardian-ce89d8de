import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { format } from 'date-fns';
import { Tank, TankAlert, DipReading } from '@/types/fuel';
import { useTankHistory } from '@/hooks/useTankHistory';
import { useTankAlerts } from '@/hooks/useTankAlerts';
import { ALERT_TYPE_CONFIG } from '@/lib/constants';
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
  tank: initialTank,
  open,
  onOpenChange,
}: TankDetailsModalProps) {
  const [tank, setTank] = useState<Tank | null>(initialTank);
  const [isDipFormOpen, setIsDipFormOpen] = useState(false);

  // Use useEffect to always use the latest tank prop
  useEffect(() => {
    setTank(initialTank);
  }, [initialTank]);

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
    days: 30, // Fetch last 30 days of history
  });
  const dipHistory = dipHistoryQuery.data || [];

  // Refetch data when modal is opened or tank changes
  useEffect(() => {
    if (open && tank?.id) {
      dipHistoryQuery.refetch();
    }
  }, [open, tank?.id, dipHistoryQuery.refetch]);

  if (!tank) return null;

  // -- Data Processing for Chart --
  const last30Dips = dipHistory.slice(-30);
  const chartData: ChartData<'line'> = {
    labels:
      last30Dips.length > 0
        ? last30Dips.map((d: DipReading) => format(new Date(d.created_at), 'MMM d'))
        : ['No Data'],
    datasets: [
      {
        label: 'Dip Volume (L)',
        data:
          last30Dips.length > 0
            ? last30Dips.map((d: DipReading) => d.value)
            : [0],
        borderColor: '#008457', // GSF Green
        backgroundColor: 'rgba(0, 132, 87, 0.1)',
        fill: true,
        tension: 0.3,
      },
      // Overlay burn rate if available
      ...(tank.rolling_avg_lpd
        ? [
            {
              label: 'Avg Burn Rate (L/day)',
              data: Array(last30Dips.length).fill(tank.rolling_avg_lpd),
              borderColor: '#FEDF19', // GSF Gold
              borderDash: [5, 5],
              pointRadius: 0,
              fill: false,
              tension: 0.3,
            },
          ]
        : []),
    ],
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
      },
      title: {
        display: true,
        text: 'Tank Volume Trends',
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Date',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Volume (L)',
        },
        beginAtZero: false,
      },
    },
  };

  // -- Depot Notes Logic --
  const depotNotes = 'No notes available.';

  // Alerts rendering logic
  const renderAlert = (alert) => {
    const config = ALERT_TYPE_CONFIG[alert.type] || {};
    const Icon = config.icon || AlertCircle;
    const isSnoozed = alert.snoozed_until && new Date(alert.snoozed_until) > new Date();
    const isAcknowledged = !!alert.acknowledged_at;
    return (
      <div
        key={alert.id}
        className={`flex items-start gap-3 p-4 rounded-lg border ${config.borderColor || 'border-gray-200'} ${config.bgColor || 'bg-gray-50'} ${
          (isSnoozed || isAcknowledged) ? 'opacity-60' : ''
        }`}
      >
        <Icon className={`w-5 h-5 mt-0.5 ${config.color || 'text-gray-500'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={config.color || ''}>{config.label || alert.type}</Badge>
                {isSnoozed && (
                  <Badge variant="outline" className="text-gray-500">
                    <BellOff className="w-3 h-3 mr-1" /> Snoozed
                  </Badge>
                )}
                {isAcknowledged && (
                  <Badge variant="outline" className="text-gray-500">
                    <CheckCircle className="w-3 h-3 mr-1" /> Acknowledged
                  </Badge>
                )}
              </div>
              <p className="font-medium mt-1">{alert.message}</p>
              <p className="text-sm text-gray-500 mt-1">{format(new Date(alert.created_at), 'MMM d, HH:mm')}</p>
            </div>
            {!isAcknowledged && !isSnoozed && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => acknowledgeAlert(alert.id)}>
                  <CheckCircle className="w-4 h-4 mr-1" /> Acknowledge
                </Button>
                <Button variant="outline" size="sm" onClick={() => snoozeAlert(alert.id)}>
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
        <DialogContent className="bg-white text-gray-900 max-w-3xl w-full p-0 rounded-xl shadow-lg">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <Droplets className="w-7 h-7 text-blue-600" />
              {tank.location} - {tank.product || 'N/A'}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="overview" className="flex-grow flex flex-col">
            <TabsList className="px-6 border-b sticky top-0 bg-white z-10">
              <TabsTrigger value="overview">
                <Info className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="trends">
                <TrendingUp className="w-4 h-4 mr-2" />
                Trends
              </TabsTrigger>
              <TabsTrigger value="notes">
                <AlertCircle className="w-4 h-4 mr-2" />
                Depot Notes
              </TabsTrigger>
              <TabsTrigger value="alerts">
                <Bell className="w-4 h-4 mr-2" />
                Alerts{' '}
                {alerts && alerts.length > 0 && (
                  <Badge className="ml-2 bg-red-500">{alerts.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="edit" disabled>
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </TabsTrigger>
            </TabsList>

            <div className="flex-grow overflow-y-auto">
              <TabsContent value="overview" className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Tank Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <strong>Depot:</strong> {tank.group_name || 'N/A'}
                      </div>
                      <div>
                        <strong>Product:</strong> {tank.product || 'N/A'}
                      </div>
                      <div>
                        <strong>Current Volume:</strong>{' '}
                        {typeof tank.current_level === 'number' ? tank.current_level.toLocaleString() : 'N/A'} L (
                        {typeof tank.current_level === 'number' && typeof tank.safe_fill === 'number' && tank.safe_fill !== 0 ? Math.round((tank.current_level / tank.safe_fill) * 100) : 0}%
                        )
                      </div>
                      <div>
                        <strong>Safe Fill Level:</strong>{' '}
                        {typeof tank.safe_fill === 'number' ? tank.safe_fill.toLocaleString() : 'N/A'} L
                      </div>
                      <div>
                        <strong>Ullage:</strong>{' '}
                        {typeof tank.safe_fill === 'number' && typeof tank.current_level === 'number' ? (tank.safe_fill - tank.current_level).toLocaleString() : 'N/A'} L
                      </div>
                      <div>
                        <strong>Days to Min Level:</strong>{' '}
                        {tank.days_to_min_level ?? 'N/A'}
                      </div>
                      <Button
                        onClick={() => setIsDipFormOpen(true)}
                        className="mt-4 w-full"
                      >
                        <Droplets className="w-4 h-4 mr-2" />
                        Add New Dip
                      </Button>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Live Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <strong>Burn Rate:</strong> {tank.rolling_avg_lpd ?? 'N/A'}
                      </div>
                      <div>
                        <strong>Last Dip:</strong>{' '}
                        {tank.last_dip_ts ? format(new Date(tank.last_dip_ts), 'PPpp') : 'N/A'}
                      </div>
                      {/* Add more live metrics as needed */}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="trends" className="p-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Dip History (Last 30 Dips)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-80 relative">
                      {last30Dips.length > 0 ? (
                        <Line data={chartData} options={chartOptions} />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          No dip history available to display.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="p-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Depot & Route Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div>{depotNotes}</div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="alerts" className="p-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Active Alerts</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {alerts && alerts.length > 0 ? (
                      alerts.map((alert) => renderAlert(alert))
                    ) : (
                      <p>No active alerts for this tank.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="edit" className="p-6">
                {/* Edit form would go here, respecting RBAC */}
              </TabsContent>
            </div>
          </Tabs>

          {/* Sticky Bottom Bar */}
          <div className="px-6 py-4 border-t bg-gray-50 sticky md:static bottom-0 z-10 flex justify-end">
            <Button onClick={() => setIsDipFormOpen(true)}>
              <Droplets className="w-4 h-4 mr-2" />
              Add New Dip
            </Button>
          </div>

          {isDipFormOpen && (
            <AddDipModal
              isOpen={isDipFormOpen}
              onClose={() => setIsDipFormOpen(false)}
              onSubmit={async () => setIsDipFormOpen(false)}
              initialGroupId={tank.group_id}
              initialTankId={tank.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}