import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Fuel } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  RefillPrediction,
  UrgencyLevel,
  sortByUrgency,
} from '@/lib/urgency-calculator';

interface CalendarHeatMapGridProps {
  predictions: RefillPrediction[];
  selectedDate?: Date;
  onDateSelect: (date: Date | undefined) => void;
  onTankClick?: (tank: RefillPrediction) => void;
  className?: string;
}

interface DayData {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tanks: RefillPrediction[];
  urgency: UrgencyLevel | null;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarHeatMapGrid({
  predictions,
  selectedDate,
  onDateSelect,
  onTankClick,
  className,
}: CalendarHeatMapGridProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Track hovered date for showing delivery window strip
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [hoveredUrgency, setHoveredUrgency] = useState<UrgencyLevel | null>(null);

  // Today's date (normalized to midnight)
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  // Group predictions by date
  const predictionsByDate = useMemo(() => {
    const grouped = new Map<string, RefillPrediction[]>();

    for (const prediction of predictions) {
      if (!prediction.predictedRefillDate) continue;
      const dateKey = prediction.predictedRefillDate.toISOString().split('T')[0];
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(prediction);
    }

    return grouped;
  }, [predictions]);

  // Generate calendar days for current month view
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);

    // Start from Sunday of the week containing the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // End on Saturday of the week containing the last day
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    const days: DayData[] = [];

    const current = new Date(startDate);
    while (current <= endDate) {
      const dateKey = current.toISOString().split('T')[0];
      const tanks = predictionsByDate.get(dateKey) || [];

      // Determine highest urgency
      let urgency: UrgencyLevel | null = null;
      if (tanks.length > 0) {
        if (tanks.some((t) => t.urgency === 'critical')) {
          urgency = 'critical';
        } else if (tanks.some((t) => t.urgency === 'warning')) {
          urgency = 'warning';
        } else if (tanks.some((t) => t.urgency === 'normal')) {
          urgency = 'normal';
        } else {
          urgency = 'unknown';
        }
      }

      days.push({
        date: new Date(current),
        isCurrentMonth: current.getMonth() === month,
        isToday: current.getTime() === today.getTime(),
        tanks: sortByUrgency(tanks),
        urgency,
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentMonth, predictionsByDate, today]);

  const navigateMonth = (delta: number) => {
    setCurrentMonth((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + delta);
      return next;
    });
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    return date.toISOString().split('T')[0] === selectedDate.toISOString().split('T')[0];
  };

  // Check if a day is within the delivery window (from today to hoveredDate)
  const isInDeliveryWindow = (dayDate: Date) => {
    if (!hoveredDate) return false;
    const dayTime = dayDate.getTime();
    const todayTime = today.getTime();
    const hoveredTime = hoveredDate.getTime();
    return dayTime >= todayTime && dayTime <= hoveredTime;
  };

  // Check if this day is the start of the delivery window
  const isWindowStart = (dayDate: Date) => {
    if (!hoveredDate) return false;
    return dayDate.getTime() === today.getTime();
  };

  // Check if this day is the end of the delivery window
  const isWindowEnd = (dayDate: Date) => {
    if (!hoveredDate) return false;
    return dayDate.toISOString().split('T')[0] === hoveredDate.toISOString().split('T')[0];
  };

  // Get heat map background color based on urgency and tank count
  const getHeatMapClasses = (day: DayData) => {
    if (!day.urgency || day.tanks.length === 0) {
      return 'bg-white dark:bg-gray-900';
    }

    const count = day.tanks.length;
    const highIntensity = count >= 3;

    switch (day.urgency) {
      case 'critical':
        return highIntensity
          ? 'bg-red-200 dark:bg-red-900/60 hover:bg-red-300 dark:hover:bg-red-800/70'
          : 'bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60';
      case 'warning':
        return highIntensity
          ? 'bg-amber-200 dark:bg-amber-900/60 hover:bg-amber-300 dark:hover:bg-amber-800/70'
          : 'bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60';
      case 'normal':
        return highIntensity
          ? 'bg-green-200 dark:bg-green-900/60 hover:bg-green-300 dark:hover:bg-green-800/70'
          : 'bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-900/60';
      default:
        return 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700';
    }
  };

  // Get badge color classes
  const getBadgeClasses = (urgency: UrgencyLevel | null) => {
    switch (urgency) {
      case 'critical':
        return 'bg-red-500 text-white';
      case 'warning':
        return 'bg-amber-500 text-white';
      case 'normal':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  // Get strip gradient - shows progression toward critical (red tail)
  const getStripGradient = (dayDate: Date, windowStartDate: Date, windowEndDate: Date) => {
    if (!windowEndDate) return 'bg-gray-400';

    const totalDays = Math.ceil((windowEndDate.getTime() - windowStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const dayIndex = Math.ceil((dayDate.getTime() - windowStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const progress = totalDays > 0 ? dayIndex / totalDays : 1;

    // Calculate color based on position in the window
    // Start: green (safe) -> Middle: amber (warning) -> End: red (critical)
    if (progress < 0.5) {
      // Green to amber transition
      return 'bg-green-400 dark:bg-green-500';
    } else if (progress < 0.8) {
      // Amber zone
      return 'bg-amber-400 dark:bg-amber-500';
    } else {
      // Red critical zone (last ~20%)
      return 'bg-red-400 dark:bg-red-500';
    }
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2">
            {currentMonth.toLocaleDateString('en-AU', {
              month: 'long',
              year: 'numeric',
            })}
          </h2>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Today
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="border rounded-lg overflow-hidden dark:border-gray-700">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-sm font-medium text-gray-600 dark:text-gray-400"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, index) => {
            const inWindow = isInDeliveryWindow(day.date);
            const windowStart = isWindowStart(day.date);
            const windowEnd = isWindowEnd(day.date);

            return (
              <TooltipProvider key={index} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (day.tanks.length > 0) {
                          onDateSelect(isSelected(day.date) ? undefined : day.date);
                        }
                      }}
                      onMouseEnter={() => {
                        if (day.tanks.length > 0) {
                          setHoveredDate(day.date);
                          setHoveredUrgency(day.urgency);
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredDate(null);
                        setHoveredUrgency(null);
                      }}
                      className={cn(
                        'relative h-20 sm:h-24 p-1 sm:p-2 border-b border-r dark:border-gray-700 transition-all',
                        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset',
                        getHeatMapClasses(day),
                        !day.isCurrentMonth && 'opacity-40',
                        day.tanks.length > 0 && 'cursor-pointer',
                        day.tanks.length === 0 && 'cursor-default',
                        isSelected(day.date) && 'ring-2 ring-primary ring-inset',
                        day.isToday && 'ring-2 ring-blue-500 ring-inset'
                      )}
                    >
                      {/* Day number */}
                      <span
                        className={cn(
                          'absolute top-1 left-2 text-sm font-medium',
                          day.isToday && 'text-blue-600 dark:text-blue-400 font-bold',
                          !day.isCurrentMonth && 'text-gray-400 dark:text-gray-600'
                        )}
                      >
                        {day.date.getDate()}
                      </span>

                      {/* Delivery window strip - spans across days from today to target */}
                      {inWindow && hoveredDate && (
                        <div
                          className={cn(
                            'absolute left-0 right-0 h-3 top-1/2 -translate-y-1/2',
                            getStripGradient(day.date, today, hoveredDate),
                            'opacity-80',
                            // Rounded corners only on start/end
                            windowStart && 'rounded-l-full ml-1',
                            windowEnd && 'rounded-r-full mr-1',
                            // Extend to edges for middle cells
                            !windowStart && 'ml-0',
                            !windowEnd && 'mr-0'
                          )}
                        >
                          {/* Today marker at start */}
                          {windowStart && (
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600 dark:bg-blue-400 rounded-l-full" />
                          )}
                          {/* Critical end marker */}
                          {windowEnd && (
                            <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-red-700 dark:bg-red-400 rounded-r-full" />
                          )}
                        </div>
                      )}

                      {/* Tank info badge */}
                      {day.tanks.length > 0 && (
                        <div className="absolute bottom-1 right-1 sm:bottom-1.5 sm:right-1.5">
                          <Badge
                            className={cn(
                              'text-[9px] sm:text-[10px] px-1.5 py-0 h-5',
                              getBadgeClasses(day.urgency)
                            )}
                          >
                            <Fuel className="h-3 w-3 mr-0.5" />
                            {day.tanks.length}
                          </Badge>
                        </div>
                      )}

                      {/* Tank name for single tank */}
                      {day.tanks.length === 1 && !inWindow && (
                        <div className="absolute bottom-6 left-1 right-1 sm:bottom-7 sm:left-1.5 sm:right-6">
                          <p className="text-[9px] sm:text-[10px] text-gray-600 dark:text-gray-400 truncate">
                            {day.tanks[0].tankName}
                          </p>
                        </div>
                      )}
                    </button>
                  </TooltipTrigger>

                  {/* Tooltip with tank details */}
                  {day.tanks.length > 0 && (
                    <TooltipContent
                      side="top"
                      className="w-80 p-0 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-lg"
                    >
                      {/* Header */}
                      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {day.date.toLocaleDateString('en-AU', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                          })}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {day.tanks.length} tank{day.tanks.length > 1 ? 's' : ''} predicted to need refill
                        </p>
                      </div>

                      {/* Tank list */}
                      <div className="max-h-64 overflow-y-auto">
                        {day.tanks.slice(0, 5).map((tank, idx) => (
                          <div
                            key={tank.tankId}
                            className={cn(
                              'px-3 py-2',
                              idx !== 0 && 'border-t border-gray-100 dark:border-gray-800'
                            )}
                          >
                            {/* Tank name and urgency */}
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm text-gray-900 dark:text-white truncate flex-1">
                                {tank.tankName}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'ml-2 text-xs',
                                  tank.urgency === 'critical' && 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700',
                                  tank.urgency === 'warning' && 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/50 dark:text-amber-300 dark:border-amber-700',
                                  tank.urgency === 'normal' && 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-300 dark:border-green-700'
                                )}
                              >
                                {tank.urgency === 'critical' ? 'Critical' : tank.urgency === 'warning' ? 'Warning' : 'Normal'}
                              </Badge>
                            </div>

                            {/* Customer name */}
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              {tank.customerName}
                            </p>

                            {/* Calculation breakdown */}
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="bg-gray-50 dark:bg-gray-800 rounded p-1.5 text-center">
                                <p className="text-gray-500 dark:text-gray-400">Level</p>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {tank.currentLevel.toFixed(0)}%
                                </p>
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-800 rounded p-1.5 text-center">
                                <p className="text-gray-500 dark:text-gray-400">Usage</p>
                                <p className="font-semibold text-gray-900 dark:text-white">
                                  {tank.dailyConsumption
                                    ? `${Math.round(tank.dailyConsumption)}L/d`
                                    : 'N/A'}
                                </p>
                              </div>
                              <div className="bg-gray-50 dark:bg-gray-800 rounded p-1.5 text-center">
                                <p className="text-gray-500 dark:text-gray-400">Days</p>
                                <p className={cn(
                                  'font-semibold',
                                  tank.urgency === 'critical' && 'text-red-600 dark:text-red-400',
                                  tank.urgency === 'warning' && 'text-amber-600 dark:text-amber-400',
                                  tank.urgency === 'normal' && 'text-green-600 dark:text-green-400'
                                )}>
                                  {tank.daysRemaining !== null
                                    ? Math.round(tank.daysRemaining)
                                    : 'N/A'}
                                </p>
                              </div>
                            </div>

                            {/* Timeline strip showing delivery window */}
                            {tank.daysRemaining !== null && tank.predictedRefillDate && (
                              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                                <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                                  <span>Today</span>
                                  <span>
                                    {tank.predictedRefillDate.toLocaleDateString('en-AU', {
                                      day: 'numeric',
                                      month: 'short',
                                    })}
                                  </span>
                                </div>
                                <div className="relative h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  {/* Gradient fill showing time remaining */}
                                  <div
                                    className="absolute inset-y-0 left-0 rounded-full transition-all"
                                    style={{
                                      width: '100%',
                                      background:
                                        tank.urgency === 'critical'
                                          ? 'linear-gradient(to right, #dc2626, #f87171)'
                                          : tank.urgency === 'warning'
                                            ? 'linear-gradient(to right, #d97706, #fbbf24)'
                                            : 'linear-gradient(to right, #16a34a, #4ade80)',
                                    }}
                                  />
                                  {/* Today marker on left */}
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 dark:bg-blue-400 rounded-l-full" />
                                </div>
                                <p className="text-[10px] text-center text-gray-500 dark:text-gray-400 mt-1">
                                  {Math.round(tank.daysRemaining)} day{Math.round(tank.daysRemaining) !== 1 ? 's' : ''} to schedule delivery
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Footer */}
                      {day.tanks.length > 5 && (
                        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            +{day.tanks.length - 5} more tanks
                          </p>
                        </div>
                      )}

                      <div className="px-3 py-1.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                          Click to see full details
                        </p>
                      </div>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mt-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-red-200 dark:bg-red-900/60 border border-red-300 dark:border-red-700" />
          <span>Critical (&lt;3 days)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-amber-200 dark:bg-amber-900/60 border border-amber-300 dark:border-amber-700" />
          <span>Warning (3-7 days)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-900/60 border border-green-300 dark:border-green-700" />
          <span>Normal (7+ days)</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto text-gray-500">
          <div className="w-4 h-4 rounded ring-2 ring-blue-500" />
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}

export default CalendarHeatMapGrid;
