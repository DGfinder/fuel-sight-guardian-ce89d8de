/**
 * MtData Analytics Charts
 * Reusable chart components for MtData trip analytics visualization
 * Uses Recharts for interactive charts and graphs
 */

import React from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, AreaChart, Area
} from 'recharts';
import { TrendingUp, TrendingDown, Truck, Clock, Users, Navigation } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  type DailyTripMetrics,
  type VehicleUtilization,
  type DriverPerformance,
  type RouteAnalysis,
  type DepotMetrics
} from '@/hooks/useMtDataAnalytics';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

const ChartContainer: React.FC<ChartContainerProps> = ({ 
  title, 
  subtitle, 
  children, 
  height = 300,
  className = '',
  icon: Icon
}) => (
  <Card className={`${className}`}>
    <CardHeader className="pb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-gray-600" />}
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </div>
      {subtitle && <CardDescription>{subtitle}</CardDescription>}
    </CardHeader>
    <CardContent>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);

// Color schemes
const colors = {
  primary: '#059669', // emerald-600
  secondary: '#0891b2', // cyan-600
  accent: '#7c3aed', // violet-600
  warning: '#ea580c', // orange-600
  success: '#16a34a', // green-600
  muted: '#6b7280' // gray-500
};

const chartColors = [colors.primary, colors.secondary, colors.accent, colors.warning, colors.success];

/**
 * Daily Trip Trends Chart
 */
interface DailyTrendChartProps {
  data: DailyTripMetrics[];
  metric: 'tripCount' | 'totalDistance' | 'uniqueVehicles';
  title?: string;
}

export const DailyTrendChart: React.FC<DailyTrendChartProps> = ({ 
  data, 
  metric, 
  title 
}) => {
  const getMetricConfig = () => {
    switch (metric) {
      case 'tripCount':
        return { label: 'Trip Count', color: colors.primary, unit: '' };
      case 'totalDistance':
        return { label: 'Distance (km)', color: colors.secondary, unit: 'km' };
      case 'uniqueVehicles':
        return { label: 'Active Vehicles', color: colors.accent, unit: '' };
      default:
        return { label: 'Value', color: colors.primary, unit: '' };
    }
  };

  const config = getMetricConfig();
  
  return (
    <ChartContainer 
      title={title || `Daily ${config.label} Trends`}
      subtitle="30-day trend analysis of operational metrics"
      icon={TrendingUp}
    >
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis 
          dataKey="date" 
          stroke="#64748b"
          fontSize={12}
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
        />
        <YAxis stroke="#64748b" fontSize={12} />
        <Tooltip 
          formatter={(value: any, name: string) => [`${value}${config.unit}`, config.label]}
          labelFormatter={(label) => new Date(label).toLocaleDateString('en-AU')}
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Area 
          type="monotone" 
          dataKey={metric} 
          stroke={config.color} 
          fill={config.color}
          fillOpacity={0.2}
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
};

/**
 * Vehicle Utilization Chart
 */
interface VehicleUtilizationChartProps {
  data: VehicleUtilization[];
  topN?: number;
}

export const VehicleUtilizationChart: React.FC<VehicleUtilizationChartProps> = ({ 
  data, 
  topN = 15 
}) => {
  const chartData = data.slice(0, topN).map(vehicle => ({
    vehicle: vehicle.vehicleRegistration,
    trips: vehicle.tripCount,
    distance: vehicle.totalDistance,
    utilization: vehicle.utilizationScore,
    hours: vehicle.totalTime
  }));

  return (
    <ChartContainer 
      title="Vehicle Utilization Analysis"
      subtitle={`Top ${topN} vehicles by utilization score`}
      icon={Truck}
      height={400}
    >
      <BarChart data={chartData} layout="horizontal">
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis type="number" stroke="#64748b" fontSize={12} />
        <YAxis 
          type="category" 
          dataKey="vehicle" 
          width={80}
          stroke="#64748b" 
          fontSize={11}
        />
        <Tooltip 
          formatter={(value: any, name: string) => {
            switch (name) {
              case 'trips': return [`${value}`, 'Trips'];
              case 'distance': return [`${value} km`, 'Distance'];
              case 'utilization': return [`${value}%`, 'Utilization'];
              default: return [value, name];
            }
          }}
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Bar dataKey="utilization" fill={colors.primary} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
};

/**
 * Driver Performance Chart
 */
interface DriverPerformanceChartProps {
  data: DriverPerformance[];
  topN?: number;
}

export const DriverPerformanceChart: React.FC<DriverPerformanceChartProps> = ({ 
  data, 
  topN = 10 
}) => {
  const chartData = data.slice(0, topN).map(driver => ({
    driver: driver.driverName.length > 15 ? driver.driverName.substring(0, 15) + '...' : driver.driverName,
    efficiency: driver.efficiencyScore,
    trips: driver.tripCount,
    distance: driver.totalDistance
  }));

  return (
    <ChartContainer 
      title="Driver Performance Rankings"
      subtitle={`Top ${topN} drivers by efficiency (km/hour)`}
      icon={Users}
      height={350}
    >
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis 
          dataKey="driver" 
          stroke="#64748b" 
          fontSize={11}
          angle={-45}
          textAnchor="end"
          height={100}
        />
        <YAxis stroke="#64748b" fontSize={12} />
        <Tooltip 
          formatter={(value: any, name: string) => {
            switch (name) {
              case 'efficiency': return [`${value} km/h`, 'Efficiency'];
              case 'trips': return [`${value}`, 'Trips'];
              case 'distance': return [`${value} km`, 'Distance'];
              default: return [value, name];
            }
          }}
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Bar dataKey="efficiency" fill={colors.secondary} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
};

/**
 * Route Analysis Scatter Plot
 */
interface RouteAnalysisChartProps {
  data: RouteAnalysis[];
}

export const RouteAnalysisChart: React.FC<RouteAnalysisChartProps> = ({ data }) => {
  const chartData = data.map(route => ({
    distance: route.avgDistance,
    duration: route.avgDuration,
    efficiency: route.routeEfficiency,
    trips: route.tripCount,
    route: `${route.startLocation} → ${route.endLocation}`,
    shortRoute: route.startLocation.substring(0, 8) + '→' + route.endLocation.substring(0, 8)
  }));

  return (
    <ChartContainer 
      title="Route Efficiency Analysis"
      subtitle="Distance vs Duration with trip frequency (bubble size)"
      icon={Navigation}
      height={400}
    >
      <ScatterChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis 
          type="number" 
          dataKey="distance" 
          name="Distance (km)"
          stroke="#64748b" 
          fontSize={12}
          label={{ value: 'Average Distance (km)', position: 'insideBottom', offset: -10 }}
        />
        <YAxis 
          type="number" 
          dataKey="duration" 
          name="Duration (hours)"
          stroke="#64748b" 
          fontSize={12}
          label={{ value: 'Average Duration (hours)', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip 
          formatter={(value: any, name: string) => {
            switch (name) {
              case 'distance': return [`${value} km`, 'Avg Distance'];
              case 'duration': return [`${value} h`, 'Avg Duration'];
              case 'efficiency': return [`${value} km/h`, 'Efficiency'];
              case 'trips': return [`${value}`, 'Trip Count'];
              default: return [value, name];
            }
          }}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.route || ''}
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Scatter 
          dataKey="trips" 
          fill={colors.accent}
          fillOpacity={0.7}
          stroke={colors.accent}
          strokeWidth={2}
        />
      </ScatterChart>
    </ChartContainer>
  );
};

/**
 * Depot Metrics Chart (GSF specific)
 */
interface DepotMetricsChartProps {
  data: DepotMetrics[];
}

export const DepotMetricsChart: React.FC<DepotMetricsChartProps> = ({ data }) => {
  const chartData = data.map(depot => ({
    depot: depot.depot.length > 12 ? depot.depot.substring(0, 12) + '...' : depot.depot,
    fullDepot: depot.depot,
    trips: depot.tripCount,
    vehicles: depot.vehicleCount,
    distance: depot.totalDistance,
    utilization: depot.avgUtilization
  }));

  return (
    <ChartContainer 
      title="Depot Performance Comparison"
      subtitle="Trip volume and vehicle utilization by depot"
      icon={Truck}
      height={350}
    >
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis 
          dataKey="depot" 
          stroke="#64748b" 
          fontSize={11}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis yAxisId="left" stroke="#64748b" fontSize={12} />
        <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={12} />
        <Tooltip 
          formatter={(value: any, name: string) => {
            switch (name) {
              case 'trips': return [`${value}`, 'Total Trips'];
              case 'vehicles': return [`${value}`, 'Vehicle Count'];
              case 'distance': return [`${value} km`, 'Total Distance'];
              case 'utilization': return [`${value}`, 'Avg Trips/Vehicle'];
              default: return [value, name];
            }
          }}
          labelFormatter={(label, payload) => payload?.[0]?.payload?.fullDepot || label}
          contentStyle={{ 
            backgroundColor: 'white', 
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
        />
        <Legend />
        <Bar yAxisId="left" dataKey="trips" fill={colors.primary} name="Trip Count" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="right" dataKey="utilization" fill={colors.secondary} name="Utilization" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
};

/**
 * KPI Summary Cards
 */
interface KPISummaryProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning';
}

export const KPISummary: React.FC<KPISummaryProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  color = 'primary'
}) => {
  const colorClasses = {
    primary: 'text-emerald-600 bg-emerald-50',
    secondary: 'text-cyan-600 bg-cyan-50', 
    accent: 'text-violet-600 bg-violet-50',
    success: 'text-green-600 bg-green-50',
    warning: 'text-orange-600 bg-orange-50'
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                <Icon className="w-6 h-6" />
              </div>
            )}
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-600">{title}</p>
              {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </div>
          </div>
          {trend && trendValue && TrendIcon && (
            <div className={`flex items-center gap-1 text-sm ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              <TrendIcon className="w-4 h-4" />
              <span>{trendValue}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};