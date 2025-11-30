import React, { useState, useMemo } from 'react';
import { DayPicker, DayContentProps } from 'react-day-picker';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button.variants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  RefillPrediction,
  UrgencyLevel,
  getUrgencyColor,
  getUrgencyClasses,
  getUrgencyLabel,
  sortByUrgency,
} from '@/lib/urgency-calculator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface RefillCalendarProps {
  predictions: RefillPrediction[];
  onTankClick?: (tank: RefillPrediction) => void;
  showCustomerName?: boolean;
  className?: string;
}

export function RefillCalendar({
  predictions,
  onTankClick,
  showCustomerName = true,
  className,
}: RefillCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [month, setMonth] = useState<Date>(new Date());

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

  // Get the most urgent level for each date
  const urgencyByDate = useMemo(() => {
    const urgencyMap = new Map<string, UrgencyLevel>();

    predictionsByDate.forEach((tanks, dateKey) => {
      const hassCritical = tanks.some((t) => t.urgency === 'critical');
      const hasWarning = tanks.some((t) => t.urgency === 'warning');

      if (hassCritical) {
        urgencyMap.set(dateKey, 'critical');
      } else if (hasWarning) {
        urgencyMap.set(dateKey, 'warning');
      } else {
        urgencyMap.set(dateKey, 'normal');
      }
    });

    return urgencyMap;
  }, [predictionsByDate]);

  // Get tanks for selected date
  const selectedDateTanks = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = selectedDate.toISOString().split('T')[0];
    return sortByUrgency(predictionsByDate.get(dateKey) || []);
  }, [selectedDate, predictionsByDate]);

  // Custom day content with urgency indicators
  const DayContent = ({ date }: DayContentProps) => {
    const dateKey = date.toISOString().split('T')[0];
    const tanks = predictionsByDate.get(dateKey) || [];
    const urgency = urgencyByDate.get(dateKey);

    if (tanks.length === 0) {
      return <span>{date.getDate()}</span>;
    }

    return (
      <Popover>
        <PopoverTrigger asChild>
          <div className="relative w-full h-full flex items-center justify-center cursor-pointer">
            <span>{date.getDate()}</span>
            {/* Urgency indicator dot */}
            <div
              className={cn(
                'absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full',
                urgency === 'critical' && 'bg-red-500',
                urgency === 'warning' && 'bg-yellow-500',
                urgency === 'normal' && 'bg-green-500'
              )}
            />
            {/* Tank count badge */}
            {tanks.length > 1 && (
              <span
                className={cn(
                  'absolute -top-0.5 -right-0.5 text-[10px] font-bold min-w-[14px] h-[14px] flex items-center justify-center rounded-full',
                  urgency === 'critical' && 'bg-red-500 text-white',
                  urgency === 'warning' && 'bg-yellow-500 text-white',
                  urgency === 'normal' && 'bg-green-500 text-white'
                )}
              >
                {tanks.length}
              </span>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <div className="space-y-2">
            <p className="font-medium text-sm">
              {date.toLocaleDateString('en-AU', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <p className="text-xs text-gray-500">
              {tanks.length} tank{tanks.length > 1 ? 's' : ''} need refill
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {sortByUrgency(tanks).map((tank) => (
                <TankPreviewRow
                  key={tank.tankId}
                  tank={tank}
                  showCustomerName={showCustomerName}
                  onClick={() => onTankClick?.(tank)}
                />
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  // Get dates with predictions for highlighting
  const highlightedDates = useMemo(() => {
    return Array.from(predictionsByDate.keys()).map((key) => new Date(key));
  }, [predictionsByDate]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Critical (&lt;3 days)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Warning (3-7 days)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Normal (7+ days)</span>
        </div>
      </div>

      {/* Calendar */}
      <Card>
        <CardContent className="p-4">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            month={month}
            onMonthChange={setMonth}
            showOutsideDays
            className="w-full"
            classNames={{
              months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
              month: 'space-y-4 w-full',
              caption: 'flex justify-center pt-1 relative items-center',
              caption_label: 'text-sm font-medium',
              nav: 'space-x-1 flex items-center',
              nav_button: cn(
                buttonVariants({ variant: 'outline' }),
                'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100'
              ),
              nav_button_previous: 'absolute left-1',
              nav_button_next: 'absolute right-1',
              table: 'w-full border-collapse space-y-1',
              head_row: 'flex',
              head_cell: 'text-muted-foreground rounded-md w-full font-medium text-sm text-center',
              row: 'flex w-full mt-1',
              cell: 'h-12 w-full text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
              day: cn(
                buttonVariants({ variant: 'ghost' }),
                'h-12 w-full p-0 font-normal aria-selected:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-800'
              ),
              day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
              day_today: 'bg-accent text-accent-foreground',
              day_outside: 'day-outside text-muted-foreground opacity-50',
              day_disabled: 'text-muted-foreground opacity-50',
              day_hidden: 'invisible',
            }}
            components={{
              IconLeft: () => <ChevronLeft className="h-4 w-4" />,
              IconRight: () => <ChevronRight className="h-4 w-4" />,
              DayContent,
            }}
            modifiers={{
              hasRefill: highlightedDates,
            }}
            modifiersStyles={{
              hasRefill: {
                fontWeight: 'bold',
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Selected Date Details */}
      {selectedDate && selectedDateTanks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {selectedDate.toLocaleDateString('en-AU', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {selectedDateTanks.map((tank) => (
                <TankDetailRow
                  key={tank.tankId}
                  tank={tank}
                  showCustomerName={showCustomerName}
                  onClick={() => onTankClick?.(tank)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Tank preview row for popover
function TankPreviewRow({
  tank,
  showCustomerName,
  onClick,
}: {
  tank: RefillPrediction;
  showCustomerName: boolean;
  onClick?: () => void;
}) {
  const urgencyClasses = getUrgencyClasses(tank.urgency);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-2 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-800',
        urgencyClasses.bg
      )}
    >
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium truncate', urgencyClasses.text)}>
            {tank.tankName}
          </p>
          {showCustomerName && (
            <p className="text-xs text-gray-500 truncate">{tank.customerName}</p>
          )}
        </div>
        <Badge variant="outline" className={cn('ml-2 text-xs', urgencyClasses.text)}>
          {tank.currentLevel.toFixed(0)}%
        </Badge>
      </div>
    </button>
  );
}

// Detailed tank row for selected date
function TankDetailRow({
  tank,
  showCustomerName,
  onClick,
}: {
  tank: RefillPrediction;
  showCustomerName: boolean;
  onClick?: () => void;
}) {
  const urgencyClasses = getUrgencyClasses(tank.urgency);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-colors hover:shadow-sm',
        urgencyClasses.bg,
        urgencyClasses.border
      )}
    >
      <div className="flex items-center gap-3">
        {/* Level indicator */}
        <div
          className={cn(
            'w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm',
            urgencyClasses.bg,
            urgencyClasses.text
          )}
        >
          {tank.currentLevel.toFixed(0)}%
        </div>

        {/* Tank info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{tank.tankName}</p>
          {showCustomerName && (
            <p className="text-sm text-gray-500 truncate">{tank.customerName}</p>
          )}
          <p className="text-xs text-gray-400 truncate">{tank.address}</p>
        </div>

        {/* Status */}
        <div className="text-right">
          <Badge className={cn(urgencyClasses.bg, urgencyClasses.text, 'border-0')}>
            {getUrgencyLabel(tank.urgency)}
          </Badge>
          {tank.daysRemaining !== null && (
            <p className="text-xs text-gray-500 mt-1">
              ~{Math.round(tank.daysRemaining)} days
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export default RefillCalendar;
