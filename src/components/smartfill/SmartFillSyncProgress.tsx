/**
 * SmartFill Sync Progress Component
 * Real-time sync status indicator with progress bar
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  Clock,
  RefreshCw,
  XCircle,
  Zap,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SmartFillSyncProgressProps {
  isRunning: boolean;
  progress?: number;
  currentCustomer?: string;
  totalCustomers?: number;
  customersProcessed?: number;
  status?: 'idle' | 'running' | 'success' | 'error';
  lastSyncTime?: string;
  errorMessage?: string;
}

export function SmartFillSyncProgress({
  isRunning,
  progress = 0,
  currentCustomer,
  totalCustomers = 0,
  customersProcessed = 0,
  status = 'idle',
  lastSyncTime,
  errorMessage,
}: SmartFillSyncProgressProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'running':
        return {
          icon: RefreshCw,
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          label: 'Syncing',
          iconClass: 'animate-spin',
        };
      case 'success':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          label: 'Complete',
          iconClass: '',
        };
      case 'error':
        return {
          icon: XCircle,
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          label: 'Failed',
          iconClass: '',
        };
      default:
        return {
          icon: Clock,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          label: 'Idle',
          iconClass: '',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  if (!isRunning && status === 'idle') {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Card className={cn('border-2', config.borderColor)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Status Icon */}
              <div className={cn('p-2 rounded-lg', config.bgColor)}>
                <Icon className={cn('w-6 h-6', config.color, config.iconClass)} />
              </div>

              {/* Progress Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">SmartFill Sync</span>
                    <Badge
                      variant={status === 'error' ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {config.label}
                    </Badge>
                  </div>
                  {totalCustomers > 0 && (
                    <span className="text-sm text-gray-600">
                      {customersProcessed}/{totalCustomers} customers
                    </span>
                  )}
                </div>

                {/* Progress Bar */}
                {isRunning && (
                  <div className="space-y-1">
                    <Progress value={progress} className="h-2" />
                    {currentCustomer && (
                      <p className="text-xs text-gray-500 truncate">
                        Processing: {currentCustomer}
                      </p>
                    )}
                  </div>
                )}

                {/* Error Message */}
                {status === 'error' && errorMessage && (
                  <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
                )}

                {/* Success Message */}
                {status === 'success' && (
                  <p className="text-sm text-green-600 mt-1">
                    All customers synced successfully
                  </p>
                )}
              </div>

              {/* Last Sync Time */}
              {lastSyncTime && status !== 'running' && (
                <div className="text-right text-sm text-gray-500">
                  <p>Last sync</p>
                  <p className="font-medium">{lastSyncTime}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Compact sync status badge for header
 */
export function SmartFillSyncBadge({
  isRunning,
  lastSyncStatus,
  onClick,
}: {
  isRunning: boolean;
  lastSyncStatus?: string;
  onClick?: () => void;
}) {
  if (isRunning) {
    return (
      <Badge
        variant="secondary"
        className="bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200"
        onClick={onClick}
      >
        <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
        Syncing...
      </Badge>
    );
  }

  if (lastSyncStatus === 'success') {
    return (
      <Badge
        variant="secondary"
        className="bg-green-100 text-green-700 cursor-pointer hover:bg-green-200"
        onClick={onClick}
      >
        <CheckCircle className="w-3 h-3 mr-1" />
        Synced
      </Badge>
    );
  }

  if (lastSyncStatus === 'failed' || lastSyncStatus === 'error') {
    return (
      <Badge
        variant="destructive"
        className="cursor-pointer"
        onClick={onClick}
      >
        <XCircle className="w-3 h-3 mr-1" />
        Sync Failed
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="cursor-pointer hover:bg-gray-100"
      onClick={onClick}
    >
      <Zap className="w-3 h-3 mr-1" />
      Ready
    </Badge>
  );
}

export default SmartFillSyncProgress;
