/**
 * LYTX Analytics Charts
 * Comprehensive data visualization components for historical safety analytics
 * Uses Recharts for interactive charts and graphs
 */

import React, { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ComposedChart, Area, AreaChart
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, Calendar } from 'lucide-react';
import { 
  useLytxMonthlyTrends,
  useLytxDriverPerformance,
  useLytxDepotAnalytics,
  useLytxTriggerAnalysis,
  type LytxAnalyticsFilters
} from '@/hooks/useLytxHistoricalData';

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  height?: number;
  className?: string;
}

const ChartContainer: React.FC<ChartContainerProps> = ({ 
  title, 
  subtitle, 
  children, 
  height = 300,
  className = '' 
}) => (
  <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
    <div className="mb-4">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-sm text-gray-600 mt-1">{subtitle}</p>}
    </div>
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  </div>
);

// Color schemes
const CARRIER_COLORS = {
  Stevemacs: '#3B82F6',
  'Great Southern Fuels': '#10B981'
};

const STATUS_COLORS = {
  'New': '#EF4444',
  'Face-To-Face': '#F59E0B', 
  'FYI Notify': '#3B82F6',
  'Resolved': '#10B981'
};

const SEVERITY_COLORS = ['#10B981', '#F59E0B', '#F97316', '#EF4444'];

// Monthly Trends Chart
interface MonthlyTrendsChartProps {
  filters: LytxAnalyticsFilters;
  height?: number;
}

export const MonthlyTrendsChart: React.FC<MonthlyTrendsChartProps> = ({ filters, height = 400 }) => {
  const { data, isLoading } = useLytxMonthlyTrends(filters);
  
  const chartData = useMemo(() => {
    if (!data) return [];
    
    return data.map(item => ({
      month: item.month,
      total: item.total,
      stevemacs: item.coachableSMB + item.driverTaggedSMB,
      gsf: item.coachableGSF + item.driverTaggedGSF,
      avgScore: item.avgScore,
      resolutionRate: item.resolutionRate,
      resolved: item.resolved
    }));
  }, [data]);

  if (isLoading) {
    return (
      <ChartContainer title="Monthly Event Trends" height={height}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer 
      title="Monthly Event Trends" 
      subtitle="Event volume and resolution trends over time"
      height={height}
    >
      <ComposedChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="month" 
          angle={-45}
          textAnchor="end"
          height={80}
          fontSize={12}
        />
        <YAxis yAxisId="events" orientation="left" />
        <YAxis yAxisId="rate" orientation="right" />
        <Tooltip 
          formatter={(value, name) => {
            if (name === 'resolutionRate') return [`${value}%`, 'Resolution Rate'];
            if (name === 'avgScore') return [value, 'Avg Score'];
            return [value, name];
          }}
        />
        <Legend />
        
        <Bar yAxisId="events" dataKey="stevemacs" stackId="carriers" fill={CARRIER_COLORS.Stevemacs} name="Stevemacs" />
        <Bar yAxisId="events" dataKey="gsf" stackId="carriers" fill={CARRIER_COLORS['Great Southern Fuels']} name="Great Southern Fuels" />
        <Line yAxisId="rate" type="monotone" dataKey="resolutionRate" stroke="#10B981" strokeWidth={3} name="Resolution Rate (%)" />
        <Line yAxisId="rate" type="monotone" dataKey="avgScore" stroke="#F59E0B" strokeWidth={2} name="Avg Score" />
      </ComposedChart>
    </ChartContainer>
  );
};

// Driver Performance Scatter Chart
interface DriverPerformanceChartProps {
  filters: LytxAnalyticsFilters;
  height?: number;
}

export const DriverPerformanceChart: React.FC<DriverPerformanceChartProps> = ({ filters, height = 400 }) => {
  const { data, isLoading } = useLytxDriverPerformance(filters);
  
  const chartData = useMemo(() => {
    if (!data) return [];
    
    return data
      .filter(driver => driver.totalEvents >= 3) // Only show drivers with significant data
      .slice(0, 50) // Top 50 drivers
      .map(driver => ({
        driver: driver.driver.length > 20 ? driver.driver.substring(0, 20) + '...' : driver.driver,
        totalEvents: driver.totalEvents,
        avgScore: driver.avgScore,
        resolutionRate: driver.resolutionRate,
        carrier: driver.carrier
      }));
  }, [data]);

  if (isLoading) {
    return (
      <ChartContainer title="Driver Performance Analysis" height={height}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer 
      title="Driver Performance Analysis" 
      subtitle="Event volume vs average score by driver (bubble size = resolution rate)"
      height={height}
    >
      <ScatterChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="totalEvents" 
          type="number" 
          name="Total Events"
          label={{ value: 'Total Events', position: 'insideBottom', offset: -10 }}
        />
        <YAxis 
          dataKey="avgScore" 
          type="number" 
          name="Avg Score"
          label={{ value: 'Average Score', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip 
          formatter={(value, name, props) => {
            const data = props.payload;
            return [
              [`Driver: ${data.driver}`, ''],
              [`Events: ${data.totalEvents}`, ''],
              [`Avg Score: ${data.avgScore}`, ''],
              [`Resolution Rate: ${data.resolutionRate}%`, ''],
              [`Carrier: ${data.carrier}`, '']
            ];
          }}
          labelFormatter={() => 'Driver Performance'}
        />
        
        <Scatter 
          dataKey="resolutionRate" 
          fill={(entry) => entry.carrier === 'Stevemacs' ? CARRIER_COLORS.Stevemacs : CARRIER_COLORS['Great Southern Fuels']}
        />
      </ScatterChart>
    </ChartContainer>
  );
};

// Depot Comparison Chart
interface DepotComparisonChartProps {
  filters: LytxAnalyticsFilters;
  height?: number;
}

export const DepotComparisonChart: React.FC<DepotComparisonChartProps> = ({ filters, height = 350 }) => {
  const { data, isLoading } = useLytxDepotAnalytics(filters);
  
  const chartData = useMemo(() => {
    if (!data) return [];
    
    return data.map(depot => ({
      depot: depot.depot.length > 15 ? depot.depot.substring(0, 15) + '...' : depot.depot,
      fullDepot: depot.depot,
      totalEvents: depot.totalEvents,
      avgScore: depot.avgScore,
      resolutionRate: depot.resolutionRate,
      unassignedRate: depot.unassignedRate,
      carrier: depot.carrier
    }));
  }, [data]);

  if (isLoading) {
    return (
      <ChartContainer title="Depot Performance Comparison" height={height}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </ChartContainer>
    );
  }

  return (
    <ChartContainer 
      title="Depot Performance Comparison" 
      subtitle="Event volume and performance metrics by depot"
      height={height}
    >
      <ComposedChart data={chartData} margin={{ bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="depot" 
          angle={-45}
          textAnchor="end"
          height={80}
          fontSize={11}
        />
        <YAxis yAxisId="events" orientation="left" />
        <YAxis yAxisId="rate" orientation="right" />
        <Tooltip 
          formatter={(value, name, props) => {
            const data = props.payload;
            return [
              [`Depot: ${data.fullDepot}`, ''],
              [`Total Events: ${data.totalEvents}`, ''],
              [`Avg Score: ${data.avgScore}`, ''],
              [`Resolution Rate: ${data.resolutionRate}%`, ''],
              [`Unassigned Rate: ${data.unassignedRate}%`, ''],
              [`Carrier: ${data.carrier}`, '']
            ];
          }}
          labelFormatter={() => 'Depot Performance'}
        />
        <Legend />
        
        <Bar 
          yAxisId="events" 
          dataKey="totalEvents" 
          fill="#6366F1" 
          name="Total Events"
        />
        <Line 
          yAxisId="rate" 
          type="monotone" 
          dataKey="resolutionRate" 
          stroke="#10B981" 
          strokeWidth={3} 
          name="Resolution Rate (%)" 
        />
        <Line 
          yAxisId="rate" 
          type="monotone" 
          dataKey="avgScore" 
          stroke="#F59E0B" 
          strokeWidth={2} 
          name="Avg Score" 
        />
      </ComposedChart>
    </ChartContainer>
  );
};

// Event Triggers Distribution
interface TriggerDistributionChartProps {
  filters: LytxAnalyticsFilters;
  height?: number;
  maxTriggers?: number;
}

export const TriggerDistributionChart: React.FC<TriggerDistributionChartProps> = ({ 
  filters, 
  height = 400,
  maxTriggers = 15 
}) => {
  const { data, isLoading } = useLytxTriggerAnalysis(filters);
  
  const chartData = useMemo(() => {
    if (!data) return [];
    
    return data
      .slice(0, maxTriggers)
      .map((trigger, index) => ({
        trigger: trigger.trigger.length > 30 ? trigger.trigger.substring(0, 30) + '...' : trigger.trigger,
        fullTrigger: trigger.trigger,
        count: trigger.count,
        percentage: trigger.percentage,
        avgScore: trigger.avgScore,
        resolutionRate: trigger.resolutionRate,
        fill: SEVERITY_COLORS[index % SEVERITY_COLORS.length]
      }));
  }, [data, maxTriggers]);

  if (isLoading) {
    return (
      <ChartContainer title="Event Triggers Distribution" height={height}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </ChartContainer>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <ChartContainer 
        title="Top Event Triggers" 
        subtitle="Most common safety event triggers"
        height={height}
      >
        <BarChart data={chartData} layout="horizontal">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis 
            type="category" 
            dataKey="trigger" 
            width={120}
            fontSize={10}
          />
          <Tooltip 
            formatter={(value, name, props) => {
              const data = props.payload;
              return [
                [`Trigger: ${data.fullTrigger}`, ''],
                [`Count: ${data.count}`, ''],
                [`Percentage: ${data.percentage}%`, ''],
                [`Avg Score: ${data.avgScore}`, ''],
                [`Resolution Rate: ${data.resolutionRate}%`, '']
              ];
            }}
            labelFormatter={() => 'Trigger Details'}
          />
          <Bar dataKey="count" fill="#6366F1" />
        </BarChart>
      </ChartContainer>

      <ChartContainer 
        title="Trigger Distribution" 
        subtitle="Proportional view of event triggers"
        height={height}
      >
        <PieChart>
          <Pie
            data={chartData.slice(0, 8)} // Top 8 for better readability
            cx="50%"
            cy="50%"
            labelLine={false}
            label={(entry) => `${entry.percentage}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="count"
          >
            {chartData.slice(0, 8).map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value, name, props) => {
              const data = props.payload;
              return [
                [`${data.fullTrigger}`, ''],
                [`Count: ${value}`, ''],
                [`Percentage: ${data.percentage}%`, '']
              ];
            }}
          />
          <Legend 
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry) => entry.payload.trigger}
          />
        </PieChart>
      </ChartContainer>
    </div>
  );
};

// Comprehensive Safety Score Analysis
interface SafetyScoreAnalysisProps {
  filters: LytxAnalyticsFilters;
  height?: number;
}

export const SafetyScoreAnalysis: React.FC<SafetyScoreAnalysisProps> = ({ filters, height = 300 }) => {
  const { data: monthlyData } = useLytxMonthlyTrends(filters);
  
  const scoreDistribution = useMemo(() => {
    if (!monthlyData) return [];
    
    const scoreRanges = [
      { range: '0-2', min: 0, max: 2, count: 0, color: '#10B981' },
      { range: '3-4', min: 3, max: 4, count: 0, color: '#3B82F6' },
      { range: '5-6', min: 5, max: 6, count: 0, color: '#F59E0B' },
      { range: '7-8', min: 7, max: 8, count: 0, color: '#F97316' },
      { range: '9-10', min: 9, max: 10, count: 0, color: '#EF4444' }
    ];

    // Simulate score distribution based on average scores
    // In real implementation, you'd want to get this from the raw event data
    monthlyData.forEach(month => {
      const score = Math.floor(month.avgScore);
      const range = scoreRanges.find(r => score >= r.min && score <= r.max);
      if (range) {
        range.count += month.total;
      }
    });

    return scoreRanges.filter(r => r.count > 0);
  }, [monthlyData]);

  return (
    <ChartContainer 
      title="Safety Score Distribution" 
      subtitle="Distribution of events by safety risk score"
      height={height}
    >
      <BarChart data={scoreDistribution}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="range" label={{ value: 'Score Range', position: 'insideBottom', offset: -10 }} />
        <YAxis label={{ value: 'Event Count', angle: -90, position: 'insideLeft' }} />
        <Tooltip 
          formatter={(value, name) => [`${value} events`, 'Count']}
          labelFormatter={(label) => `Score Range: ${label}`}
        />
        <Bar dataKey="count" fill="#6366F1" />
      </BarChart>
    </ChartContainer>
  );
};

// Export all charts as a collection
export const LytxAnalyticsCharts = {
  MonthlyTrends: MonthlyTrendsChart,
  DriverPerformance: DriverPerformanceChart,
  DepotComparison: DepotComparisonChart,
  TriggerDistribution: TriggerDistributionChart,
  SafetyScoreAnalysis: SafetyScoreAnalysis
};