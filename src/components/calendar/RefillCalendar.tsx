import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  RefillPrediction,
  getUrgencyClasses,
  getUrgencyLabel,
  sortByUrgency,
} from '@/lib/urgency-calculator';
import { CalendarHeatMapGrid } from './CalendarHeatMapGrid';

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

  // Get tanks for selected date
  const selectedDateTanks = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = selectedDate.toISOString().split('T')[0];
    return sortByUrgency(predictionsByDate.get(dateKey) || []);
  }, [selectedDate, predictionsByDate]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Calendar Heat Map Grid */}
      <Card>
        <CardContent className="p-4">
          <CalendarHeatMapGrid
            predictions={predictions}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            onTankClick={onTankClick}
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
