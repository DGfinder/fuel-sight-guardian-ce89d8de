/**
 * SmartFill Dashboard Component
 * Fleet health overview with KPI cards, alerts, and quick actions
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Droplets,
  Fuel,
  Gauge,
  RefreshCw,
  TrendingDown,
  Users,
  Zap,
} from 'lucide-react';
import { KPICard } from '@/components/ui/KPICard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { staggerContainerVariants, fadeUpItemVariants } from '@/lib/motion-variants';
import {
  useSmartFillFleetOverview,
  useSmartFillSyncLogs,
  useSmartFillActiveAlerts,
  useSmartFillManualSync,
  formatSmartFillRelativeTime,
} from '@/hooks/useSmartFillAnalytics';

interface SmartFillDashboardProps {
  onNavigateToTanks?: () => void;
  onNavigateToCustomers?: () => void;
}

export function SmartFillDashboard({
  onNavigateToTanks,
  onNavigateToCustomers,
}: SmartFillDashboardProps) {
  const { data: overview, isLoading: overviewLoading } = useSmartFillFleetOverview();
  const { data: syncLogs } = useSmartFillSyncLogs(5);
  const { data: alerts } = useSmartFillActiveAlerts();
  const syncMutation = useSmartFillManualSync();

  const lastSync = syncLogs?.[0];
  const criticalAlerts = alerts?.filter(a => a.severity === 'critical') || [];
  const warningAlerts = alerts?.filter(a => a.severity === 'warning') || [];

  // Calculate health metrics
  const totalTanks = overview?.total_tanks || 0;
  const healthyPercent = totalTanks > 0
    ? Math.round(((overview?.healthy_tanks || 0) / totalTanks) * 100)
    : 0;

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Quick Actions Bar */}
      <motion.div variants={fadeUpItemVariants} className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Fleet Overview</h2>
          <p className="text-sm text-gray-600">
            Last synced {formatSmartFillRelativeTime(overview?.last_successful_sync)}
          </p>
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="bg-green-600 hover:bg-green-700"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
          {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
        </Button>
      </motion.div>

      {/* KPI Cards Grid */}
      <motion.div
        variants={staggerContainerVariants}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4"
      >
        <KPICard
          title="Total Tanks"
          value={overview?.total_tanks || 0}
          icon={Fuel}
          color="blue"
          isLoading={overviewLoading}
        />

        <KPICard
          title="Customers"
          value={overview?.active_customers || 0}
          icon={Users}
          color="green"
          isLoading={overviewLoading}
        />

        <KPICard
          title="Avg Fill Level"
          value={`${Math.round(overview?.avg_fill_percent || 0)}%`}
          icon={Gauge}
          color={
            (overview?.avg_fill_percent || 0) < 30 ? 'red' :
            (overview?.avg_fill_percent || 0) < 50 ? 'yellow' : 'green'
          }
          isLoading={overviewLoading}
        />

        <KPICard
          title="Critical"
          value={overview?.critical_tanks || 0}
          icon={AlertTriangle}
          color="red"
          alert={(overview?.critical_tanks || 0) > 0}
          isLoading={overviewLoading}
        />

        <KPICard
          title="Warning"
          value={overview?.warning_tanks || 0}
          icon={TrendingDown}
          color="yellow"
          alert={(overview?.warning_tanks || 0) > 3}
          isLoading={overviewLoading}
        />

        <KPICard
          title="Active Alerts"
          value={overview?.active_alerts || 0}
          icon={Zap}
          color={(overview?.active_alerts || 0) > 0 ? 'red' : 'green'}
          alert={(overview?.active_alerts || 0) > 0}
          isLoading={overviewLoading}
        />
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Fleet Health Card */}
        <motion.div variants={fadeUpItemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-600" />
                Fleet Health
              </CardTitle>
              <CardDescription>Overall tank status distribution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Health Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Overall Health</span>
                  <span className="font-semibold text-green-600">{healthyPercent}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                  <div
                    className="bg-green-500 h-full transition-all duration-500"
                    style={{ width: `${(overview?.healthy_tanks || 0) / Math.max(totalTanks, 1) * 100}%` }}
                  />
                  <div
                    className="bg-yellow-500 h-full transition-all duration-500"
                    style={{ width: `${(overview?.warning_tanks || 0) / Math.max(totalTanks, 1) * 100}%` }}
                  />
                  <div
                    className="bg-red-500 h-full transition-all duration-500"
                    style={{ width: `${(overview?.critical_tanks || 0) / Math.max(totalTanks, 1) * 100}%` }}
                  />
                </div>
              </div>

              {/* Status Breakdown */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div
                  className="text-center p-3 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors"
                  onClick={onNavigateToTanks}
                >
                  <CheckCircle className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-green-700">{overview?.healthy_tanks || 0}</p>
                  <p className="text-xs text-green-600">Healthy</p>
                </div>
                <div
                  className="text-center p-3 bg-yellow-50 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors"
                  onClick={onNavigateToTanks}
                >
                  <TrendingDown className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-yellow-700">{overview?.warning_tanks || 0}</p>
                  <p className="text-xs text-yellow-600">Warning</p>
                </div>
                <div
                  className="text-center p-3 bg-red-50 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={onNavigateToTanks}
                >
                  <AlertTriangle className="w-5 h-5 text-red-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-red-700">{overview?.critical_tanks || 0}</p>
                  <p className="text-xs text-red-600">Critical</p>
                </div>
              </div>

              {/* Stale Data Warning */}
              {(overview?.stale_tanks || 0) > 0 && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-600" />
                    <span className="text-sm text-orange-700">
                      <strong>{overview?.stale_tanks}</strong> tanks with stale data (&gt;24h)
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Active Alerts Card */}
        <motion.div variants={fadeUpItemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-red-600" />
                Active Alerts
                {(alerts?.length || 0) > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {alerts?.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Tanks requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              {!alerts || alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                  <p className="text-green-600 font-medium">All Systems Normal</p>
                  <p className="text-sm text-gray-500">No active alerts</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {alerts.slice(0, 5).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-lg border-l-4 ${
                        alert.severity === 'critical'
                          ? 'bg-red-50 border-red-500'
                          : 'bg-yellow-50 border-yellow-500'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle
                          className={`w-4 h-4 mt-0.5 ${
                            alert.severity === 'critical' ? 'text-red-600' : 'text-yellow-600'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {alert.title}
                          </p>
                          <p className="text-xs text-gray-600">
                            {formatSmartFillRelativeTime(alert.triggered_at)}
                          </p>
                        </div>
                        <Badge
                          variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {alerts.length > 5 && (
                    <p className="text-sm text-gray-500 text-center pt-2">
                      +{alerts.length - 5} more alerts
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Sync Activity */}
        <motion.div variants={fadeUpItemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-600" />
                Sync Activity
              </CardTitle>
              <CardDescription>Recent data synchronization history</CardDescription>
            </CardHeader>
            <CardContent>
              {!syncLogs || syncLogs.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No sync history</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => syncMutation.mutate()}
                    className="mt-3"
                  >
                    Run First Sync
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {syncLogs.slice(0, 5).map((log) => (
                    <div
                      key={log.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <div
                        className={`w-2 h-2 rounded-full ${
                          log.sync_status === 'success'
                            ? 'bg-green-500'
                            : log.sync_status === 'partial'
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {log.tanks_processed} tanks synced
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatSmartFillRelativeTime(log.started_at)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          log.sync_status === 'success'
                            ? 'default'
                            : log.sync_status === 'partial'
                              ? 'secondary'
                              : 'destructive'
                        }
                        className="text-xs"
                      >
                        {log.sync_status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick Stats Row */}
      <motion.div variants={fadeUpItemVariants}>
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Droplets className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900">
                  {overview?.total_volume
                    ? `${(overview.total_volume / 1000).toFixed(0)}K`
                    : '--'}
                </p>
                <p className="text-xs text-gray-500">Total Volume (L)</p>
              </div>
              <div className="text-center">
                <Fuel className="w-6 h-6 text-gray-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900">
                  {overview?.total_capacity
                    ? `${(overview.total_capacity / 1000).toFixed(0)}K`
                    : '--'}
                </p>
                <p className="text-xs text-gray-500">Total Capacity (L)</p>
              </div>
              <div className="text-center">
                <Clock className="w-6 h-6 text-green-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900">
                  {overview?.avg_days_remaining || '--'}
                </p>
                <p className="text-xs text-gray-500">Avg Days Remaining</p>
              </div>
              <div className="text-center">
                <Activity className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-gray-900">
                  {overview?.total_locations || 0}
                </p>
                <p className="text-xs text-gray-500">Locations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

export default SmartFillDashboard;
