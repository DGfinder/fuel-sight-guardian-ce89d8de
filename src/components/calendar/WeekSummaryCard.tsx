import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertTriangle,
  Calendar,
  Download,
  ChevronDown,
  Fuel,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { RefillPrediction, sortByUrgency } from '@/lib/urgency-calculator';

interface WeekSummaryCardProps {
  predictions: RefillPrediction[];
  onExportCSV?: () => void;
  onExportICal?: () => void;
  className?: string;
}

interface DayGroup {
  date: Date;
  dateKey: string;
  dayName: string;
  dayNum: number;
  month: string;
  tanks: RefillPrediction[];
  criticalCount: number;
  warningCount: number;
}

export function WeekSummaryCard({
  predictions,
  onExportCSV,
  onExportICal,
  className,
}: WeekSummaryCardProps) {
  // Get tanks needing refill in the next 7 days, grouped by day
  const weekData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Filter to this week only
    const thisWeekTanks = predictions.filter((p) => {
      if (!p.predictedRefillDate) return false;
      return p.predictedRefillDate >= today && p.predictedRefillDate <= weekEnd;
    });

    // Group by day
    const groupedByDay = new Map<string, RefillPrediction[]>();

    thisWeekTanks.forEach((tank) => {
      if (!tank.predictedRefillDate) return;
      const dateKey = tank.predictedRefillDate.toISOString().split('T')[0];
      if (!groupedByDay.has(dateKey)) {
        groupedByDay.set(dateKey, []);
      }
      groupedByDay.get(dateKey)!.push(tank);
    });

    // Convert to array with day info, sorted by date
    const days: DayGroup[] = Array.from(groupedByDay.entries())
      .map(([dateKey, tanks]) => {
        const date = new Date(dateKey);
        return {
          date,
          dateKey,
          dayName: date.toLocaleDateString('en-AU', { weekday: 'short' }),
          dayNum: date.getDate(),
          month: date.toLocaleDateString('en-AU', { month: 'short' }),
          tanks: sortByUrgency(tanks),
          criticalCount: tanks.filter((t) => t.urgency === 'critical').length,
          warningCount: tanks.filter((t) => t.urgency === 'warning').length,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const totalTanks = thisWeekTanks.length;
    const totalCritical = thisWeekTanks.filter((t) => t.urgency === 'critical').length;
    const totalWarning = thisWeekTanks.filter((t) => t.urgency === 'warning').length;

    return { days, totalTanks, totalCritical, totalWarning };
  }, [predictions]);

  if (weekData.totalTanks === 0) {
    return (
      <Card className={cn('bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800', className)}>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-800 rounded-lg">
              <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                All clear this week
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                No tanks predicted to need refill in the next 7 days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      'border-2',
      weekData.totalCritical > 0
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
      className
    )}>
      <CardContent className="py-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              weekData.totalCritical > 0
                ? 'bg-red-100 dark:bg-red-800'
                : 'bg-amber-100 dark:bg-amber-800'
            )}>
              <AlertTriangle className={cn(
                'h-5 w-5',
                weekData.totalCritical > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-600 dark:text-amber-400'
              )} />
            </div>
            <div>
              <p className={cn(
                'font-semibold',
                weekData.totalCritical > 0
                  ? 'text-red-800 dark:text-red-200'
                  : 'text-amber-800 dark:text-amber-200'
              )}>
                THIS WEEK: {weekData.totalTanks} tank{weekData.totalTanks !== 1 ? 's' : ''} need refill
              </p>
              <p className={cn(
                'text-sm',
                weekData.totalCritical > 0
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-amber-700 dark:text-amber-300'
              )}>
                {weekData.totalCritical > 0 && (
                  <span className="font-medium">{weekData.totalCritical} critical</span>
                )}
                {weekData.totalCritical > 0 && weekData.totalWarning > 0 && ', '}
                {weekData.totalWarning > 0 && (
                  <span>{weekData.totalWarning} warning</span>
                )}
              </p>
            </div>
          </div>

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExportCSV}>
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportICal}>
                Export to Calendar (.ics)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Day-by-day breakdown */}
        <div className="space-y-2">
          {weekData.days.map((day) => (
            <div
              key={day.dateKey}
              className={cn(
                'flex items-start gap-3 p-2 rounded-lg',
                day.criticalCount > 0
                  ? 'bg-red-100/50 dark:bg-red-900/30'
                  : 'bg-amber-100/50 dark:bg-amber-900/30'
              )}
            >
              {/* Date badge */}
              <div className="flex flex-col items-center min-w-[50px] text-center">
                <span className={cn(
                  'text-xs font-medium',
                  day.criticalCount > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400'
                )}>
                  {day.dayName}
                </span>
                <span className={cn(
                  'text-lg font-bold',
                  day.criticalCount > 0
                    ? 'text-red-800 dark:text-red-200'
                    : 'text-amber-800 dark:text-amber-200'
                )}>
                  {day.dayNum}
                </span>
                <span className={cn(
                  'text-xs',
                  day.criticalCount > 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400'
                )}>
                  {day.month}
                </span>
              </div>

              {/* Tank list */}
              <div className="flex-1 flex flex-wrap gap-1.5">
                {day.tanks.map((tank) => (
                  <Badge
                    key={tank.tankId}
                    variant="outline"
                    className={cn(
                      'text-xs py-0.5',
                      tank.urgency === 'critical'
                        ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900 dark:text-red-300 dark:border-red-700'
                        : 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700'
                    )}
                  >
                    <Fuel className="h-3 w-3 mr-1" />
                    {tank.tankName}
                    {tank.daysRemaining !== null && (
                      <span className="ml-1 opacity-70">
                        ({Math.round(tank.daysRemaining)}d)
                      </span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default WeekSummaryCard;
