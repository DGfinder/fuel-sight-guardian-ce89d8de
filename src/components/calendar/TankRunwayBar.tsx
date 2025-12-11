import React from 'react';
import { cn } from '@/lib/utils';
import { RefillPrediction } from '@/lib/urgency-calculator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface TankRunwayBarProps {
  tank: RefillPrediction;
  maxDays?: number;
  onClick?: () => void;
  showLabel?: boolean;
  className?: string;
}

/**
 * Gradient runway bar showing tank's journey from now to empty
 * Green (>7 days) -> Yellow (3-7 days) -> Red (<3 days) -> Gray (empty)
 */
export function TankRunwayBar({
  tank,
  maxDays = 30,
  onClick,
  showLabel = true,
  className,
}: TankRunwayBarProps) {
  const daysRemaining = tank.daysRemaining ?? 0;
  const progress = Math.min(daysRemaining / maxDays, 1);

  // Calculate gradient stops based on thresholds
  // Critical: 0-3 days (red), Warning: 3-7 days (yellow), Normal: 7+ days (green)
  const criticalPercent = Math.min((3 / maxDays) * 100, 100);
  const warningPercent = Math.min((7 / maxDays) * 100, 100);

  // Determine current status color
  const getStatusColor = () => {
    if (daysRemaining === null || daysRemaining <= 0) return 'bg-gray-300 dark:bg-gray-600';
    if (daysRemaining < 3) return 'bg-red-500';
    if (daysRemaining < 7) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Format date for tooltip
  const formatDate = (date: Date | null) => {
    if (!date) return 'Unknown';
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'group relative cursor-pointer',
              onClick && 'hover:scale-[1.02] transition-transform',
              className
            )}
            onClick={onClick}
          >
            {/* Label */}
            {showLabel && (
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">{tank.tankName}</span>
                  <span className="text-xs text-gray-500 truncate hidden sm:inline">
                    {tank.customerName}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-medium">
                    {daysRemaining !== null && daysRemaining > 0
                      ? `${Math.round(daysRemaining)}d`
                      : 'N/A'}
                  </span>
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    getStatusColor()
                  )} />
                </div>
              </div>
            )}

            {/* Progress bar with gradient */}
            <div className="relative h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
              {/* Gradient background showing the full runway */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: `linear-gradient(to right,
                    #ef4444 0%,
                    #ef4444 ${criticalPercent}%,
                    #eab308 ${criticalPercent}%,
                    #eab308 ${warningPercent}%,
                    #22c55e ${warningPercent}%,
                    #22c55e 100%
                  )`,
                  opacity: 0.3,
                }}
              />

              {/* Filled portion showing current days remaining */}
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                style={{
                  width: `${progress * 100}%`,
                  background: `linear-gradient(to right,
                    #ef4444 0%,
                    #ef4444 ${criticalPercent / progress}%,
                    #eab308 ${criticalPercent / progress}%,
                    #eab308 ${warningPercent / progress}%,
                    #22c55e ${warningPercent / progress}%,
                    #22c55e 100%
                  )`,
                }}
              />

              {/* Threshold markers */}
              <div
                className="absolute top-0 bottom-0 w-px bg-white/50"
                style={{ left: `${criticalPercent}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-px bg-white/50"
                style={{ left: `${warningPercent}%` }}
              />

              {/* Current position indicator */}
              {daysRemaining !== null && daysRemaining > 0 && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-gray-800 dark:border-white shadow-sm transition-all duration-500"
                  style={{ left: `calc(${progress * 100}% - 6px)` }}
                />
              )}
            </div>

            {/* Scale labels */}
            <div className="flex justify-between mt-0.5 text-[10px] text-gray-400">
              <span>Today</span>
              <span>3d</span>
              <span>7d</span>
              <span>{maxDays}d</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{tank.tankName}</p>
            <p className="text-xs text-gray-500">{tank.customerName}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
              <span className="text-gray-500">Current Level:</span>
              <span className="font-medium">{tank.currentLevel.toFixed(1)}%</span>
              <span className="text-gray-500">Days Remaining:</span>
              <span className="font-medium">
                {daysRemaining !== null ? Math.round(daysRemaining) : 'N/A'}
              </span>
              <span className="text-gray-500">Predicted Empty:</span>
              <span className="font-medium">{formatDate(tank.predictedRefillDate)}</span>
              {tank.dailyConsumption && (
                <>
                  <span className="text-gray-500">Daily Usage:</span>
                  <span className="font-medium">{Math.round(tank.dailyConsumption)} L/day</span>
                </>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Compact version of TankRunwayBar for lists
 */
export function TankRunwayBarCompact({
  tank,
  maxDays = 30,
  onClick,
}: Omit<TankRunwayBarProps, 'showLabel'>) {
  const daysRemaining = tank.daysRemaining ?? 0;
  const progress = Math.min(Math.max(daysRemaining / maxDays, 0), 1);

  const criticalPercent = (3 / maxDays) * 100;
  const warningPercent = (7 / maxDays) * 100;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 cursor-pointer',
              onClick && 'hover:ring-2 ring-primary/50'
            )}
            onClick={onClick}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress * 100}%`,
                background: daysRemaining <= 0
                  ? '#9ca3af'
                  : daysRemaining < 3
                    ? '#ef4444'
                    : daysRemaining < 7
                      ? '#eab308'
                      : '#22c55e',
              }}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{tank.tankName}</p>
          <p className="text-xs text-gray-500">
            {daysRemaining !== null && daysRemaining > 0
              ? `${Math.round(daysRemaining)} days remaining`
              : 'No data'}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default TankRunwayBar;
