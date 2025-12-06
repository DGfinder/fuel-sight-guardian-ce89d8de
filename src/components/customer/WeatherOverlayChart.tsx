import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingDown, CloudRain } from 'lucide-react';
import { format } from 'date-fns';

interface WeatherOverlayChartProps {
  consumptionData: Array<{
    date: string;
    fullDate?: string;
    consumption?: number;
    avgLevel?: number;
  }>;
  weatherData?: Array<{
    date: string;
    rainfall: number;
  }>;
  totalCapacity?: number;
  height?: number;
}

export function WeatherOverlayChart({
  consumptionData,
  weatherData,
  totalCapacity,
  height = 300,
}: WeatherOverlayChartProps) {
  // Merge consumption and weather data, converting % to litres
  const mergedData = consumptionData.map((item) => {
    // Match weather by comparing formatted dates or ISO dates
    const itemDateStr = item.fullDate
      ? format(new Date(item.fullDate), 'yyyy-MM-dd')
      : null;
    const weatherItem = weatherData?.find((w) => {
      // Weather data comes as ISO date string (yyyy-MM-dd)
      return w.date === itemDateStr || w.date === item.date;
    });

    // Convert avgLevel (%) to total fleet litres
    const fuelLitres = totalCapacity && item.avgLevel != null
      ? Math.round((item.avgLevel / 100) * totalCapacity)
      : null;
    return {
      ...item,
      fuelLitres,
      rainfall: weatherItem?.rainfall || 0,
    };
  });

  const hasData = consumptionData.length > 0 && consumptionData.some((d) => d.avgLevel != null);
  const hasWeatherData = weatherData && weatherData.length > 0;
  const showLitres = totalCapacity && totalCapacity > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            7-Day Fleet Consumption
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">Total fuel levels across all tanks</p>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <TrendingDown className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No consumption data available</p>
            <p className="text-xs mt-1">Data will appear once readings are collected</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          7-Day Fleet Consumption
          {hasWeatherData && <CloudRain className="h-4 w-4 ml-auto text-blue-500" />}
        </CardTitle>
        <p className="text-sm text-gray-500 mt-1">
          {hasWeatherData
            ? 'Fuel levels and rainfall - see how weather impacts consumption'
            : 'Average fuel levels across all tanks'}
        </p>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={mergedData}>
            <defs>
              <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#008457" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#008457" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.5} />

            <XAxis
              dataKey="date"
              tickFormatter={(value) => {
                try {
                  return format(new Date(value), 'MMM d');
                } catch {
                  return value;
                }
              }}
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickLine={{ stroke: '#d1d5db' }}
            />

            {/* Left Y-Axis: Fuel Level (L or %) */}
            <YAxis
              yAxisId="fuel"
              domain={showLitres ? ['auto', 'auto'] : [0, 100]}
              tick={{ fill: '#6b7280', fontSize: 12 }}
              tickLine={{ stroke: '#d1d5db' }}
              tickFormatter={showLitres ? (value) => `${(value / 1000).toFixed(0)}k` : undefined}
              label={{
                value: showLitres ? 'Fuel Level (L)' : 'Fuel Level (%)',
                angle: -90,
                position: 'insideLeft',
                style: { fill: '#008457', fontSize: 12, fontWeight: 600 },
              }}
            />

            {/* Right Y-Axis: Rainfall (mm) */}
            {hasWeatherData && (
              <YAxis
                yAxisId="rain"
                orientation="right"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickLine={{ stroke: '#d1d5db' }}
                label={{
                  value: 'Rainfall (mm)',
                  angle: 90,
                  position: 'insideRight',
                  style: { fill: '#3b82f6', fontSize: 12, fontWeight: 600 },
                }}
              />
            )}

            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '8px 12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              }}
              labelFormatter={(value) => {
                try {
                  return format(new Date(value), 'EEEE, MMM d');
                } catch {
                  return value;
                }
              }}
              formatter={(value: any, name: string) => {
                if (name === 'fuelLitres' || name === 'avgLevel') {
                  if (showLitres && name === 'fuelLitres') {
                    return [`${value?.toLocaleString()}L`, 'Fuel Level'];
                  }
                  return [`${value?.toFixed(1)}%`, 'Fuel Level'];
                }
                if (name === 'rainfall') {
                  return [`${value?.toFixed(1)}mm`, 'Rainfall'];
                }
                return [value, name];
              }}
            />

            <Legend
              wrapperStyle={{
                paddingTop: '10px',
              }}
              formatter={(value) => {
                if (value === 'avgLevel' || value === 'fuelLitres') return 'Fuel Level';
                if (value === 'rainfall') return 'Rainfall';
                return value;
              }}
            />

            {/* Rainfall Bars (Background, translucent) */}
            {hasWeatherData && (
              <Bar
                yAxisId="rain"
                dataKey="rainfall"
                fill="url(#rainGradient)"
                radius={[4, 4, 0, 0]}
                opacity={0.4}
              />
            )}

            {/* Fuel Level Line (Foreground, prominent) */}
            <Line
              yAxisId="fuel"
              type="monotone"
              dataKey={showLitres ? 'fuelLitres' : 'avgLevel'}
              stroke="#008457"
              strokeWidth={3}
              dot={{ fill: '#008457', r: 4, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{
                r: 6,
                strokeWidth: 2,
                stroke: '#fff',
                fill: '#008457',
              }}
              fill="url(#fuelGradient)"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Weather Correlation Insight */}
        {hasWeatherData && (
          <div className="mt-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <CloudRain className="h-4 w-4" />
              <span>
                <strong>Weather Impact:</strong> Rainfall may delay deliveries or increase operations
                fuel usage (seeding, harvest). Monitor fuel levels during wet periods.
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
