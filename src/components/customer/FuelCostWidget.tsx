/**
 * Fuel Cost Widget
 *
 * Shows fuel cost projections for a single tank with configurable price.
 * Simple, informative widget for the tank detail page.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Settings2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  costTrackerService,
  type CostProjection,
  type BudgetPeriod,
} from '@/services/cost-tracker';

interface FuelCostWidgetProps {
  dailyConsumption: number | null; // L/day
  currentLevelLiters: number | null;
  daysRemaining: number | null;
  productType?: string; // diesel, petrol, etc.
  className?: string;
}

// Default prices by product type (AUD/L)
const DEFAULT_PRICES: Record<string, number> = {
  diesel: 1.85,
  petrol: 1.95,
  ulp: 1.95,
  default: 1.80,
};

export function FuelCostWidget({
  dailyConsumption,
  currentLevelLiters,
  daysRemaining,
  productType,
  className,
}: FuelCostWidgetProps) {
  const [expanded, setExpanded] = useState(false);

  // Get default price based on product type
  const defaultPrice = productType
    ? DEFAULT_PRICES[productType.toLowerCase()] || DEFAULT_PRICES.default
    : DEFAULT_PRICES.default;

  const [fuelPrice, setFuelPrice] = useState<number>(defaultPrice);

  // Calculate cost metrics
  const costMetrics = useMemo(() => {
    if (!dailyConsumption || dailyConsumption <= 0) {
      return null;
    }

    const dailyCost = dailyConsumption * fuelPrice;
    const weeklyCost = dailyCost * 7;
    const monthlyCost = dailyCost * 30;

    // Cost to refill (based on days remaining and daily consumption)
    const nextRefillLiters = daysRemaining && daysRemaining > 0 && currentLevelLiters
      ? currentLevelLiters // They'll need to refill what's currently in the tank worth of fuel
      : dailyConsumption * 14; // Default to 2 weeks worth

    const estimatedRefillCost = nextRefillLiters * fuelPrice;

    return {
      dailyCost,
      weeklyCost,
      monthlyCost,
      estimatedRefillCost,
      dailyConsumption,
    };
  }, [dailyConsumption, fuelPrice, daysRemaining, currentLevelLiters]);

  // Handle price change
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setFuelPrice(value);
    }
  };

  if (!costMetrics) {
    return null; // Don't show if no consumption data
  }

  const formatCost = (amount: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <Card className={cn('border border-gray-200 dark:border-gray-700', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-green-600" />
            Fuel Cost Estimate
          </CardTitle>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Price Configuration (expandable) */}
        {expanded && (
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 space-y-2">
            <Label htmlFor="fuel-price" className="text-xs text-gray-600 dark:text-gray-400">
              Fuel Price ($/L)
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <Input
                id="fuel-price"
                type="number"
                step="0.01"
                min="0"
                value={fuelPrice}
                onChange={handlePriceChange}
                className="w-24 h-8 text-sm"
              />
              <span className="text-xs text-gray-500">/litre</span>
            </div>
            <p className="text-xs text-gray-500">
              Adjust the fuel price to match your current rates
            </p>
          </div>
        )}

        {/* Main Cost Display */}
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatCost(costMetrics.monthlyCost)}
          </span>
          <span className="text-sm text-gray-500 dark:text-gray-400">/month</span>
        </div>

        {/* Cost Breakdown Grid */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Daily</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatCost(costMetrics.dailyCost)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Weekly</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatCost(costMetrics.weeklyCost)}
            </p>
          </div>
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
            <p className="text-xs text-green-600 dark:text-green-400">Est. Refill</p>
            <p className="font-medium text-green-700 dark:text-green-300">
              {formatCost(costMetrics.estimatedRefillCost)}
            </p>
          </div>
        </div>

        {/* Consumption Rate */}
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
          <span>Based on {costMetrics.dailyConsumption.toFixed(0)}L/day @ ${fuelPrice.toFixed(2)}/L</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default FuelCostWidget;
