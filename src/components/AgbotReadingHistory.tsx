import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  History,
  Calendar,
  Droplets,
  Activity,
  Gauge,
  ChevronDown,
  ChevronRight,
  Battery,
  Thermometer,
  Ruler,
  Waves
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAgbotReadingHistory, AgbotHistoricalReading } from '@/hooks/useAgbotReadingHistory';

interface AgbotReadingHistoryProps {
  locationId: string;
  days?: number;
}

export function AgbotReadingHistory({ locationId, days = 30 }: AgbotReadingHistoryProps) {
  const [showAll, setShowAll] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { data, isLoading, error } = useAgbotReadingHistory({
    locationId,
    days,
    enabled: !!locationId,
  });

  const toggleRow = (readingId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(readingId)) {
        newSet.delete(readingId);
      } else {
        newSet.add(readingId);
      }
      return newSet;
    });
  };

  // Get the most recent readings (limited to 20 unless showAll is true)
  const displayedReadings = React.useMemo(() => {
    if (!data?.readings || !Array.isArray(data.readings)) return [];

    const sorted = [...data.readings].sort(
      (a, b) => new Date(b.reading_timestamp).getTime() - new Date(a.reading_timestamp).getTime()
    );

    return showAll ? sorted : sorted.slice(0, 20);
  }, [data?.readings, showAll]);

  // Calculate change from previous reading
  const getReadingChange = (currentReading: AgbotHistoricalReading, index: number) => {
    if (index >= displayedReadings.length - 1) return null;

    const nextReading = displayedReadings[index + 1]; // Next in chronological order (older)
    const percentageChange = currentReading.calibrated_fill_percentage - nextReading.calibrated_fill_percentage;

    const litresChange = currentReading.asset_reported_litres && nextReading.asset_reported_litres
      ? currentReading.asset_reported_litres - nextReading.asset_reported_litres
      : null;

    return {
      percentageChange,
      litresChange,
      isIncrease: percentageChange > 0,
      isDecrease: percentageChange < 0,
      isRefuel: percentageChange > 10 // Likely a refuel if increase > 10%
    };
  };

  const formatPercentageChange = (change: number) => {
    const absChange = Math.abs(change);
    return `${absChange.toFixed(1)}%`;
  };

  const formatLitresChange = (change: number | null) => {
    if (change === null) return '';
    const absChange = Math.abs(change);
    if (absChange < 1) return `${change.toFixed(1)}L`;
    return `${Math.round(absChange).toLocaleString()}L`;
  };

  const getChangeDisplay = (change: ReturnType<typeof getReadingChange>) => {
    if (!change || Math.abs(change.percentageChange) < 0.1) return null;

    if (change.isIncrease) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="w-3 h-3" />
          <span className="text-xs font-medium">
            {change.litresChange
              ? `+${formatLitresChange(change.litresChange)} (+${formatPercentageChange(change.percentageChange)})`
              : `+${formatPercentageChange(change.percentageChange)}`
            }
            {change.isRefuel && <span className="ml-1 text-green-700">(Refuel)</span>}
          </span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-blue-600">
          <TrendingDown className="w-3 h-3" />
          <span className="text-xs font-medium">
            {change.litresChange
              ? `-${formatLitresChange(change.litresChange)} (-${formatPercentageChange(change.percentageChange)})`
              : `-${formatPercentageChange(change.percentageChange)}`
            }
          </span>
        </div>
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Historical Readings</h3>
        </div>
        <div className="space-y-3">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Historical Readings</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-red-500">
          <Activity className="w-12 h-12 text-red-300 mb-3" />
          <h3 className="font-medium text-red-600 mb-2">Error Loading History</h3>
          <p className="text-sm text-center">
            {error instanceof Error ? error.message : 'Failed to load historical readings'}
          </p>
        </div>
      </div>
    );
  }

  if (!displayedReadings.length) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Historical Readings</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Droplets className="w-12 h-12 text-gray-300 mb-3" />
          <h3 className="font-medium text-gray-600 mb-2">No Historical Readings</h3>
          <p className="text-sm text-center">
            No readings have been recorded for this location in the last {days} days.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <History className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Historical Readings</h3>
        <Badge variant="outline" className="text-xs">
          {data?.totalCount || 0} total
        </Badge>
        {data?.waterCapacity && (
          <Badge variant="secondary" className="text-xs">
            Capacity: {data.waterCapacity.toLocaleString()}L
          </Badge>
        )}
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pr-2">
        {displayedReadings.map((reading, index) => {
          const change = getReadingChange(reading, index);
          const isExpanded = expandedRows.has(reading.id);
          const hasSensorData = reading.device_battery_voltage || reading.device_temperature ||
                                reading.asset_depth || reading.tank_depth ||
                                reading.asset_pressure || reading.tank_pressure;

          return (
            <div key={reading.id} className="bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <div
                className="flex items-center justify-between p-3 cursor-pointer"
                onClick={() => toggleRow(reading.id)}
              >
                {/* Expand/Collapse Icon */}
                <div className="mr-2">
                  {hasSensorData ? (
                    isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )
                  ) : (
                    <div className="w-4" />
                  )}
                </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="font-medium text-sm">
                    {format(new Date(reading.reading_timestamp), 'MMM d, yyyy')}
                  </span>
                  <span className="text-xs text-gray-500">
                    {format(new Date(reading.reading_timestamp), 'HH:mm')}
                  </span>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {reading.daily_consumption !== null && (
                    <div className="flex items-center gap-1">
                      <Activity className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-600">
                        {reading.daily_consumption.toFixed(2)}% daily
                      </span>
                    </div>
                  )}

                  {reading.days_remaining !== null && (
                    <div className="flex items-center gap-1">
                      <Gauge className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-600">
                        {reading.days_remaining} days remaining
                      </span>
                    </div>
                  )}

                  <Badge
                    variant={reading.device_online ? "default" : "destructive"}
                    className="text-xs h-5"
                  >
                    {reading.device_online ? "Online" : "Offline"}
                  </Badge>
                </div>
              </div>

              <div className="text-right space-y-1 ml-4">
                <div className="flex flex-col gap-0.5">
                  {/* PRIMARY: Show liters in large font */}
                  {reading.asset_reported_litres !== null ? (
                    <>
                      <span className="font-bold text-2xl">
                        {Math.round(reading.asset_reported_litres).toLocaleString()} L
                      </span>
                      <span className="text-sm text-muted-foreground">
                        ({reading.calibrated_fill_percentage.toFixed(1)}%)
                      </span>
                    </>
                  ) : (
                    <span className="font-semibold text-xl">
                      {reading.calibrated_fill_percentage.toFixed(1)}%
                    </span>
                  )}
                </div>

                {getChangeDisplay(change)}
              </div>
            </div>

            {/* Expandable Sensor Details */}
            {isExpanded && hasSensorData && (
              <div className="px-3 pb-3 pt-2 border-t border-gray-200">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {/* Battery Voltage */}
                  {reading.device_battery_voltage && (
                    <div className="flex items-center gap-2">
                      <Battery className="h-4 w-4 text-blue-600" />
                      <div>
                        <span className="text-muted-foreground">Battery:</span>
                        <span className="font-medium ml-1">
                          {reading.device_battery_voltage.toFixed(1)}V
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Device Temperature */}
                  {reading.device_temperature && (
                    <div className="flex items-center gap-2">
                      <Thermometer className="h-4 w-4 text-orange-600" />
                      <div>
                        <span className="text-muted-foreground">Temperature:</span>
                        <span className="font-medium ml-1">
                          {reading.device_temperature.toFixed(0)}°C
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Depth Reading */}
                  {(reading.asset_depth || reading.tank_depth) && (
                    <div className="flex items-center gap-2">
                      <Ruler className="h-4 w-4 text-purple-600" />
                      <div>
                        <span className="text-muted-foreground">Depth:</span>
                        <span className="font-medium ml-1">
                          {(reading.asset_depth || reading.tank_depth)?.toFixed(2)}m
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Pressure Reading */}
                  {(reading.asset_pressure || reading.tank_pressure) && (
                    <div className="flex items-center gap-2">
                      <Waves className="h-4 w-4 text-cyan-600" />
                      <div>
                        <span className="text-muted-foreground">Pressure:</span>
                        <span className="font-medium ml-1">
                          {(reading.asset_pressure || reading.tank_pressure)?.toFixed(1)} kPa
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Pressure (Bar) */}
                  {reading.asset_pressure_bar && (
                    <div className="flex items-center gap-2">
                      <Waves className="h-4 w-4 text-cyan-600" />
                      <div>
                        <span className="text-muted-foreground">Pressure (Bar):</span>
                        <span className="font-medium ml-1">
                          {reading.asset_pressure_bar.toFixed(2)} bar
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Device State */}
                  {reading.device_state && (
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-green-600" />
                      <div>
                        <span className="text-muted-foreground">State:</span>
                        <span className="font-medium ml-1">
                          {reading.device_state}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Raw Fill Percentage */}
                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-gray-600" />
                    <div>
                      <span className="text-muted-foreground">Raw Reading:</span>
                      <span className="font-medium ml-1">
                        {reading.raw_fill_percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>

      {data && data.totalCount > 20 && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? 'Show Less' : `Show All ${data.totalCount} Readings`}
          </Button>
          {!showAll && (
            <p className="text-xs text-gray-500">
              Showing most recent 20 readings
            </p>
          )}
        </div>
      )}
    </div>
  );
}
