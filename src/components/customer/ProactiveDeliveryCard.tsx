/**
 * Proactive Delivery Card
 *
 * A gentle recommendation card that helps farmers plan fuel deliveries.
 * Non-alarming by design - focuses on helpful suggestions rather than urgency.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Lightbulb,
  CalendarDays,
  Fuel,
  TrendingUp,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { type DeliveryRecommendation, deliveryRecommender } from '@/services/agricultural';

interface ProactiveDeliveryCardProps {
  recommendation: DeliveryRecommendation;
  tankId: string;
  tankName?: string;
  onRequestDelivery?: () => void;
}

export function ProactiveDeliveryCard({
  recommendation,
  tankId,
  tankName,
  onRequestDelivery,
}: ProactiveDeliveryCardProps) {
  const {
    urgencyLevel,
    orderByDate,
    reason,
    litersNeeded,
    daysOfBuffer,
    operationType,
    operationStartDate,
    calculationDetails,
  } = recommendation;

  // Don't show card when everything is fine - no need to clutter the UI
  if (urgencyLevel === 'good') {
    return null;
  }

  // Gentle styling based on how soon action might be needed
  const getCardStyle = () => {
    switch (urgencyLevel) {
      case 'critical':
        return {
          bg: 'bg-amber-50/80 dark:bg-amber-900/20',
          border: 'border-amber-200 dark:border-amber-700',
          text: 'text-amber-800 dark:text-amber-200',
          badgeBg: 'bg-amber-100 dark:bg-amber-900/40',
          badgeText: 'text-amber-700 dark:text-amber-300',
          label: 'Action Recommended',
        };
      case 'warning':
        return {
          bg: 'bg-blue-50/60 dark:bg-blue-900/15',
          border: 'border-blue-200 dark:border-blue-800',
          text: 'text-blue-800 dark:text-blue-200',
          badgeBg: 'bg-blue-100 dark:bg-blue-900/40',
          badgeText: 'text-blue-700 dark:text-blue-300',
          label: 'Plan Ahead',
        };
      case 'normal':
      default:
        return {
          bg: 'bg-gray-50/60 dark:bg-gray-800/30',
          border: 'border-gray-200 dark:border-gray-700',
          text: 'text-gray-700 dark:text-gray-300',
          badgeBg: 'bg-gray-100 dark:bg-gray-800',
          badgeText: 'text-gray-600 dark:text-gray-400',
          label: 'Suggestion',
        };
    }
  };

  const style = getCardStyle();

  // Friendly, non-alarming reason text
  const getFriendlyReason = () => {
    if (operationType && operationStartDate) {
      const opName = capitalizeFirst(operationType);
      const dateStr = format(operationStartDate, 'MMMM d');
      return `${opName} season is approaching (${dateStr}). Consider topping up your tank beforehand to ensure smooth operations.`;
    }
    if (daysOfBuffer <= 3) {
      return `Based on your usage patterns, you may want to schedule a delivery soon to maintain comfortable fuel levels.`;
    }
    return `Looking ahead at your consumption, scheduling a delivery by ${format(orderByDate, 'MMMM d')} would help maintain optimal fuel levels.`;
  };

  return (
    <Card className={cn('border transition-all', style.bg, style.border)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className={cn('text-base flex items-center gap-2', style.text)}>
            <Lightbulb className="h-4 w-4" />
            Delivery Suggestion
          </CardTitle>
          <Badge
            variant="secondary"
            className={cn('px-2 py-0.5 text-xs', style.badgeBg, style.badgeText)}
          >
            {style.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Friendly Message */}
        <p className={cn('text-sm', style.text)}>{getFriendlyReason()}</p>

        {/* Key Info - Compact */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <CalendarDays className="h-4 w-4" />
            <span>Order by <span className="font-medium">{format(orderByDate, 'MMM d')}</span></span>
          </div>
          {litersNeeded > 0 && (
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
              <Fuel className="h-4 w-4" />
              <span>~{litersNeeded.toLocaleString()}L needed</span>
            </div>
          )}
        </div>

        {/* Upcoming Operation Info - Only if relevant */}
        {operationType && operationStartDate && (
          <div
            className={cn(
              'flex items-center gap-3 p-2.5 rounded-lg',
              'bg-white/50 dark:bg-gray-900/30 border border-gray-200/50 dark:border-gray-700/50'
            )}
          >
            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
            <div className="flex-1 text-sm">
              <span className="text-gray-700 dark:text-gray-300">
                {capitalizeFirst(operationType)} season starts{' '}
                <span className="font-medium">{format(operationStartDate, 'MMMM d')}</span>
              </span>
              {calculationDetails.operationConsumptionLiters && (
                <span className="text-gray-500 dark:text-gray-400">
                  {' '}— typically uses ~{calculationDetails.operationConsumptionLiters.toLocaleString()}L
                </span>
              )}
            </div>
          </div>
        )}

        {/* Expandable Details - Collapsed by default */}
        <details className="text-xs text-gray-500 dark:text-gray-400">
          <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
            View calculation details
          </summary>
          <div className="mt-2 space-y-1 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
            <div className="flex justify-between">
              <span>Current level:</span>
              <span>{calculationDetails.currentLevelPct.toFixed(0)}% ({calculationDetails.currentLevelLiters.toLocaleString()}L)</span>
            </div>
            <div className="flex justify-between">
              <span>Average consumption:</span>
              <span>{calculationDetails.dailyConsumptionLiters.toFixed(0)}L/day</span>
            </div>
            <div className="flex justify-between">
              <span>Days of fuel remaining:</span>
              <span>{calculationDetails.daysUntilEmpty} days</span>
            </div>
            <div className="flex justify-between">
              <span>Target before operations:</span>
              <span>{calculationDetails.targetLevelPct}%</span>
            </div>
          </div>
        </details>

        {/* Gentle CTA */}
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
              <Button variant="outline" size="sm" className="w-full gap-2 text-gray-600 dark:text-gray-400">
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

/**
 * Compact badge for tank list views - only shows when attention needed
 */
export function ProactiveDeliveryBadge({
  recommendation,
  tankId,
}: {
  recommendation: DeliveryRecommendation;
  tankId: string;
}) {
  // Only show badge for critical/warning - keep the UI clean
  if (recommendation.urgencyLevel === 'good' || recommendation.urgencyLevel === 'normal') {
    return null;
  }

  const isCritical = recommendation.urgencyLevel === 'critical';

  return (
    <Link to={`/customer/request?tank=${tankId}`}>
      <Badge
        variant="secondary"
        className={cn(
          'flex items-center gap-1.5 px-2 py-0.5 cursor-pointer transition-all hover:opacity-80',
          isCritical
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
        )}
      >
        <Lightbulb className="h-3 w-3" />
        <span className="text-xs">
          {isCritical ? 'Delivery suggested' : 'Plan ahead'}
        </span>
      </Badge>
    </Link>
  );
}

// Helper
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export default ProactiveDeliveryCard;
