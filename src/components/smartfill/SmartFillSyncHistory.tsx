/**
 * SmartFill Sync History Component
 * Displays detailed sync log history with status, metrics, and timing
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Users,
  Database,
  Timer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { fadeUpItemVariants } from '@/lib/motion-variants';
import {
  useSmartFillSyncLogs,
  useSmartFillManualSync,
  useSyncHealthStatus,
  formatSmartFillRelativeTime,
  type SmartFillSyncLog,
} from '@/hooks/useSmartFillAnalytics';

interface SmartFillSyncHistoryProps {
  limit?: number;
  compact?: boolean;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'success':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'partial':
      return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-600" />;
    case 'running':
      return <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'success':
      return 'default';
    case 'partial':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

function formatDuration(ms: number | undefined): string {
  if (!ms) return '--';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return '--';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString('en-AU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--';
  }
}

export function SmartFillSyncHistory({ limit = 20, compact = false }: SmartFillSyncHistoryProps) {
  const { data: syncLogs, isLoading, refetch } = useSmartFillSyncLogs(limit);
  const syncMutation = useSmartFillManualSync();
  const syncHealth = useSyncHealthStatus();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading sync history...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!syncLogs || syncLogs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Sync History
          </CardTitle>
          <CardDescription>No sync history available</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">No sync logs found</p>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
            Run First Sync
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Calculate summary stats
  const successCount = syncLogs.filter(l => l.sync_status === 'success').length;
  const partialCount = syncLogs.filter(l => l.sync_status === 'partial').length;
  const failedCount = syncLogs.filter(l => l.sync_status === 'failed').length;
  const avgDuration = syncLogs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / syncLogs.length;
  const totalReadings = syncLogs.reduce((sum, l) => sum + (l.readings_stored || 0), 0);

  return (
    <motion.div variants={fadeUpItemVariants}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-600" />
                Sync History
              </CardTitle>
              <CardDescription>
                Recent synchronization activity with SmartFill API
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                Sync Now
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Summary Stats */}
          {!compact && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-lg font-bold text-green-600">{successCount}</span>
                </div>
                <p className="text-xs text-gray-500">Successful</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-lg font-bold text-yellow-600">{partialCount}</span>
                </div>
                <p className="text-xs text-gray-500">Partial</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <span className="text-lg font-bold text-red-600">{failedCount}</span>
                </div>
                <p className="text-xs text-gray-500">Failed</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Timer className="w-4 h-4 text-blue-600" />
                  <span className="text-lg font-bold text-blue-600">{formatDuration(avgDuration)}</span>
                </div>
                <p className="text-xs text-gray-500">Avg Duration</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Database className="w-4 h-4 text-purple-600" />
                  <span className="text-lg font-bold text-purple-600">{totalReadings.toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-500">Total Readings</p>
              </div>
            </div>
          )}

          {/* Sync Logs Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-center">Customers</TableHead>
                  <TableHead className="text-center">Tanks</TableHead>
                  <TableHead className="text-center">Readings</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(log.sync_status)}
                        <Badge variant={getStatusBadgeVariant(log.sync_status)} className="text-xs">
                          {log.sync_status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">
                          {formatTimestamp(log.started_at)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatSmartFillRelativeTime(log.started_at)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="w-3 h-3 text-gray-400" />
                        <span className="text-green-600 font-medium">{log.customers_success}</span>
                        {log.customers_failed > 0 && (
                          <span className="text-red-600">/{log.customers_failed}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {log.tanks_processed || 0}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={log.readings_stored > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}>
                        {log.readings_stored || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-gray-600">
                        {formatDuration(log.duration_ms)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Error Message (if latest sync failed) */}
          {syncLogs[0]?.error_message && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                <strong>Last Error:</strong> {syncLogs[0].error_message}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default SmartFillSyncHistory;
