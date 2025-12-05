import { useState } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format } from 'date-fns';
import { useTankReadingsWithConsumption } from '../../hooks/useCustomerAnalytics';
import { LoadingSpinner } from '../ui/loading-spinner';

interface TankConsumptionChartProps {
  assetId: string | undefined;
  defaultPeriod?: 7 | 14 | 30;
  capacityLiters?: number;
}

export function TankConsumptionChart({
  assetId,
  defaultPeriod = 7,
  capacityLiters,
}: TankConsumptionChartProps) {
  const [period, setPeriod] = useState<7 | 14 | 30>(defaultPeriod);
  const [showLitres, setShowLitres] = useState(true);

  const { data: readings, isLoading } = useTankReadingsWithConsumption(assetId, period);

  if (!assetId) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-center text-gray-500 dark:text-gray-400">No tank selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <LoadingSpinner />
      </div>
    );
  }

  if (!readings || readings.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <p className="text-center text-gray-500 dark:text-gray-400">No data available for the selected period</p>
      </div>
    );
  }

  // Transform readings for chart
  const chartData = readings.map((reading) => ({
    date: format(new Date(reading.reading_at), 'MMM d'),
    fullDate: reading.reading_at,
    fuelLitres: reading.level_liters || 0,
    fuelPercent: reading.level_percent || 0,
    consumption: reading.daily_consumption && !reading.is_refill ? Math.round(reading.daily_consumption) : null,
    isRefill: reading.is_refill,
  }));

  // Calculate warning and critical thresholds in litres
  const warningThreshold = capacityLiters ? capacityLiters * 0.25 : null;
  const criticalThreshold = capacityLiters ? capacityLiters * 0.15 : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Tank Consumption & Fuel Level
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {period}-day history
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Litres/Percentage */}
          <button
            onClick={() => setShowLitres(!showLitres)}
            className="px-3 py-1.5 text-sm font-medium rounded-md border transition-colors
                     bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600
                     text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            {showLitres ? 'Show %' : 'Show Litres'}
          </button>

          {/* Period selector */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-md p-1">
            {([7, 14, 30] as const).map((days) => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                className={`px-3 py-1 text-sm font-medium rounded transition-colors
                  ${period === days
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={400} className="mt-4">
        <ComposedChart data={chartData}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            className="dark:stroke-gray-700"
          />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            className="dark:stroke-gray-400"
            tick={{ fontSize: 12 }}
          />

          {/* Left Y-axis - Fuel Level */}
          <YAxis
            yAxisId="left"
            stroke="#3b82f6"
            tick={{ fontSize: 12 }}
            label={{
              value: showLitres ? 'Fuel Level (L)' : 'Fuel Level (%)',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12, fill: '#3b82f6' },
            }}
            domain={[0, showLitres ? (capacityLiters || 'auto') : 100]}
          />

          {/* Right Y-axis - Consumption */}
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#f59e0b"
            tick={{ fontSize: 12 }}
            label={{
              value: 'Daily Consumption (L)',
              angle: 90,
              position: 'insideRight',
              style: { fontSize: 12, fill: '#f59e0b' },
            }}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              padding: '0.75rem',
            }}
            labelStyle={{ fontWeight: 'bold', marginBottom: '0.5rem' }}
            formatter={(value: any, name: string) => {
              if (name === 'fuelLitres') return [`${Math.round(value)}L`, 'Fuel Level'];
              if (name === 'fuelPercent') return [`${Math.round(value)}%`, 'Fuel Level'];
              if (name === 'consumption') return value ? [`${value}L`, 'Daily Usage'] : ['—', 'Daily Usage'];
              return [value, name];
            }}
          />

          <Legend
            wrapperStyle={{ paddingTop: '1rem' }}
            iconType="line"
          />

          {/* Reference lines for thresholds (only in litres mode) */}
          {showLitres && warningThreshold && (
            <ReferenceLine
              yAxisId="left"
              y={warningThreshold}
              stroke="#f59e0b"
              strokeDasharray="3 3"
              label={{ value: 'Warning (25%)', position: 'right', fill: '#f59e0b', fontSize: 11 }}
            />
          )}
          {showLitres && criticalThreshold && (
            <ReferenceLine
              yAxisId="left"
              y={criticalThreshold}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{ value: 'Critical (15%)', position: 'right', fill: '#ef4444', fontSize: 11 }}
            />
          )}

          {/* Area chart for fuel level */}
          <Area
            yAxisId="left"
            type="monotone"
            dataKey={showLitres ? 'fuelLitres' : 'fuelPercent'}
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.2}
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
            name={showLitres ? 'Fuel Level (L)' : 'Fuel Level (%)'}
          />

          {/* Bar chart for consumption */}
          <Bar
            yAxisId="right"
            dataKey="consumption"
            fill="#f59e0b"
            opacity={0.8}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
            name="Daily Consumption (L)"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend for refills */}
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Fuel Level</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-amber-500"></div>
          <span>Daily Consumption</span>
        </div>
        {chartData.some(d => d.isRefill) && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span>Refill Detected</span>
          </div>
        )}
      </div>
    </div>
  );
}
