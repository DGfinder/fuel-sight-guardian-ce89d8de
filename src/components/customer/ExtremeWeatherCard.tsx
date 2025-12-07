/**
 * Extreme Weather Card
 *
 * Displays extreme weather alerts for mining and general customers.
 * Gentle, non-alarming design with helpful recommendations.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Thermometer,
  CloudRain,
  Wind,
  AlertTriangle,
  Calendar,
  Fuel,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import type { ExtremeWeatherEvent } from '@/services/weather/extreme-weather';
import type { IndustryType } from '@/hooks/useCustomerFeatures';

interface ExtremeWeatherCardProps {
  events: ExtremeWeatherEvent[];
  industryType: IndustryType;
  onScheduleDelivery?: () => void;
}

export function ExtremeWeatherCard({
  events,
  industryType,
  onScheduleDelivery,
}: ExtremeWeatherCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (events.length === 0) return null;

  // Show first event prominently, rest in expandable section
  const primaryEvent = events[0];
  const additionalEvents = events.slice(1);

  return (
    <Card className={cn('border transition-all', getCardStyle(primaryEvent.severity))}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {getEventIcon(primaryEvent.type)}
            {getEventTitle(primaryEvent.type)}
          </CardTitle>
          <Badge
            variant="secondary"
            className={cn('px-2 py-0.5 text-xs', getBadgeStyle(primaryEvent.severity))}
          >
            {getSeverityLabel(primaryEvent.severity)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Main Event */}
        <div className="space-y-2">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {primaryEvent.impact.advisory}
          </p>

          {/* Event Details */}
          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <span>
                {format(primaryEvent.startDate, 'MMM d')}
                {primaryEvent.endDate.getTime() !== primaryEvent.startDate.getTime() &&
                  ` - ${format(primaryEvent.endDate, 'MMM d')}`}
              </span>
            </div>
            {primaryEvent.impact.fuelConsumptionMultiplier !== 1.0 && (
              <div className="flex items-center gap-1.5">
                <Fuel className="h-4 w-4" />
                <span>
                  {primaryEvent.impact.fuelConsumptionMultiplier > 1
                    ? `+${Math.round((primaryEvent.impact.fuelConsumptionMultiplier - 1) * 100)}% fuel`
                    : `${Math.round((primaryEvent.impact.fuelConsumptionMultiplier - 1) * 100)}% fuel`}
                </span>
              </div>
            )}
          </div>

          {/* Recommendations */}
          {primaryEvent.recommendations.length > 0 && (
            <div className="mt-2 space-y-1">
              {primaryEvent.recommendations.slice(0, 2).map((rec, i) => (
                <p
                  key={i}
                  className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1"
                >
                  <span className="text-gray-400">→</span>
                  <span>{rec}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Additional Events */}
        {additionalEvents.length > 0 && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {additionalEvents.length} more weather event{additionalEvents.length > 1 ? 's' : ''}
            </button>

            {expanded && (
              <div className="mt-2 space-y-2">
                {additionalEvents.map((event, i) => (
                  <div
                    key={i}
                    className="p-2 rounded bg-gray-50 dark:bg-gray-800/50 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {getEventIcon(event.type, 'h-3 w-3')}
                      <span className="font-medium">{getEventTitle(event.type)}</span>
                      <span className="text-gray-500">
                        {format(event.startDate, 'MMM d')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {event.impact.advisory}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* CTA - Only show if delivery might help */}
        {shouldShowDeliveryCTA(primaryEvent) && onScheduleDelivery && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-gray-600 dark:text-gray-400"
              onClick={onScheduleDelivery}
            >
              <Calendar className="h-4 w-4" />
              Consider Scheduling Delivery
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getEventIcon(type: ExtremeWeatherEvent['type'], className = 'h-4 w-4') {
  switch (type) {
    case 'extreme_heat':
      return <Thermometer className={cn(className, 'text-orange-500')} />;
    case 'cyclone':
      return <Wind className={cn(className, 'text-purple-500')} />;
    case 'storm':
      return <CloudRain className={cn(className, 'text-blue-500')} />;
    case 'heavy_rain':
      return <CloudRain className={cn(className, 'text-blue-400')} />;
    default:
      return <AlertTriangle className={cn(className, 'text-yellow-500')} />;
  }
}

function getEventTitle(type: ExtremeWeatherEvent['type']): string {
  switch (type) {
    case 'extreme_heat':
      return 'Extreme Heat Advisory';
    case 'cyclone':
      return 'Cyclone Warning';
    case 'storm':
      return 'Storm Warning';
    case 'heavy_rain':
      return 'Heavy Rain Expected';
    default:
      return 'Weather Alert';
  }
}

function getCardStyle(severity: ExtremeWeatherEvent['severity']): string {
  switch (severity) {
    case 'alert':
      return 'bg-amber-50/80 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700';
    case 'warning':
      return 'bg-blue-50/60 dark:bg-blue-900/15 border-blue-200 dark:border-blue-800';
    case 'watch':
    default:
      return 'bg-gray-50/60 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700';
  }
}

function getBadgeStyle(severity: ExtremeWeatherEvent['severity']): string {
  switch (severity) {
    case 'alert':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'warning':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'watch':
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

function getSeverityLabel(severity: ExtremeWeatherEvent['severity']): string {
  switch (severity) {
    case 'alert':
      return 'Take Action';
    case 'warning':
      return 'Plan Ahead';
    case 'watch':
    default:
      return 'Be Aware';
  }
}

function shouldShowDeliveryCTA(event: ExtremeWeatherEvent): boolean {
  // Show CTA for events that might affect access or increase consumption
  return (
    event.type === 'cyclone' ||
    event.type === 'storm' ||
    event.type === 'heavy_rain' ||
    (event.type === 'extreme_heat' && event.impact.fuelConsumptionMultiplier > 1.1)
  );
}

export default ExtremeWeatherCard;
