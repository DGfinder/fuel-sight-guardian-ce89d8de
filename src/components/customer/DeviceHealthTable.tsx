import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useFleetHealth } from '../../hooks/useCustomerAnalytics';
import { LoadingSpinner } from '../ui/loading-spinner';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';

type HealthStatus = 'good' | 'warning' | 'critical' | 'offline';

interface DeviceHealthTableProps {
  compact?: boolean; // Show fewer columns for dashboard
  filterStatus?: HealthStatus | 'all'; // Filter by health status
}

type SortField = 'tank_name' | 'health_status' | 'battery_voltage' | 'temperature_c' | 'last_reading_at';
type SortDirection = 'asc' | 'desc';

export function DeviceHealthTable({ compact = false, filterStatus = 'all' }: DeviceHealthTableProps) {
  const { data: healthData, isLoading } = useFleetHealth();
  const navigate = useNavigate();
  const [sortField, setSortField] = useState<SortField>('health_status');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (!healthData || healthData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-center text-gray-500 dark:text-gray-400">No device data available</p>
      </div>
    );
  }

  // Filter and sort data
  const filteredData = filterStatus === 'all'
    ? healthData
    : healthData.filter(device => device.health_status === filterStatus);

  const sortedData = [...filteredData].sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    // Handle null values
    if (aVal === null) return 1;
    if (bVal === null) return -1;

    // Status sorting priority
    if (sortField === 'health_status') {
      const statusPriority = { critical: 0, warning: 1, good: 2, offline: 3 };
      aVal = statusPriority[aVal as keyof typeof statusPriority];
      bVal = statusPriority[bVal as keyof typeof statusPriority];
    }

    if (sortDirection === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStatusBadge = (status: string, isOnline: boolean) => {
    if (!isOnline) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400">
          <WifiOff className="w-3 h-3" />
          Offline
        </span>
      );
    }

    const statusConfig = {
      good: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: Wifi, label: 'Excellent' },
      warning: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', icon: AlertCircle, label: 'Warning' },
      critical: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: AlertCircle, label: 'Critical' },
      offline: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-600 dark:text-gray-400', icon: WifiOff, label: 'Offline' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.offline;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const getRowColor = (health: any) => {
    if (!health.is_online) return '';
    if (health.hours_since_reading && health.hours_since_reading > 24) {
      return 'bg-red-50 dark:bg-red-900/10';
    }
    if (health.hours_since_reading && health.hours_since_reading > 2) {
      return 'bg-yellow-50 dark:bg-yellow-900/10';
    }
    return '';
  };

  const formatReadingFrequency = (frequency: number) => {
    if (frequency >= 1) return `${frequency.toFixed(1)}/hr`;
    if (frequency > 0) {
      const hoursPerReading = 1 / frequency;
      return `Every ${Math.round(hoursPerReading)}h`;
    }
    return 'None';
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      onClick={() => handleSort(field)}
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-gray-400">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Device Health
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Real-time monitoring status for all devices
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <SortableHeader field="tank_name">Tank</SortableHeader>
              <SortableHeader field="health_status">Status</SortableHeader>
              {!compact && (
                <>
                  <SortableHeader field="battery_voltage">Battery</SortableHeader>
                  <SortableHeader field="temperature_c">Temperature</SortableHeader>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Signal
                  </th>
                </>
              )}
              <SortableHeader field="last_reading_at">Last Reading</SortableHeader>
              {!compact && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Frequency
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {sortedData.map((health) => (
              <tr
                key={health.tank_id}
                onClick={() => navigate(`/customer/tanks/${health.tank_id}`)}
                className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${getRowColor(health)}`}
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {health.tank_name}
                  </div>
                  {health.asset_serial && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {health.asset_serial}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {getStatusBadge(health.health_status, health.is_online)}
                </td>
                {!compact && (
                  <>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className={`text-sm ${health.battery_voltage && health.battery_voltage < 3.0 ? 'text-yellow-600 dark:text-yellow-400 font-semibold' : 'text-gray-900 dark:text-gray-100'}`}>
                        {health.battery_voltage ? `${health.battery_voltage.toFixed(2)}V` : '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {health.temperature_c ? `${health.temperature_c.toFixed(1)}°C` : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                      {health.signal_strength ? `${health.signal_strength}%` : '—'}
                    </td>
                  </>
                )}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-gray-100">
                    {health.last_reading_at
                      ? formatDistanceToNow(new Date(health.last_reading_at), { addSuffix: true })
                      : 'Never'}
                  </div>
                </td>
                {!compact && (
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {health.reading_frequency ? formatReadingFrequency(health.reading_frequency) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
