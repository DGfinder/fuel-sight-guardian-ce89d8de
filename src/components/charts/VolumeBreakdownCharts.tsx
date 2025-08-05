/**
 * VOLUME BREAKDOWN CHARTS - COMPLIANCE ANALYTICS
 * 
 * Supporting analytics charts for compliance reporting
 * Matches PowerBI functionality with terminal, carrier, and customer breakdowns
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building, Users, Truck, Package } from 'lucide-react';
import type { TerminalAnalytics, CustomerAnalytics } from '@/types/captivePayments';

interface VolumeBreakdownChartsProps {
  terminalData: TerminalAnalytics[];
  customerData: CustomerAnalytics[];
  carrierBreakdown?: {
    SMB: { volume: number; deliveries: number };
    GSF: { volume: number; deliveries: number };
  };
  className?: string;
}

// Professional color scheme for charts
const COLORS = {
  primary: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
  carriers: ['#2563eb', '#10b981'], // Blue for SMB, Green for GSF
  terminals: ['#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb'],
  customers: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe']
};

const VolumeBreakdownCharts: React.FC<VolumeBreakdownChartsProps> = ({
  terminalData,
  customerData,
  carrierBreakdown,
  className = ''
}) => {
  // Prepare terminal data for chart (top 10)
  const terminalChartData = React.useMemo(() => {
    return terminalData
      .sort((a, b) => b.total_volume_megalitres - a.total_volume_megalitres)
      .slice(0, 10)
      .map((terminal, index) => ({
        name: terminal.terminal,
        volume: terminal.total_volume_megalitres,
        volumeFormatted: `${terminal.total_volume_megalitres.toFixed(1)}M`,
        deliveries: terminal.total_deliveries,
        percentage: terminal.percentage_of_carrier_volume,
        color: COLORS.terminals[index % COLORS.terminals.length]
      }));
  }, [terminalData]);

  // Prepare customer data for chart (top 10)
  const customerChartData = React.useMemo(() => {
    return customerData
      .sort((a, b) => b.total_volume_megalitres - a.total_volume_megalitres)
      .slice(0, 10)
      .map((customer, index) => ({
        name: customer.customer.length > 25 ? customer.customer.substring(0, 25) + '...' : customer.customer,
        fullName: customer.customer,
        volume: customer.total_volume_megalitres,
        volumeFormatted: `${customer.total_volume_megalitres.toFixed(1)}M`,
        deliveries: customer.total_deliveries,
        color: COLORS.customers[index % COLORS.customers.length]
      }));
  }, [customerData]);

  // Prepare carrier breakdown for pie chart
  const carrierChartData = React.useMemo(() => {
    if (!carrierBreakdown) return [];
    
    return [
      {
        name: 'SMB (Stevemacs)',
        volume: carrierBreakdown.SMB.volume / 1000000, // Convert to ML
        deliveries: carrierBreakdown.SMB.deliveries,
        color: COLORS.carriers[0]
      },
      {
        name: 'GSF (Great Southern Fuels)',
        volume: carrierBreakdown.GSF.volume / 1000000, // Convert to ML
        deliveries: carrierBreakdown.GSF.deliveries,
        color: COLORS.carriers[1]
      }
    ].filter(item => item.volume > 0);
  }, [carrierBreakdown]);

  // Custom tooltip for professional presentation
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 shadow-lg rounded-lg border">
          <p className="font-semibold text-gray-900">{data.fullName || data.name}</p>
          <p className="text-blue-600">
            <span className="font-medium">Volume: </span>
            {data.volumeFormatted || `${data.volume.toFixed(1)}M`}
          </p>
          <p className="text-green-600">
            <span className="font-medium">Deliveries: </span>
            {data.deliveries?.toLocaleString()}
          </p>
          {data.percentage && (
            <p className="text-purple-600">
              <span className="font-medium">% of Total: </span>
              {data.percentage.toFixed(1)}%
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${className}`}>
      {/* Volume by Terminal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-gray-600" />
            Volume by Terminal
          </CardTitle>
          <CardDescription>
            Fuel volume distribution across terminals (Top 10)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            {terminalChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={terminalChartData}
                  layout="horizontal"
                  margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    type="number" 
                    stroke="#666"
                    fontSize={12}
                    tickFormatter={(value) => `${value}M`}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name"
                    stroke="#666"
                    fontSize={11}
                    width={120}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="volume" 
                    fill="#2563eb"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Building className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No terminal data available</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Volume by Carrier (if data available) */}
      {carrierChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-gray-600" />
              Volume by Carrier
            </CardTitle>
            <CardDescription>
              Fuel delivery volume split between carriers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={carrierChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="volume"
                  >
                    {carrierChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`${value.toFixed(1)}M`, 'Volume']}
                    labelFormatter={(label) => `Carrier: ${label}`}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Legend */}
              <div className="flex justify-center gap-4 mt-4">
                {carrierChartData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm text-gray-600">
                      {item.name.split(' ')[0]}: {item.volume.toFixed(1)}M
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Volume by Customer */}
      <Card className={carrierChartData.length === 0 ? 'lg:col-span-2' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-600" />
            Volume by Customer
          </CardTitle>
          <CardDescription>
            Top customers by fuel volume delivered (Top 10)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            {customerChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={customerChartData}
                  layout="horizontal"
                  margin={{ top: 5, right: 30, left: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    type="number" 
                    stroke="#666"
                    fontSize={12}
                    tickFormatter={(value) => `${value}M`}
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name"
                    stroke="#666"
                    fontSize={10}
                    width={150}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="volume" 
                    fill="#7c3aed"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No customer data available</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Statistics Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-gray-600" />
            Volume Summary
          </CardTitle>
          <CardDescription>
            Key metrics for compliance reporting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Terminals</span>
              <span className="font-semibold text-lg">{terminalData.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Customers</span>
              <span className="font-semibold text-lg">{customerData.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Top Terminal</span>
              <span className="font-semibold text-sm">
                {terminalChartData[0]?.name || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Top Customer</span>
              <span className="font-semibold text-sm">
                {customerChartData[0]?.name || 'N/A'}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-gray-600">Avg Volume/Terminal</span>
              <span className="font-semibold text-lg">
                {terminalData.length > 0 
                  ? (terminalData.reduce((sum, t) => sum + t.total_volume_megalitres, 0) / terminalData.length).toFixed(1)
                  : '0'
                }M
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VolumeBreakdownCharts;