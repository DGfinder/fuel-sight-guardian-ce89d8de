/**
 * MONTHLY VOLUME CHART - COMPLIANCE READY
 * 
 * Professional monthly fuel volume trend chart for compliance reporting
 * Replicates PowerBI functionality with clean, export-ready presentation
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Download, Calendar } from 'lucide-react';
import type { MonthlyAnalytics } from '@/types/captivePayments';

interface MonthlyVolumeChartProps {
  data: MonthlyAnalytics[];
  carrier?: 'SMB' | 'GSF' | 'Combined';
  showExportButton?: boolean;
  className?: string;
}

interface ChartDataPoint {
  month: string;
  shortMonth: string;
  year: number;
  volumeMegaLitres: number;
  volumeFormatted: string;
  deliveries: number;
  customers: number;
  period: string;
}

const MonthlyVolumeChart: React.FC<MonthlyVolumeChartProps> = ({
  data,
  carrier = 'Combined',
  showExportButton = true,
  className = ''
}) => {
  // Transform data for chart display
  const chartData: ChartDataPoint[] = React.useMemo(() => {
    console.log(`MonthlyVolumeChart: Processing ${data.length} items for carrier: ${carrier}`);
    
    return data
      .filter(item => {
        const shouldInclude = carrier === 'Combined' || item.carrier === carrier;
        return shouldInclude;
      })
      .reduce((acc, item) => {
        const monthKey = `${item.year}-${item.month.toString().padStart(2, '0')}`;
        const existing = acc.find(d => d.period === monthKey);
        
        if (existing) {
          // Combine data for multiple carriers in same month
          existing.volumeMegaLitres += item.total_volume_megalitres;
          existing.deliveries += item.total_deliveries;
          existing.customers += item.unique_customers;
          existing.volumeFormatted = `${existing.volumeMegaLitres.toFixed(1)}M`;
        } else {
          acc.push({
            month: item.month_name,
            shortMonth: item.month_name.substring(0, 3),
            year: item.year,
            volumeMegaLitres: item.total_volume_megalitres,
            volumeFormatted: `${item.total_volume_megalitres.toFixed(1)}M`,
            deliveries: item.total_deliveries,
            customers: item.unique_customers,
            period: monthKey
          });
        }
        return acc;
      }, [] as ChartDataPoint[])
      .sort((a, b) => a.period.localeCompare(b.period))
      .slice(-12); // Show last 12 months
    
    console.log(`MonthlyVolumeChart: Generated ${chartData.length} chart points for ${carrier}`);
    return chartData;
  }, [data, carrier]);

  // Calculate totals for summary
  const totalVolume = chartData.reduce((sum, item) => sum + item.volumeMegaLitres, 0);
  const totalDeliveries = chartData.reduce((sum, item) => sum + item.deliveries, 0);
  const averageMonthlyVolume = totalVolume / Math.max(chartData.length, 1);
  
  // Calculate trend (last month vs previous month)
  const lastMonth = chartData[chartData.length - 1];
  const previousMonth = chartData[chartData.length - 2];
  const trend = lastMonth && previousMonth 
    ? ((lastMonth.volumeMegaLitres - previousMonth.volumeMegaLitres) / previousMonth.volumeMegaLitres) * 100
    : 0;

  const handleExport = () => {
    // Simple CSV export for compliance reports
    const csvData = [
      ['Month', 'Year', 'Volume (ML)', 'Deliveries', 'Customers'],
      ...chartData.map(item => [
        item.month,
        item.year.toString(),
        item.volumeMegaLitres.toFixed(2),
        item.deliveries.toString(),
        item.customers.toString()
      ])
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monthly-volume-${carrier.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Custom tooltip for professional presentation
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 shadow-lg rounded-lg border">
          <p className="font-semibold text-gray-900">{`${data.month} ${data.year}`}</p>
          <p className="text-blue-600">
            <span className="font-medium">Volume: </span>
            {`${data.volumeMegaLitres.toFixed(1)} ML`}
          </p>
          <p className="text-green-600">
            <span className="font-medium">Deliveries: </span>
            {data.deliveries.toLocaleString()}
          </p>
          <p className="text-purple-600">
            <span className="font-medium">Customers: </span>
            {data.customers.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Total Volume by Month
            </CardTitle>
            <CardDescription className="text-gray-600 mt-1">
              Monthly fuel delivery volume trend for compliance reporting
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            {showExportButton && (
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            )}
            <Badge variant="outline" className="text-blue-700 border-blue-200">
              <Calendar className="w-4 h-4 mr-1" />
              {carrier}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Summary Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {totalVolume.toFixed(1)}M
            </div>
            <div className="text-sm text-gray-600">Total Volume</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {totalDeliveries.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Total Deliveries</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {averageMonthlyVolume.toFixed(1)}M
            </div>
            <div className="text-sm text-gray-600">Avg/Month</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Month Trend</div>
          </div>
        </div>

        {/* Main Chart */}
        <div className="h-80 w-full">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="shortMonth"
                  stroke="#666"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#666"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value}M`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="volumeMegaLitres"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ fill: '#2563eb', strokeWidth: 2, r: 5 }}
                  activeDot={{ r: 7, fill: '#1d4ed8' }}
                />
                {/* Add average line for reference */}
                <ReferenceLine 
                  y={averageMonthlyVolume} 
                  stroke="#9ca3af" 
                  strokeDasharray="5 5"
                  label={{ value: "Average", position: "insideTopRight" }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium">No monthly data available</p>
                <p className="text-sm">Data will appear once analytics are populated</p>
              </div>
            </div>
          )}
        </div>

        {/* Data Labels (PowerBI Style) */}
        {chartData.length > 0 && (
          <div className="mt-4 flex justify-center">
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              {chartData.slice(-6).map((item, index) => (
                <div key={item.period} className="text-center">
                  <div className="font-medium text-blue-600">{item.volumeFormatted}</div>
                  <div className="text-xs">{item.shortMonth} {item.year}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MonthlyVolumeChart;