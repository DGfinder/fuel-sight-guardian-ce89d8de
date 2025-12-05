import React, { useState } from 'react';
import { useFleetHealth } from '@/hooks/useCustomerAnalytics';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { DeviceHealthTable } from '@/components/customer/DeviceHealthTable';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type HealthStatus = 'good' | 'warning' | 'critical' | 'offline';

export default function DeviceHealth() {
  const { data: fleetHealth, isLoading } = useFleetHealth();
  const [filterStatus, setFilterStatus] = useState<HealthStatus | 'all'>('all');

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

  const healthCounts = {
    all: fleetHealth.length,
    good: fleetHealth.filter((d) => d.health_status === 'good').length,
    warning: fleetHealth.filter((d) => d.health_status === 'warning').length,
    critical: fleetHealth.filter((d) => d.health_status === 'critical').length,
    offline: fleetHealth.filter((d) => d.health_status === 'offline').length,
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

      {/* Device Health Table */}
      <DeviceHealthTable filterStatus={filterStatus} />
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
