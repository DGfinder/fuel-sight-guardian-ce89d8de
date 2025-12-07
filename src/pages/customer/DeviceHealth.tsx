import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useFleetHealth } from '@/hooks/useCustomerAnalytics';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { KPICard } from '@/components/ui/KPICard';
import { DeviceHealthTable } from '@/components/customer/DeviceHealthTable';
import {
  Activity,
  CheckCircle,
  AlertTriangle,
  AlertCircle,
  WifiOff,
} from 'lucide-react';
import { staggerContainerVariants, fadeUpItemVariants } from '@/lib/motion-variants';

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
      <motion.div
        className="grid grid-cols-2 md:grid-cols-5 gap-4"
        initial="hidden"
        animate="visible"
        variants={staggerContainerVariants}
      >
        <motion.div
          variants={fadeUpItemVariants}
          onClick={() => setFilterStatus('all')}
          className="cursor-pointer"
        >
          <KPICard
            title="All Devices"
            value={healthCounts.all}
            icon={Activity}
            color="blue"
            trend="neutral"
            alert={filterStatus === 'all'}
          />
        </motion.div>
        <motion.div
          variants={fadeUpItemVariants}
          onClick={() => setFilterStatus(filterStatus === 'good' ? 'all' : 'good')}
          className="cursor-pointer"
        >
          <KPICard
            title="Excellent"
            value={healthCounts.good}
            icon={CheckCircle}
            color="green"
            trend={healthCounts.good === healthCounts.all ? 'neutral' : 'neutral'}
            trendValue={healthCounts.good === healthCounts.all ? 'All healthy' : 'Healthy devices'}
            alert={filterStatus === 'good'}
          />
        </motion.div>
        <motion.div
          variants={fadeUpItemVariants}
          onClick={() => setFilterStatus(filterStatus === 'warning' ? 'all' : 'warning')}
          className="cursor-pointer"
        >
          <KPICard
            title="Warning"
            value={healthCounts.warning}
            icon={AlertTriangle}
            color="yellow"
            trend={healthCounts.warning > 0 ? 'down' : 'neutral'}
            trendValue={healthCounts.warning > 0 ? 'Needs attention' : 'No warnings'}
            alert={filterStatus === 'warning' || healthCounts.warning > 0}
          />
        </motion.div>
        <motion.div
          variants={fadeUpItemVariants}
          onClick={() => setFilterStatus(filterStatus === 'critical' ? 'all' : 'critical')}
          className="cursor-pointer"
        >
          <KPICard
            title="Critical"
            value={healthCounts.critical}
            icon={AlertCircle}
            color="red"
            trend={healthCounts.critical > 0 ? 'down' : 'neutral'}
            trendValue={healthCounts.critical > 0 ? 'Urgent action required' : 'No critical issues'}
            alert={filterStatus === 'critical' || healthCounts.critical > 0}
          />
        </motion.div>
        <motion.div
          variants={fadeUpItemVariants}
          onClick={() => setFilterStatus(filterStatus === 'offline' ? 'all' : 'offline')}
          className="cursor-pointer"
        >
          <KPICard
            title="Offline"
            value={healthCounts.offline}
            icon={WifiOff}
            color="gray"
            trend={healthCounts.offline > 0 ? 'down' : 'neutral'}
            trendValue={healthCounts.offline > 0 ? 'Not reporting' : 'All connected'}
            alert={filterStatus === 'offline' || healthCounts.offline > 0}
          />
        </motion.div>
      </motion.div>

      {/* Device Health Table */}
      <DeviceHealthTable filterStatus={filterStatus} />
    </div>
  );
}
