import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckCircle2, Link2, HelpCircle, AlertCircle, Database, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AttributionMethod =
  | 'direct_csv'
  | 'direct_csv_unresolved'
  | 'vehicle_assignment'
  | 'lytx_hourly_correlation'
  | 'mtdata_trip_correlation'
  | 'lytx_daily_correlation'
  | 'unknown';

export interface DriverAttributionBadgeProps {
  attributionMethod: AttributionMethod;
  attributionConfidence: number; // 0.0 to 1.0
  className?: string;
  showConfidence?: boolean; // Show confidence percentage in badge
  showIcon?: boolean; // Show icon in badge
  size?: 'default' | 'sm' | 'lg';
}

interface AttributionConfig {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: {
    bg: string;
    text: string;
    border: string;
  };
}

const ATTRIBUTION_CONFIG: Record<AttributionMethod, AttributionConfig> = {
  direct_csv: {
    label: 'Direct',
    description: 'Driver information from Guardian CSV data',
    icon: CheckCircle2,
    color: {
      bg: 'bg-slate-700 dark:bg-slate-600',
      text: 'text-white',
      border: 'border-slate-700 dark:border-slate-600',
    },
  },
  direct_csv_unresolved: {
    label: 'Direct (Unresolved)',
    description: 'Driver name in Guardian data but not matched to driver record',
    icon: Database,
    color: {
      bg: 'bg-slate-500 dark:bg-slate-500',
      text: 'text-white',
      border: 'border-slate-500 dark:border-slate-500',
    },
  },
  vehicle_assignment: {
    label: 'Vehicle Assignment',
    description: 'Driver inferred from vehicle assignment at event time',
    icon: Truck,
    color: {
      bg: 'bg-blue-600 dark:bg-blue-500',
      text: 'text-white',
      border: 'border-blue-600 dark:border-blue-500',
    },
  },
  lytx_hourly_correlation: {
    label: 'LYTX Match',
    description: 'Driver matched from LYTX event within 1 hour',
    icon: Link2,
    color: {
      bg: 'bg-blue-500 dark:bg-blue-400',
      text: 'text-white',
      border: 'border-blue-500 dark:border-blue-400',
    },
  },
  mtdata_trip_correlation: {
    label: 'Trip Match',
    description: 'Driver matched from MTData trip containing this event',
    icon: Link2,
    color: {
      bg: 'bg-blue-400 dark:bg-blue-300',
      text: 'text-white',
      border: 'border-blue-400 dark:border-blue-300',
    },
  },
  lytx_daily_correlation: {
    label: 'LYTX Day Match',
    description: 'Driver matched from LYTX event same day (lower confidence)',
    icon: Link2,
    color: {
      bg: 'bg-amber-500 dark:bg-amber-400',
      text: 'text-white',
      border: 'border-amber-500 dark:border-amber-400',
    },
  },
  unknown: {
    label: 'Unknown',
    description: 'Driver could not be determined',
    icon: HelpCircle,
    color: {
      bg: 'bg-slate-300 dark:bg-slate-600',
      text: 'text-slate-700 dark:text-slate-200',
      border: 'border-slate-300 dark:border-slate-600',
    },
  },
};

/**
 * Returns a color class based on confidence level
 */
function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.9) return 'text-green-600 dark:text-green-400';
  if (confidence >= 0.7) return 'text-blue-600 dark:text-blue-400';
  if (confidence >= 0.5) return 'text-amber-600 dark:text-amber-400';
  if (confidence >= 0.3) return 'text-orange-600 dark:text-orange-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Returns a confidence level label
 */
function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return 'Very High';
  if (confidence >= 0.7) return 'High';
  if (confidence >= 0.5) return 'Medium';
  if (confidence >= 0.3) return 'Low';
  return 'Very Low';
}

/**
 * Badge component displaying driver attribution method and confidence
 *
 * Shows how the driver was determined for a Guardian event:
 * - Direct: From Guardian CSV
 * - Vehicle Assignment: Inferred from vehicle assignment
 * - LYTX/MTData Match: Correlated with LYTX event or MTData trip
 * - Unknown: Could not determine driver
 *
 * Includes confidence scoring (0.0 to 1.0) and tooltip with details
 *
 * @example
 * ```tsx
 * <DriverAttributionBadge
 *   attributionMethod="lytx_hourly_correlation"
 *   attributionConfidence={0.75}
 *   showConfidence
 *   showIcon
 * />
 * ```
 */
export const DriverAttributionBadge: React.FC<DriverAttributionBadgeProps> = ({
  attributionMethod,
  attributionConfidence,
  className,
  showConfidence = false,
  showIcon = true,
  size = 'default',
}) => {
  const config = ATTRIBUTION_CONFIG[attributionMethod] || ATTRIBUTION_CONFIG.unknown;
  const Icon = config.icon;
  const confidencePercent = Math.round(attributionConfidence * 100);
  const confidenceLabel = getConfidenceLabel(attributionConfidence);
  const confidenceColor = getConfidenceColor(attributionConfidence);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={cn(
              'inline-flex items-center gap-1 border font-medium',
              config.color.bg,
              config.color.text,
              config.color.border,
              size === 'sm' && 'px-1.5 py-0.5 text-[10px]',
              size === 'lg' && 'px-3 py-1 text-sm',
              className
            )}
          >
            {showIcon && <Icon className={cn('h-3 w-3', size === 'sm' && 'h-2.5 w-2.5', size === 'lg' && 'h-3.5 w-3.5')} />}
            <span>{config.label}</span>
            {showConfidence && (
              <span className={cn('ml-1 opacity-90', size === 'sm' && 'ml-0.5')}>
                ({confidencePercent}%)
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <div>
              <p className="font-semibold text-sm">{config.description}</p>
            </div>
            <div className="flex items-center gap-2 text-xs border-t border-slate-200 dark:border-slate-700 pt-2">
              <span className="text-slate-600 dark:text-slate-400">Confidence:</span>
              <span className={cn('font-semibold', confidenceColor)}>
                {confidenceLabel} ({confidencePercent}%)
              </span>
            </div>
            {attributionMethod === 'lytx_hourly_correlation' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Matched with LYTX event within 1 hour
              </p>
            )}
            {attributionMethod === 'mtdata_trip_correlation' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Event occurred during active MTData trip
              </p>
            )}
            {attributionMethod === 'lytx_daily_correlation' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Matched with LYTX event same day (lower confidence)
              </p>
            )}
            {attributionMethod === 'unknown' && (
              <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>No driver information available. Consider manual review.</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

/**
 * Simplified badge showing only confidence level (without method)
 */
export const ConfidenceBadge: React.FC<{
  confidence: number;
  className?: string;
  size?: 'default' | 'sm' | 'lg';
}> = ({ confidence, className, size = 'default' }) => {
  const confidencePercent = Math.round(confidence * 100);
  const confidenceLabel = getConfidenceLabel(confidence);
  const confidenceColor = getConfidenceColor(confidence);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'border-slate-300 dark:border-slate-600 font-medium',
              confidenceColor,
              size === 'sm' && 'px-1.5 py-0.5 text-[10px]',
              size === 'lg' && 'px-3 py-1 text-sm',
              className
            )}
          >
            {confidencePercent}%
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">
            <span className="font-semibold">{confidenceLabel}</span> confidence
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
