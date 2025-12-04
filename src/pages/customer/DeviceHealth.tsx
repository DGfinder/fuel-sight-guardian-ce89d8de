import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useFleetHealth } from '@/hooks/useCustomerAnalytics';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Activity,
  Battery,
  Signal,
  Clock,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  WifiOff,
  Search,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type HealthStatus = 'good' | 'warning' | 'critical' | 'offline';
type SortField = 'name' | 'status' | 'battery' | 'lastReading';
type SortDirection = 'asc' | 'desc';

export default function DeviceHealth() {
  const { data: fleetHealth, isLoading } = useFleetHealth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<HealthStatus | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!fleetHealth || fleetHealth.length === 0) {
    return (
      <div className="text-center py-12">
        <Activity className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          No Devices Found
        </h2>
        <p className="text-gray-500">No AgBot devices are assigned to your account yet.</p>
      </div>
    );
  }

  // Filter and sort
  const filteredDevices = fleetHealth
    .filter((device) => {
      const matchesSearch =
        device.tank_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.tank_address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        device.asset_serial?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter =
        filterStatus === 'all' || device.health_status === filterStatus;

      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = (a.tank_name || '').localeCompare(b.tank_name || '');
          break;
        case 'status':
          const statusOrder = { critical: 0, offline: 1, warning: 2, good: 3 };
          comparison = statusOrder[a.health_status] - statusOrder[b.health_status];
          break;
        case 'battery':
          comparison = (a.battery_voltage || 0) - (b.battery_voltage || 0);
          break;
        case 'lastReading':
          comparison =
            new Date(a.last_reading_at || 0).getTime() -
            new Date(b.last_reading_at || 0).getTime();
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const healthCounts = {
    all: fleetHealth.length,
    good: fleetHealth.filter((d) => d.health_status === 'good').length,
    warning: fleetHealth.filter((d) => d.health_status === 'warning').length,
    critical: fleetHealth.filter((d) => d.health_status === 'critical').length,
    offline: fleetHealth.filter((d) => d.health_status === 'offline').length,
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Device Health</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Monitor AgBot device status, battery levels, and connectivity
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <HealthSummaryCard
          label="All Devices"
          count={healthCounts.all}
          active={filterStatus === 'all'}
          onClick={() => setFilterStatus('all')}
          color="gray"
          icon={Activity}
        />
        <HealthSummaryCard
          label="Excellent"
          count={healthCounts.good}
          active={filterStatus === 'good'}
          onClick={() => setFilterStatus('good')}
          color="green"
          icon={CheckCircle}
        />
        <HealthSummaryCard
          label="Warning"
          count={healthCounts.warning}
          active={filterStatus === 'warning'}
          onClick={() => setFilterStatus('warning')}
          color="yellow"
          icon={AlertTriangle}
        />
        <HealthSummaryCard
          label="Critical"
          count={healthCounts.critical}
          active={filterStatus === 'critical'}
          onClick={() => setFilterStatus('critical')}
          color="red"
          icon={AlertCircle}
        />
        <HealthSummaryCard
          label="Offline"
          count={healthCounts.offline}
          active={filterStatus === 'offline'}
          onClick={() => setFilterStatus('offline')}
          color="gray"
          icon={WifiOff}
        />
      </div>

      {/* Search and Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by tank name, address, or serial number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSort('name')}
                className="gap-1"
              >
                Name {sortField === 'name' && <ArrowUpDown className="h-3 w-3" />}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleSort('status')}
                className="gap-1"
              >
                Status {sortField === 'status' && <ArrowUpDown className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Device Grid */}
      {filteredDevices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No devices match your search criteria</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((device) => (
            <DeviceHealthCard key={device.tank_id} device={device} />
          ))}
        </div>
      )}
    </div>
  );
}

// Health Summary Card
function HealthSummaryCard({
  label,
  count,
  active,
  onClick,
  color,
  icon: Icon,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color: 'gray' | 'green' | 'yellow' | 'red';
  icon: React.ElementType;
}) {
  const colorClasses = {
    gray: {
      bg: 'bg-gray-50 dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
      border: 'border-gray-300 dark:border-gray-600',
      activeBg: 'bg-gray-100 dark:bg-gray-700',
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-600 dark:text-green-400',
      border: 'border-green-300 dark:border-green-600',
      activeBg: 'bg-green-100 dark:bg-green-900/40',
    },
    yellow: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/20',
      text: 'text-yellow-600 dark:text-yellow-400',
      border: 'border-yellow-300 dark:border-yellow-600',
      activeBg: 'bg-yellow-100 dark:bg-yellow-900/40',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-600 dark:text-red-400',
      border: 'border-red-300 dark:border-red-600',
      activeBg: 'bg-red-100 dark:bg-red-900/40',
    },
  };

  const colors = colorClasses[color];

  return (
    <button
      onClick={onClick}
      className={cn(
        'p-4 rounded-lg border-2 transition-all text-left',
        active ? `${colors.activeBg} ${colors.border} shadow-sm` : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={cn('p-2 rounded-lg', colors.bg)}>
          <Icon className={cn('h-4 w-4', colors.text)} />
        </div>
        <span className="text-2xl font-bold">{count}</span>
      </div>
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
    </button>
  );
}

// Device Health Card
function DeviceHealthCard({ device }: { device: any }) {
  const statusConfig = {
    good: {
      label: 'Excellent',
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      icon: CheckCircle,
      iconColor: 'text-green-600 dark:text-green-400',
    },
    warning: {
      label: 'Warning',
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      icon: AlertTriangle,
      iconColor: 'text-yellow-600 dark:text-yellow-400',
    },
    critical: {
      label: 'Critical',
      color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      icon: AlertCircle,
      iconColor: 'text-red-600 dark:text-red-400',
    },
    offline: {
      label: 'Offline',
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
      icon: WifiOff,
      iconColor: 'text-gray-600 dark:text-gray-400',
    },
  };

  const status = statusConfig[device.health_status as HealthStatus];
  const StatusIcon = status.icon;

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  return (
    <Link to={`/customer/tanks/${device.tank_id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{device.tank_name}</CardTitle>
              <p className="text-sm text-gray-500 truncate">{device.tank_address}</p>
            </div>
            <Badge className={cn('text-xs font-medium', status.color)}>{status.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Current Fuel Level */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Fuel Level</span>
            </div>
            <span className="text-sm font-bold">
              {device.current_level !== null ? `${device.current_level.toFixed(1)}%` : 'N/A'}
            </span>
          </div>

          {/* Battery Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Battery className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Battery</span>
            </div>
            <span
              className={cn(
                'text-sm font-medium',
                device.battery_voltage && device.battery_voltage < 3.0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-gray-100'
              )}
            >
              {device.battery_voltage ? `${device.battery_voltage.toFixed(2)}V` : 'N/A'}
            </span>
          </div>

          {/* Signal Strength */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Signal className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Signal</span>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {device.signal_strength !== null ? `${device.signal_strength}%` : 'N/A'}
            </span>
          </div>

          {/* Last Reading */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Last Reading</span>
            </div>
            <span
              className={cn(
                'text-sm font-medium',
                device.hours_since_reading && device.hours_since_reading > 25
                  ? 'text-red-600 dark:text-red-400'
                  : device.hours_since_reading && device.hours_since_reading > 2
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-gray-900 dark:text-gray-100'
              )}
            >
              {formatTime(device.last_reading_at)}
            </span>
          </div>

          {/* Device Serial */}
          {device.asset_serial && (
            <div className="pt-2 border-t dark:border-gray-700">
              <p className="text-xs text-gray-500">Serial: {device.asset_serial}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
