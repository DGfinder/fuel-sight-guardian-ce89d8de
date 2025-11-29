import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  LabelList
} from 'recharts';
import { Tank } from '@/types/fuel';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';

interface TankBarChartProps {
  tanks: Tank[];
  subgroupName: string;
}

interface ChartData {
  name: string;
  fuelLevel: number;
  emptySpace: number;
  volume: number;
  percentage: number;
  isStale: boolean;
  location: string;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

// Check if dip data is stale (>24 hours old)
const isDataStale = (lastDipDate: string | undefined): boolean => {
  if (!lastDipDate) return true;

  const now = new Date();
  const dipDate = new Date(lastDipDate);
  const hoursDiff = (now.getTime() - dipDate.getTime()) / (1000 * 60 * 60);

  return hoursDiff > 24;
};

// Determine health status based on fuel level percentage
const getHealthStatus = (percentage: number): 'healthy' | 'warning' | 'critical' => {
  if (percentage > 30) return 'healthy';
  if (percentage >= 15) return 'warning';
  return 'critical';
};

// Get color based on health status
const getHealthColor = (healthStatus: 'healthy' | 'warning' | 'critical'): string => {
  switch (healthStatus) {
    case 'healthy':
      return '#22c55e'; // green-500
    case 'warning':
      return '#eab308'; // yellow-500
    case 'critical':
      return '#ef4444'; // red-500
    default:
      return '#3b82f6'; // blue-500 fallback
  }
};

// Format tank name for display (shorten if needed)
const formatTankName = (location: string | undefined): string => {
  if (!location) return 'Unknown';

  // Remove common prefixes to make names shorter
  const shortened = location
    .replace(/^Fuel\s+/i, '')
    .replace(/\s+Tank\s+/i, ' T');

  return shortened.length > 15 ? shortened.substring(0, 15) + '...' : shortened;
};

// Custom label for bars showing percentage and volume
const CustomLabel = (props: any) => {
  const { x, y, width, height, value, data } = props;

  if (!data || value === 0) return null;

  const percentage = data.percentage || 0;
  const volume = data.volume || 0;

  // Only show label if there's enough space
  if (height < 30) return null;

  return (
    <text
      x={x + width / 2}
      y={y + height / 2}
      fill="white"
      textAnchor="middle"
      dominantBaseline="middle"
      className="text-xs font-semibold"
    >
      {`${percentage}%`}
      <tspan x={x + width / 2} dy="1.2em" className="text-[10px] font-normal">
        {`(${volume.toLocaleString()}L)`}
      </tspan>
    </text>
  );
};

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;

    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-semibold text-gray-900 mb-1">{data.location}</p>
        <p className="text-sm text-gray-700">
          Fuel Level: <span className="font-semibold text-blue-600">{data.percentage}%</span>
        </p>
        <p className="text-sm text-gray-700">
          Volume: <span className="font-semibold">{data.volume.toLocaleString()} L</span>
        </p>
        {data.isStale && (
          <p className="text-xs text-red-600 mt-1">
            ⚠️ Data &gt;24 hours old
          </p>
        )}
      </div>
    );
  }

  return null;
};

export default function TankBarChart({ tanks, subgroupName }: TankBarChartProps) {
  // Prepare chart data
  const chartData: ChartData[] = tanks
    .filter(tank => tank.current_level_percent !== null && tank.current_level_percent !== undefined)
    .map(tank => {
      const percentage = tank.current_level_percent || 0;
      const volume = tank.current_level || 0;
      const isStale = isDataStale(tank.latest_dip_date);
      const healthStatus = getHealthStatus(percentage);

      return {
        name: formatTankName(tank.location),
        fuelLevel: percentage,
        emptySpace: 100 - percentage,
        volume,
        percentage,
        isStale,
        location: tank.location || 'Unknown',
        healthStatus
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  if (chartData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No tank data available for {subgroupName}</p>
      </div>
    );
  }

  // Calculate dynamic height based on number of tanks
  const chartHeight = Math.min(400, Math.max(250, chartData.length * 40));

  // Chart config for shadcn theming
  const chartConfig = {
    fuelLevel: {
      label: "Fuel Level",
      theme: {
        light: "hsl(var(--chart-1))",
        dark: "hsl(var(--chart-1))"
      }
    },
    emptySpace: {
      label: "Empty Capacity",
      theme: {
        light: "#e5e7eb",
        dark: "#374151"
      }
    }
  } satisfies ChartConfig;

  return (
    <div className="w-full">
      <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />

          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fontSize: 12, fill: '#6b7280' }}
          />

          <YAxis
            label={{ value: 'Fuel Level (%)', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            domain={[0, 100]}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="circle"
          />

          {/* Fuel level bar (stacked) */}
          <Bar
            dataKey="fuelLevel"
            stackId="a"
            name="Fuel Level"
            radius={[0, 0, 0, 0]}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getHealthColor(entry.healthStatus)}
              />
            ))}
            <LabelList
              dataKey="fuelLevel"
              content={(props) => <CustomLabel {...props} data={chartData[props.index]} />}
            />
          </Bar>

          {/* Empty space bar (stacked) */}
          <Bar
            dataKey="emptySpace"
            stackId="a"
            name="Empty Capacity"
            fill="var(--color-emptySpace, #e5e7eb)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>

      {/* Legend with health status */}
      <div className="flex items-center justify-center gap-6 mt-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Healthy (&gt;30%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span>Warning (15-30%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>Critical (&lt;15%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
          <span>Empty Capacity</span>
        </div>
      </div>
    </div>
  );
}
