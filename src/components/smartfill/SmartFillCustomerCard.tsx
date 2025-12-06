/**
 * SmartFill Customer Card Component
 * Displays customer fleet summary with health indicators
 */

import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  CheckCircle,
  ChevronRight,
  Clock,
  Fuel,
  Gauge,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { fadeUpItemVariants, springs } from '@/lib/motion-variants';
import {
  SmartFillCustomerSummary,
  formatSmartFillRelativeTime,
  getSmartFillPercentageColor,
} from '@/hooks/useSmartFillAnalytics';

interface SmartFillCustomerCardProps {
  customer: SmartFillCustomerSummary;
  onClick?: () => void;
  isExpanded?: boolean;
}

export function SmartFillCustomerCard({
  customer,
  onClick,
  isExpanded = false,
}: SmartFillCustomerCardProps) {
  const healthColor = customer.critical_tanks > 0
    ? 'border-red-500'
    : customer.warning_tanks > 0
      ? 'border-yellow-500'
      : 'border-green-500';

  const healthBgColor = customer.critical_tanks > 0
    ? 'bg-red-50'
    : customer.warning_tanks > 0
      ? 'bg-yellow-50'
      : 'bg-green-50';

  const fillPercent = customer.avg_fill_percent || 0;
  const fillColor = fillPercent < 20 ? 'bg-red-500' : fillPercent < 40 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <motion.div
      variants={fadeUpItemVariants}
      whileHover={{ scale: 1.01, y: -2 }}
      transition={springs.responsive}
    >
      <Card
        className={cn(
          'border-l-4 hover:shadow-md transition-all duration-200 cursor-pointer',
          healthColor,
          isExpanded && 'ring-2 ring-blue-500 ring-offset-2'
        )}
        onClick={onClick}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', healthBgColor)}>
                <Building2 className={cn(
                  'w-5 h-5',
                  customer.critical_tanks > 0 ? 'text-red-600' :
                  customer.warning_tanks > 0 ? 'text-yellow-600' : 'text-green-600'
                )} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  {customer.customer_name}
                  {customer.critical_tanks > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {customer.critical_tanks} Critical
                    </Badge>
                  )}
                </h3>
                <p className="text-sm text-gray-500">
                  {customer.tank_count} tanks • {customer.location_count} locations
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className={cn('text-lg font-bold', getSmartFillPercentageColor(fillPercent))}>
                  {fillPercent.toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500">Avg Fill</p>
              </div>
              <ChevronRight className={cn(
                'w-5 h-5 text-gray-400 transition-transform',
                isExpanded && 'rotate-90'
              )} />
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          {/* Fill Level Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Fleet Fill Level</span>
              <span>{customer.fleet_fill_percent?.toFixed(1) || 0}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', fillColor)}
                style={{ width: `${Math.min(100, fillPercent)}%` }}
              />
            </div>
          </div>

          {/* Tank Status Grid */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center p-2 bg-green-50 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-600 mx-auto mb-1" />
              <p className="text-sm font-bold text-green-700">{customer.healthy_tanks}</p>
              <p className="text-xs text-green-600">Healthy</p>
            </div>
            <div className="text-center p-2 bg-yellow-50 rounded-lg">
              <TrendingDown className="w-4 h-4 text-yellow-600 mx-auto mb-1" />
              <p className="text-sm font-bold text-yellow-700">{customer.warning_tanks}</p>
              <p className="text-xs text-yellow-600">Warning</p>
            </div>
            <div className="text-center p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-600 mx-auto mb-1" />
              <p className="text-sm font-bold text-red-700">{customer.critical_tanks}</p>
              <p className="text-xs text-red-600">Critical</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center justify-between text-sm border-t pt-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-gray-600">
                <Fuel className="w-4 h-4" />
                <span>{customer.total_volume ? `${(customer.total_volume / 1000).toFixed(0)}K L` : '--'}</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <Clock className="w-4 h-4" />
                <span>{customer.avg_days_remaining || '--'} days avg</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Gauge className="w-4 h-4 text-gray-400" />
              <span className="text-gray-500">
                Score: <strong className={cn(
                  customer.health_score >= 70 ? 'text-green-600' :
                  customer.health_score >= 40 ? 'text-yellow-600' : 'text-red-600'
                )}>{customer.health_score}</strong>
              </span>
            </div>
          </div>

          {/* Sync Status */}
          {customer.last_sync_at && (
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2 pt-2 border-t">
              <span>Last synced {formatSmartFillRelativeTime(customer.last_sync_at)}</span>
              <Badge
                variant={customer.last_sync_status === 'success' ? 'default' : 'secondary'}
                className="text-xs"
              >
                {customer.last_sync_status}
              </Badge>
            </div>
          )}

          {/* Sync Failures Warning */}
          {customer.consecutive_failures > 0 && (
            <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center gap-2 text-orange-700 text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>{customer.consecutive_failures} consecutive sync failures</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default SmartFillCustomerCard;
