import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { TrendingUp, TrendingDown, BarChart3, Activity } from 'lucide-react';

interface MonthlyData {
  month: string;
  smbDeliveries: number;
  gsfDeliveries: number;
  totalDeliveries: number;
  smbVolume: number;
  gsfVolume: number;
  totalVolume: number;
}

interface DeliveryTrendChartsProps {
  monthlyData: MonthlyData[];
  currentMonth: {
    totalDeliveries: number;
    totalVolume: number;
    period: string;
  };
}

const DeliveryTrendCharts: React.FC<DeliveryTrendChartsProps> = ({ 
  monthlyData, 
  currentMonth 
}) => {
  
  // Format data for charts
  const chartData = monthlyData.map(month => ({
    ...month,
    // Convert volume to millions for better readability
    smbVolumeMill: Number((month.smbVolume / 1000000).toFixed(2)),
    gsfVolumeMill: Number((month.gsfVolume / 1000000).toFixed(2)),
    totalVolumeMill: Number((month.totalVolume / 1000000).toFixed(2)),
    // Calculate average volume per delivery
    avgVolumePerDelivery: Math.round(month.totalVolume / month.totalDeliveries)
  }));

  // Calculate trends
  const lastThreeMonths = chartData.slice(-3);
  const deliveryTrend = lastThreeMonths[2].totalDeliveries - lastThreeMonths[0].totalDeliveries;
  const volumeTrend = lastThreeMonths[2].totalVolume - lastThreeMonths[0].totalVolume;

  // Custom tooltip for better data presentation
  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{name: string; value: number; color: string; dataKey: string}>; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{`${label} 2024`}</p>
          {payload.map((entry, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {`${entry.name}: ${entry.value.toLocaleString()}`}
              {entry.dataKey.includes('Volume') && ' L'}
              {entry.dataKey.includes('Mill') && 'M L'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Monthly BOL Delivery Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Monthly BOL Delivery Trend
          </CardTitle>
          <CardDescription>
            Compliance Metric #1: Number of deliveries per month
          </CardDescription>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-blue-700 bg-blue-50">
              Current: {currentMonth.totalDeliveries.toLocaleString()} BOLs
            </Badge>
            <Badge 
              variant="outline" 
              className={deliveryTrend >= 0 ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"}
            >
              {deliveryTrend >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              3-month trend: {deliveryTrend > 0 ? '+' : ''}{deliveryTrend}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar 
                dataKey="smbDeliveries" 
                stackId="deliveries"
                fill="#3b82f6" 
                name="SMB Deliveries"
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="gsfDeliveries" 
                stackId="deliveries"
                fill="#10b981" 
                name="GSF Deliveries"
                radius={[4, 4, 0, 0]}
              />
              <Line 
                type="monotone" 
                dataKey="totalDeliveries" 
                stroke="#f59e0b" 
                strokeWidth={3}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                name="Total BOLs"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Volume Delivery Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-green-600" />
            Monthly Volume Trend
          </CardTitle>
          <CardDescription>
            Compliance Metric #2: Volume of fuel delivered per month
          </CardDescription>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-green-700 bg-green-50">
              Current: {(currentMonth.totalVolume / 1000000).toFixed(1)}M liters
            </Badge>
            <Badge 
              variant="outline" 
              className={volumeTrend >= 0 ? "text-green-700 bg-green-50" : "text-red-700 bg-red-50"}
            >
              {volumeTrend >= 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              3-month trend: {volumeTrend > 0 ? '+' : ''}{(volumeTrend / 1000000).toFixed(1)}M L
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#666"
                label={{ value: 'Million Liters', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar 
                dataKey="smbVolumeMill" 
                stackId="volume"
                fill="#3b82f6" 
                name="SMB Volume (M L)"
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="gsfVolumeMill" 
                stackId="volume"
                fill="#10b981" 
                name="GSF Volume (M L)"
                radius={[4, 4, 0, 0]}
              />
              <Line 
                type="monotone" 
                dataKey="totalVolumeMill" 
                stroke="#f59e0b" 
                strokeWidth={3}
                dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                name="Total Volume (M L)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Delivery Efficiency Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            Delivery Efficiency Trend
          </CardTitle>
          <CardDescription>
            Average volume per BOL delivery over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#666"
                label={{ value: 'Liters per BOL', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line 
                type="monotone" 
                dataKey="avgVolumePerDelivery" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 6 }}
                name="Avg Volume per BOL"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Carrier Performance Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-600" />
            Carrier Performance Comparison
          </CardTitle>
          <CardDescription>
            SMB vs GSF delivery trends over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                stroke="#666"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#666"
                label={{ value: 'Number of BOLs', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="smbDeliveries" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                name="SMB Deliveries"
              />
              <Line 
                type="monotone" 
                dataKey="gsfDeliveries" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                name="GSF Deliveries"
              />
            </LineChart>
          </ResponsiveContainer>
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">
                {Math.round(chartData.reduce((acc, month) => acc + month.smbDeliveries, 0) / chartData.length)}
              </div>
              <div className="text-sm text-gray-500">Avg SMB BOLs/month</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                {Math.round(chartData.reduce((acc, month) => acc + month.gsfDeliveries, 0) / chartData.length)}
              </div>
              <div className="text-sm text-gray-500">Avg GSF BOLs/month</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DeliveryTrendCharts;