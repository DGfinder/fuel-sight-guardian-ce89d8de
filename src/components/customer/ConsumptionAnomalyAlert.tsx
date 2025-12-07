/**
 * Consumption Anomaly Alert
 *
 * Displays unusual consumption patterns in a friendly, non-alarming way.
 * Provides possible causes and recommendations.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Activity, X, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnomalyResult } from '@/services/consumption-anomaly';

interface ConsumptionAnomalyAlertProps {
  anomaly: AnomalyResult;
  tankName?: string;
  onDismiss?: () => void;
  onInvestigate?: () => void;
}

export function ConsumptionAnomalyAlert({
  anomaly,
  tankName,
  onDismiss,
  onInvestigate,
}: ConsumptionAnomalyAlertProps) {
  // Don't show if no anomaly
  if (!anomaly.hasAnomaly) return null;

  const isSpike = anomaly.type === 'spike';
  const isPatternChange = anomaly.type === 'pattern_change';
  const absDeviation = Math.abs(anomaly.deviationPercent);

  return (
    <Card className={cn('border transition-all relative', getCardStyle(anomaly.severity))}>
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>
      )}

      <CardContent className="pt-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg', getIconBgStyle(anomaly.severity))}>
            {isSpike ? (
              <TrendingUp className={cn('h-5 w-5', getIconStyle(anomaly.severity))} />
            ) : anomaly.type === 'drop' ? (
              <TrendingDown className={cn('h-5 w-5', getIconStyle(anomaly.severity))} />
            ) : (
              <Activity className={cn('h-5 w-5', getIconStyle(anomaly.severity))} />
            )}
          </div>

          <div className="flex-1 pr-6">
            <div className="flex items-center gap-2">
              <h4 className={cn('font-medium', getTextStyle(anomaly.severity))}>
                {getTitle(anomaly)}
              </h4>
              <Badge
                variant="secondary"
                className={cn('px-2 py-0 text-xs', getBadgeStyle(anomaly.severity))}
              >
                {absDeviation.toFixed(0)}% {isSpike ? 'above' : 'below'}
              </Badge>
            </div>
            {tankName && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {tankName}
              </p>
            )}
          </div>
        </div>

        {/* Message */}
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {getFriendlyMessage(anomaly)}
        </p>

        {/* Possible Causes */}
        {anomaly.possibleCauses.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <HelpCircle className="h-3 w-3" />
              Possible reasons
            </p>
            <div className="flex flex-wrap gap-1.5">
              {anomaly.possibleCauses.slice(0, 3).map((cause, i) => (
                <span
                  key={i}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                    cause.likelihood === 'high' && 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                  )}
                >
                  {cause.cause}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              className="text-gray-500"
              onClick={onDismiss}
            >
              Dismiss
            </Button>
          )}
          {onInvestigate && (
            <Button
              variant="outline"
              size="sm"
              onClick={onInvestigate}
            >
              View Details
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getTitle(anomaly: AnomalyResult): string {
  if (anomaly.type === 'spike') return 'Higher Than Usual';
  if (anomaly.type === 'drop') return 'Lower Than Expected';
  return 'Unusual Pattern';
}

function getFriendlyMessage(anomaly: AnomalyResult): string {
  const absDeviation = Math.abs(anomaly.deviationPercent);

  if (anomaly.type === 'spike') {
    if (absDeviation > 100) {
      return `Fuel consumption is significantly higher than your normal usage. This might indicate increased operations or equipment running more than usual.`;
    }
    return `Consumption is ${absDeviation.toFixed(0)}% above your normal. Equipment running more, or something else going on?`;
  }

  if (anomaly.type === 'drop') {
    if (absDeviation > 60) {
      return `Fuel usage is much lower than expected. Is everything running okay?`;
    }
    return `Consumption is ${absDeviation.toFixed(0)}% below your normal. Reduced operations, or time to check equipment?`;
  }

  // Pattern change
  return anomaly.recommendation;
}

function getCardStyle(severity: AnomalyResult['severity']): string {
  switch (severity) {
    case 'alert':
      return 'bg-amber-50/80 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700';
    case 'warning':
      return 'bg-blue-50/60 dark:bg-blue-900/15 border-blue-200 dark:border-blue-800';
    case 'info':
    default:
      return 'bg-gray-50/60 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700';
  }
}

function getIconBgStyle(severity: AnomalyResult['severity']): string {
  switch (severity) {
    case 'alert':
      return 'bg-amber-100 dark:bg-amber-900/40';
    case 'warning':
      return 'bg-blue-100 dark:bg-blue-900/40';
    case 'info':
    default:
      return 'bg-gray-100 dark:bg-gray-800';
  }
}

function getIconStyle(severity: AnomalyResult['severity']): string {
  switch (severity) {
    case 'alert':
      return 'text-amber-600 dark:text-amber-400';
    case 'warning':
      return 'text-blue-600 dark:text-blue-400';
    case 'info':
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}

function getTextStyle(severity: AnomalyResult['severity']): string {
  switch (severity) {
    case 'alert':
      return 'text-amber-800 dark:text-amber-200';
    case 'warning':
      return 'text-blue-800 dark:text-blue-200';
    case 'info':
    default:
      return 'text-gray-800 dark:text-gray-200';
  }
}

function getBadgeStyle(severity: AnomalyResult['severity']): string {
  switch (severity) {
    case 'alert':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'warning':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
    case 'info':
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

export default ConsumptionAnomalyAlert;
