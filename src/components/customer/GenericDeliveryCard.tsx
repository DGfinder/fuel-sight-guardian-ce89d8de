/**
 * Generic Delivery Card
 *
 * Proactive delivery recommendations for mining and general customers.
 * Adapts messaging for industry context (no agricultural references).
 * Gentle, non-alarming design.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Lightbulb,
  CalendarDays,
  Fuel,
  Clock,
  CloudRain,
  Thermometer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  genericDeliveryRecommender,
  type GenericDeliveryRecommendation,
} from '@/services/industry/delivery-recommender-generic';
import type { IndustryType } from '@/hooks/useCustomerFeatures';

interface GenericDeliveryCardProps {
  recommendation: GenericDeliveryRecommendation;
  tankId: string;
  tankName?: string;
  industryType: IndustryType;
}

export function GenericDeliveryCard({
  recommendation,
  tankId,
  tankName,
  industryType,
}: GenericDeliveryCardProps) {
  const { urgencyLevel, orderByDate, reason, litersNeeded, daysOfBuffer, weatherContext, calculationDetails } =
    recommendation;

  // Don't show card when everything is good
  if (urgencyLevel === 'good') {
    return null;
  }

  const style = genericDeliveryRecommender.getGenericUrgencyStyle(urgencyLevel);
  const label = genericDeliveryRecommender.getGenericUrgencyLabel(urgencyLevel);

  // Get weather icon if there's weather context
  const weatherIcon = calculationDetails.weatherImpact
    ? getWeatherIcon(calculationDetails.weatherImpact)
    : null;

  return (
    <Card className={cn('border transition-all', style.bg, style.border)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className={cn('text-base flex items-center gap-2', style.text)}>
            <Lightbulb className="h-4 w-4" />
            Delivery Suggestion
          </CardTitle>
          <Badge variant="secondary" className={cn('px-2 py-0.5 text-xs', style.badgeBg, style.badgeText)}>
            {label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Friendly Message */}
        <p className={cn('text-sm', style.text)}>
          {getFriendlyMessage(recommendation, industryType)}
        </p>

        {/* Key Info */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <CalendarDays className="h-4 w-4" />
            <span>
              Order by <span className="font-medium">{format(orderByDate, 'MMM d')}</span>
            </span>
          </div>
          {litersNeeded > 0 && (
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Fuel className="h-4 w-4" />
              <span>~{litersNeeded.toLocaleString()}L needed</span>
            </div>
          )}
        </div>

        {/* Weather Context */}
        {weatherContext && (
          <div
            className={cn(
              'flex items-center gap-3 p-2.5 rounded-lg',
              'bg-white/50 dark:bg-gray-900/30 border border-gray-200/50 dark:border-gray-700/50'
            )}
          >
            {weatherIcon}
            <p className="text-sm text-gray-700 dark:text-gray-300">{weatherContext}</p>
          </div>
        )}

        {/* Expandable Details */}
        <details className="text-xs text-gray-500 dark:text-gray-400">
          <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
            View calculation details
          </summary>
          <div className="mt-2 space-y-1 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
            <div className="flex justify-between">
              <span>Current level:</span>
              <span>
                {calculationDetails.currentLevelPct.toFixed(0)}% (
                {calculationDetails.currentLevelLiters.toLocaleString()}L)
              </span>
            </div>
            <div className="flex justify-between">
              <span>Daily usage:</span>
              <span>{calculationDetails.dailyConsumptionLiters.toFixed(0)}L/day</span>
            </div>
            <div className="flex justify-between">
              <span>Days until low:</span>
              <span>{calculationDetails.daysUntilLow} days</span>
            </div>
            <div className="flex justify-between">
              <span>Target level:</span>
              <span>{calculationDetails.targetLevelPct}%</span>
            </div>
            {calculationDetails.weatherImpact && (
              <div className="flex justify-between">
                <span>Weather factor:</span>
                <span className="capitalize">{calculationDetails.weatherImpact.replace('_', ' ')}</span>
              </div>
            )}
          </div>
        </details>

        {/* CTA */}
        <div className="pt-1">
          {urgencyLevel === 'critical' ? (
            <Link to={`/customer/request?tank=${tankId}`} className="block">
              <Button variant="default" size="sm" className="w-full gap-2">
                <CalendarDays size={14} />
                Schedule Delivery
              </Button>
            </Link>
          ) : (
            <Link to={`/customer/request?tank=${tankId}`} className="block">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-gray-600 dark:text-gray-400"
              >
                <Clock size={14} />
                Plan a Delivery
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getFriendlyMessage(
  recommendation: GenericDeliveryRecommendation,
  industryType: IndustryType
): string {
  const { urgencyLevel, daysOfBuffer, weatherContext, calculationDetails } = recommendation;

  // If there's weather context, use a weather-focused message
  if (weatherContext) {
    if (calculationDetails.weatherImpact === 'road_closure') {
      return `Access road may be affected by weather. Consider ordering before conditions deteriorate.`;
    }
    if (calculationDetails.weatherImpact === 'cyclone') {
      return `With cyclonic conditions approaching, it would be wise to ensure your tank is topped up.`;
    }
    if (calculationDetails.weatherImpact === 'heavy_rain') {
      return industryType === 'mining'
        ? `Heavy rain may affect site access. Plan delivery ahead of the weather event.`
        : `Heavy rain expected. Consider scheduling delivery before conditions worsen.`;
    }
    if (calculationDetails.weatherImpact === 'extreme_heat') {
      return `Extreme heat may increase consumption. Ensuring adequate fuel supply is recommended.`;
    }
  }

  // Standard messages based on urgency
  if (urgencyLevel === 'critical') {
    return `Based on your usage, you may want to schedule a delivery soon to maintain comfortable fuel levels.`;
  }

  if (daysOfBuffer <= 5) {
    return `Looking ahead at your consumption, scheduling a delivery by ${format(
      recommendation.orderByDate,
      'MMMM d'
    )} would help maintain optimal levels.`;
  }

  return `Based on current usage patterns, ordering by ${format(
    recommendation.orderByDate,
    'MMMM d'
  )} would ensure you maintain adequate supply.`;
}

function getWeatherIcon(weatherImpact: string) {
  switch (weatherImpact) {
    case 'road_closure':
    case 'heavy_rain':
      return <CloudRain className="h-4 w-4 text-blue-500 flex-shrink-0" />;
    case 'extreme_heat':
      return <Thermometer className="h-4 w-4 text-orange-500 flex-shrink-0" />;
    case 'cyclone':
    case 'storm':
      return <CloudRain className="h-4 w-4 text-purple-500 flex-shrink-0" />;
    default:
      return null;
  }
}

export default GenericDeliveryCard;
