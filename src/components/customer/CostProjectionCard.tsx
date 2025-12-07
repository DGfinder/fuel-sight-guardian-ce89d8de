/**
 * Cost Projection Card
 *
 * Displays fuel cost projections and budget tracking.
 * Clean, informative design without alarm.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import {
  costTrackerService,
  type CostProjection,
  type BudgetSummary,
} from '@/services/cost-tracker';

interface CostProjectionCardProps {
  projection: CostProjection;
  budgetSummary: BudgetSummary;
  onSetBudget?: () => void;
  compact?: boolean;
}

export function CostProjectionCard({
  projection,
  budgetSummary,
  onSetBudget,
  compact = false,
}: CostProjectionCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasBudget = budgetSummary.status !== 'no_budget';
  const statusMessage = costTrackerService.getBudgetStatusMessage(budgetSummary);

  return (
    <Card className="border border-gray-200 dark:border-gray-700">
      <CardHeader className={cn('pb-2', compact && 'p-3')}>
        <div className="flex items-center justify-between">
          <CardTitle className={cn('flex items-center gap-2', compact ? 'text-sm' : 'text-base')}>
            <DollarSign className="h-4 w-4 text-green-600" />
            Fuel Cost {getPeriodLabel(projection.periodType)}
          </CardTitle>
          {hasBudget && (
            <Badge
              variant="secondary"
              className={cn('px-2 py-0.5 text-xs', getBudgetStatusStyle(budgetSummary.status))}
            >
              {getBudgetStatusLabel(budgetSummary.status)}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className={cn('space-y-3', compact && 'p-3 pt-0')}>
        {/* Main Cost Display */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {costTrackerService.formatCost(projection.projectedCost)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            projected
          </span>
          {projection.trend !== 'stable' && (
            <div className={cn('flex items-center gap-1 text-sm', getTrendStyle(projection.trend))}>
              {projection.trend === 'up' ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>{Math.abs(projection.trendPercent)}%</span>
            </div>
          )}
        </div>

        {/* Budget Progress */}
        {hasBudget && budgetSummary.budgetAmount && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {costTrackerService.formatCost(budgetSummary.spentAmount)} of{' '}
                {costTrackerService.formatCost(budgetSummary.budgetAmount)}
              </span>
              <span className="text-gray-500">{budgetSummary.percentUsed?.toFixed(0)}%</span>
            </div>
            <Progress
              value={Math.min(budgetSummary.percentUsed || 0, 100)}
              className={cn('h-2', getProgressStyle(budgetSummary.status))}
            />
            <p className={cn('text-xs', statusMessage.severity === 'success' ? 'text-green-600' : statusMessage.severity === 'warning' ? 'text-amber-600' : statusMessage.severity === 'error' ? 'text-red-600' : 'text-gray-500')}>
              {statusMessage.message}
            </p>
          </div>
        )}

        {/* Quick Stats */}
        {!compact && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <p className="text-gray-500 dark:text-gray-400">Cost to date</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {costTrackerService.formatCost(projection.costToDate)}
              </p>
            </div>
            <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50">
              <p className="text-gray-500 dark:text-gray-400">Avg daily</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {costTrackerService.formatCost(projection.dailyAverage * projection.pricePerLiter)}
              </p>
            </div>
          </div>
        )}

        {/* Expandable Details */}
        {!compact && (
          <div className="pt-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {expanded ? 'Hide' : 'Show'} details
            </button>

            {expanded && (
              <div className="mt-2 space-y-2 text-xs text-gray-600 dark:text-gray-400 pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                <div className="flex justify-between">
                  <span>Period:</span>
                  <span>
                    {projection.daysElapsed} of {projection.daysInPeriod} days
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Consumption:</span>
                  <span>{projection.consumptionToDate.toLocaleString()}L to date</span>
                </div>
                <div className="flex justify-between">
                  <span>Projected total:</span>
                  <span>{projection.projectedConsumption.toLocaleString()}L</span>
                </div>
                <div className="flex justify-between">
                  <span>Price per liter:</span>
                  <span>${projection.pricePerLiter.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Confidence:</span>
                  <span className="capitalize">{projection.confidence}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Set Budget CTA */}
        {!hasBudget && onSetBudget && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={onSetBudget}
          >
            <Target className="h-4 w-4" />
            Set a Budget
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function getPeriodLabel(period: CostProjection['periodType']): string {
  switch (period) {
    case 'weekly':
      return 'This Week';
    case 'monthly':
      return 'This Month';
    case 'quarterly':
      return 'This Quarter';
    default:
      return '';
  }
}

function getTrendStyle(trend: CostProjection['trend']): string {
  switch (trend) {
    case 'up':
      return 'text-amber-600 dark:text-amber-400';
    case 'down':
      return 'text-green-600 dark:text-green-400';
    default:
      return 'text-gray-500';
  }
}

function getBudgetStatusStyle(status: BudgetSummary['status']): string {
  switch (status) {
    case 'on_track':
      return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
    case 'at_risk':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'over_budget':
      return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

function getBudgetStatusLabel(status: BudgetSummary['status']): string {
  switch (status) {
    case 'on_track':
      return 'On Track';
    case 'at_risk':
      return 'At Risk';
    case 'over_budget':
      return 'Over Budget';
    default:
      return 'No Budget';
  }
}

function getProgressStyle(status: BudgetSummary['status']): string {
  switch (status) {
    case 'on_track':
      return '[&>div]:bg-green-500';
    case 'at_risk':
      return '[&>div]:bg-amber-500';
    case 'over_budget':
      return '[&>div]:bg-red-500';
    default:
      return '';
  }
}

export default CostProjectionCard;
