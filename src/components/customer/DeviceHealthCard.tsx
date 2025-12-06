import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Activity,
  Battery,
  Thermometer,
  Signal,
  Clock,
  AlertTriangle,
  CheckCircle,
  WifiOff,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface DeviceHealthData {
  tank_id: string;
  tank_name: string;
  tank_address: string;
  asset_id?: string;
  asset_serial?: string;
  is_online: boolean;
  battery_voltage: number | null;
  temperature_c: number | null;
  signal_strength: number | null;
  last_reading_at: string | null;
  hours_since_reading: number | null;
  reading_frequency: number;
  health_status: 'good' | 'warning' | 'critical' | 'offline';
  current_level: number | null;
}

interface DeviceHealthCardProps {
  devices: DeviceHealthData[];
  isLoading?: boolean;
}

export function DeviceHealthCard({ devices, isLoading }: DeviceHealthCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Device Health
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">AgBot monitoring status</p>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        </CardContent>
      </Card>
    );
  }

  const tankCount = devices.length;

  // Single tank: show full telemetry view
  if (tankCount === 1) {
    return <SingleDeviceView device={devices[0]} />;
  }

  // Multiple tanks: show priority list
  return <MultiDeviceView devices={devices} />;
}

// Single device full telemetry view
function SingleDeviceView({ device }: { device: DeviceHealthData }) {
  const statusConfig = getStatusConfig(device.health_status, device.is_online);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Device Health
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">AgBot monitoring status</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Online Status with Last Seen */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('w-3 h-3 rounded-full', statusConfig.dotColor)} />
            <span className={cn('font-medium', statusConfig.textColor)}>
              {statusConfig.label}
            </span>
          </div>
          {device.last_reading_at && (
            <span className="text-sm text-gray-500">
              {formatDistanceToNow(new Date(device.last_reading_at), { addSuffix: true })}
            </span>
          )}
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-3 gap-4 pt-2">
          {/* Battery */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Battery
                className={cn(
                  'h-4 w-4',
                  device.battery_voltage !== null && device.battery_voltage < 3.0
                    ? 'text-red-500'
                    : 'text-green-500'
                )}
              />
              <span className="text-xs text-gray-500">Battery</span>
            </div>
            <p className={cn(
              'text-lg font-semibold',
              device.battery_voltage !== null && device.battery_voltage < 3.0
                ? 'text-red-600'
                : 'text-gray-900 dark:text-white'
            )}>
              {device.battery_voltage !== null
                ? `${device.battery_voltage.toFixed(1)}V`
                : '—'}
            </p>
          </div>

          {/* Temperature */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Thermometer className="h-4 w-4 text-orange-500" />
              <span className="text-xs text-gray-500">Temp</span>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {device.temperature_c !== null
                ? `${device.temperature_c.toFixed(0)}°C`
                : '—'}
            </p>
          </div>

          {/* Signal */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Signal
                className={cn(
                  'h-4 w-4',
                  device.signal_strength !== null && device.signal_strength > 50
                    ? 'text-green-500'
                    : 'text-yellow-500'
                )}
              />
              <span className="text-xs text-gray-500">Signal</span>
            </div>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {device.signal_strength !== null
                ? `${device.signal_strength}%`
                : '—'}
            </p>
          </div>
        </div>

        {/* View Details Link */}
        <Link to="/customer/device-health" className="block pt-2">
          <Button variant="ghost" size="sm" className="w-full gap-1 text-gray-600">
            View Device Details <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// Multiple devices priority list view
function MultiDeviceView({ devices }: { devices: DeviceHealthData[] }) {
  // Sort by priority: offline first, then warning/critical, then by last reading
  const sortedDevices = [...devices].sort((a, b) => {
    const priorityOrder = { offline: 0, critical: 1, warning: 2, good: 3 };
    const aPriority = priorityOrder[a.health_status];
    const bPriority = priorityOrder[b.health_status];

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    // Same status: sort by hours since last reading (most stale first)
    const aHours = a.hours_since_reading ?? 999;
    const bHours = b.hours_since_reading ?? 999;
    return bHours - aHours;
  });

  // Take top 3 most important devices
  const displayDevices = sortedDevices.slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Device Health
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">AgBot monitoring status</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayDevices.map((device) => (
          <DeviceRow key={device.tank_id} device={device} />
        ))}

        {/* View All Link */}
        <Link to="/customer/device-health" className="block pt-1">
          <Button variant="ghost" size="sm" className="w-full gap-1 text-gray-600">
            View All {devices.length} Devices <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// Device row for multi-device view
function DeviceRow({ device }: { device: DeviceHealthData }) {
  const statusConfig = getStatusConfig(device.health_status, device.is_online);

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      {/* Status indicator */}
      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', statusConfig.dotColor)} />

      {/* Device name */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {device.tank_name || device.tank_address || 'Unknown'}
        </p>
      </div>

      {/* Status badge */}
      <Badge
        variant="outline"
        className={cn('text-xs flex-shrink-0', statusConfig.badgeClass)}
      >
        {statusConfig.label}
      </Badge>

      {/* Last seen */}
      {device.last_reading_at && (
        <span className="text-xs text-gray-500 flex-shrink-0 hidden sm:inline">
          {formatDistanceToNow(new Date(device.last_reading_at), { addSuffix: false })}
        </span>
      )}
    </div>
  );
}

// Helper to get status configuration
function getStatusConfig(
  status: 'good' | 'warning' | 'critical' | 'offline',
  isOnline: boolean
) {
  if (!isOnline || status === 'offline') {
    return {
      label: 'Offline',
      dotColor: 'bg-gray-400',
      textColor: 'text-gray-600',
      badgeClass: 'border-gray-300 text-gray-600 bg-gray-50',
      icon: WifiOff,
    };
  }

  switch (status) {
    case 'critical':
      return {
        label: 'Critical',
        dotColor: 'bg-red-500',
        textColor: 'text-red-600',
        badgeClass: 'border-red-300 text-red-700 bg-red-50',
        icon: AlertTriangle,
      };
    case 'warning':
      return {
        label: 'Warning',
        dotColor: 'bg-yellow-500',
        textColor: 'text-yellow-600',
        badgeClass: 'border-yellow-300 text-yellow-700 bg-yellow-50',
        icon: AlertTriangle,
      };
    case 'good':
    default:
      return {
        label: 'Online',
        dotColor: 'bg-green-500',
        textColor: 'text-green-600',
        badgeClass: 'border-green-300 text-green-700 bg-green-50',
        icon: CheckCircle,
      };
  }
}
