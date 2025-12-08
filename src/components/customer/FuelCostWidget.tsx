/**
 * Fuel Cost Widget
 *
 * Shows fuel cost projections for a single tank with configurable price.
 * Compact widget for the tank detail page.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Fuel,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [showPriceEdit, setShowPriceEdit] = useState(false);

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

    // Cost to refill current tank level
    const refillCost = currentLevelLiters ? currentLevelLiters * fuelPrice : null;

    return {
      dailyCost,
      weeklyCost,
      monthlyCost,
      refillCost,
      dailyConsumption,
    };
  }, [dailyConsumption, fuelPrice, currentLevelLiters]);

  // Handle price change
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setFuelPrice(value);
    }
  };

  if (!costMetrics) {
    return null;
  }

  const formatCost = (amount: number) =>
    new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <Card className={cn('border border-gray-200 dark:border-gray-700 h-full', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="h-4 w-4 text-green-600" />
            Fuel Costs
          </CardTitle>
          <button
            onClick={() => setShowPriceEdit(!showPriceEdit)}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Edit fuel price"
          >
            <Settings2 className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Price Edit */}
        {showPriceEdit && (
          <div className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800/50">
            <span className="text-sm text-gray-500">Price:</span>
            <span className="text-gray-500">$</span>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={fuelPrice}
              onChange={handlePriceChange}
              className="w-20 h-7 text-sm"
            />
            <span className="text-sm text-gray-500">/L</span>
          </div>
        )}

        {/* Monthly Cost - Hero */}
        <div className="text-center py-2">
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatCost(costMetrics.monthlyCost)}
          </p>
          <p className="text-sm text-gray-500">per month</p>
        </div>

        {/* Cost Breakdown */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800/50">
            <Calendar className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-xs text-gray-500">Daily</p>
              <p className="font-medium">{formatCost(costMetrics.dailyCost)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800/50">
            <TrendingUp className="h-4 w-4 text-purple-500" />
            <div>
              <p className="text-xs text-gray-500">Weekly</p>
              <p className="font-medium">{formatCost(costMetrics.weeklyCost)}</p>
            </div>
          </div>
        </div>

        {/* Current Tank Value */}
        {costMetrics.refillCost && (
          <div className="flex items-center gap-2 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <Fuel className="h-4 w-4 text-green-600" />
            <div className="flex-1">
              <p className="text-xs text-green-600 dark:text-green-400">Current fuel value</p>
              <p className="font-medium text-green-700 dark:text-green-300">
                {formatCost(costMetrics.refillCost)}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-gray-400 text-center">
          Based on {costMetrics.dailyConsumption.toFixed(0)}L/day @ ${fuelPrice.toFixed(2)}/L
        </p>
      </CardContent>
    </Card>
  );
}

export default FuelCostWidget;
