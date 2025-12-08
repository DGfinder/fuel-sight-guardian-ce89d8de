import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { TrendingDown, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface TankOption {
  id: string;
  name: string;
  fillPercent: number;
}

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
    tempMin?: number;
    tempMax?: number;
  }>;
  totalCapacity?: number;
  height?: number;
  // Tank selector props
  tanks?: TankOption[];
  selectedTankId?: string;
  onTankSelect?: (tankId: string) => void;
}

export function WeatherOverlayChart({
  consumptionData,
  weatherData,
  totalCapacity,
  height = 300,
  tanks,
  selectedTankId,
  onTankSelect,
}: WeatherOverlayChartProps) {
  const showTankSelector = tanks && tanks.length > 1 && onTankSelect;
  const isFleetView = !selectedTankId || selectedTankId === 'fleet';
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

    // Convert consumption from percentage points to litres
    // item.consumption is percentage points drop (e.g., 0.5 = 0.5% drop)
    const consumptionLitres = totalCapacity && item.consumption != null
      ? Math.round((item.consumption / 100) * totalCapacity)
      : null;

    return {
      ...item,
      fuelLitres,
      consumptionLitres,
      rainfall: weatherItem?.rainfall || 0,
      tempMin: weatherItem?.tempMin,
      tempMax: weatherItem?.tempMax,
    };
  });

  // Check if consumption data exists (check converted litres, not raw percentage points)
  const hasConsumption = mergedData.some((d) => d.consumptionLitres != null && d.consumptionLitres > 0);

  const hasData = consumptionData.length > 0 && consumptionData.some((d) => d.avgLevel != null);
  const hasWeatherData = weatherData && weatherData.length > 0;
  const showLitres = totalCapacity && totalCapacity > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                7-Day Fuel Overview
              </CardTitle>
              <p className="text-sm text-gray-500 mt-1">Fuel levels and daily usage</p>
            </div>
            {showTankSelector && (
              <Select value={selectedTankId || 'fleet'} onValueChange={onTankSelect}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select tank..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fleet">Fleet Average</SelectItem>
                  {tanks?.map((tank) => (
                    <SelectItem key={tank.id} value={tank.id}>
                      <span className="flex items-center gap-2">
                        {tank.name}
                        <span className={`text-xs ${tank.fillPercent < 25 ? 'text-red-500' : 'text-gray-500'}`}>
                          ({Math.round(tank.fillPercent)}%)
                        </span>
                        {tank.fillPercent < 15 && <AlertTriangle className="h-3 w-3 text-red-500" />}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-gray-500">
            <TrendingDown className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No fuel data available</p>
            <p className="text-xs mt-1">Data will appear once readings are collected</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              7-Day Fuel Overview
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              {isFleetView
                ? (hasConsumption ? 'Fleet fuel level and daily consumption' : 'Average fuel levels across all tanks')
                : `Fuel data for ${tanks?.find(t => t.id === selectedTankId)?.name || 'selected tank'}`
              }
            </p>
          </div>
          {showTankSelector && (
            <Select value={selectedTankId || 'fleet'} onValueChange={onTankSelect}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select tank..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fleet">Fleet Average</SelectItem>
                {tanks?.map((tank) => (
                  <SelectItem key={tank.id} value={tank.id}>
                    <span className="flex items-center gap-2">
                      {tank.name}
                      <span className={`text-xs ${tank.fillPercent < 25 ? 'text-red-500' : 'text-gray-500'}`}>
                        ({Math.round(tank.fillPercent)}%)
                      </span>
                      {tank.fillPercent < 15 && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={mergedData}>
            <defs>
              <linearGradient id="fuelGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#008457" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#008457" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="consumptionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.4} />
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

            {/* Right Y-Axis: Daily Consumption (L/day) */}
            {hasConsumption && (
              <YAxis
                yAxisId="consumption"
                orientation="right"
                tick={{ fill: '#6b7280', fontSize: 12 }}
                tickLine={{ stroke: '#d1d5db' }}
                label={{
                  value: 'Usage (L/day)',
                  angle: 90,
                  position: 'insideRight',
                  style: { fill: '#f97316', fontSize: 12, fontWeight: 600 },
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
              content={({ payload }) => {
                if (!payload || payload.length === 0) return null;
                const data = payload[0]?.payload;
                // Use fullDate (ISO timestamp) for proper date formatting, not display date
                const dateToFormat = data?.fullDate ? new Date(data.fullDate) : null;
                return (
                  <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg p-3 shadow-lg">
                    <p className="font-medium text-gray-900 mb-2">
                      {dateToFormat
                        ? format(dateToFormat, 'EEEE, MMM d')
                        : data?.date || 'Unknown date'}
                    </p>
                    <div className="space-y-1 text-sm">
                      {data?.fuelLitres != null && (
                        <p className="flex justify-between gap-4">
                          <span className="text-gray-600">Fuel Level:</span>
                          <span className="font-medium text-green-700">{data.fuelLitres.toLocaleString()}L</span>
                        </p>
                      )}
                      {data?.avgLevel != null && !showLitres && (
                        <p className="flex justify-between gap-4">
                          <span className="text-gray-600">Fuel Level:</span>
                          <span className="font-medium text-green-700">{data.avgLevel.toFixed(1)}%</span>
                        </p>
                      )}
                      {data?.consumptionLitres != null && data.consumptionLitres > 0 && (
                        <p className="flex justify-between gap-4">
                          <span className="text-gray-600">Daily Usage:</span>
                          <span className="font-medium text-orange-600">{data.consumptionLitres.toLocaleString()}L</span>
                        </p>
                      )}
                      {(data?.tempMin != null || data?.tempMax != null) && (
                        <p className="flex justify-between gap-4">
                          <span className="text-gray-600">Temperature:</span>
                          <span className="font-medium text-blue-600">
                            {data.tempMin != null ? Math.round(data.tempMin) : '--'}° - {data.tempMax != null ? Math.round(data.tempMax) : '--'}°C
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              }}
            />

            <Legend
              wrapperStyle={{
                paddingTop: '10px',
              }}
              formatter={(value) => {
                if (value === 'avgLevel' || value === 'fuelLitres') return 'Fuel Level';
                if (value === 'consumption' || value === 'consumptionLitres') return 'Daily Usage';
                return value;
              }}
            />

            {/* Consumption Bars (Background, translucent) */}
            {hasConsumption && (
              <Bar
                yAxisId="consumption"
                dataKey="consumptionLitres"
                fill="url(#consumptionGradient)"
                radius={[4, 4, 0, 0]}
                opacity={0.7}
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

      </CardContent>
    </Card>
  );
}
