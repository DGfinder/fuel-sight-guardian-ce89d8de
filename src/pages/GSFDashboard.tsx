import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Truck, 
  TrendingUp, 
  TrendingDown, 
  Building, 
  Package, 
  Users,
  MapPin,
  Calendar,
  BarChart3,
  Download,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';
import DataCentreLayout from '@/components/DataCentreLayout';
import BOLDeliveryTable from '@/components/BOLDeliveryTable';
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
  PieChart,
  Pie,
  Cell,
  ComposedChart
} from 'recharts';

// GSF-specific data
const gsfData = {
  performance: {
    period: 'December 2024',
    deliveries: 2156,
    volume: 4923456,
    averageVolume: 2284,
    efficiency: 91.8,
    trend: -1.7,
    terminals: ['Kwinana Terminal', 'Fremantle Terminal', 'Bunbury Terminal']
  },
  
  monthlyTrends: [
    { month: 'Jan', deliveries: 1987, volume: 4234567, efficiency: 89.2 },
    { month: 'Feb', deliveries: 1823, volume: 3987654, efficiency: 90.1 },
    { month: 'Mar', deliveries: 2098, volume: 4456789, efficiency: 88.7 },
    { month: 'Apr', deliveries: 1956, volume: 4123456, efficiency: 91.2 },
    { month: 'May', deliveries: 2134, volume: 4567890, efficiency: 90.8 },
    { month: 'Jun', deliveries: 2003, volume: 4234567, efficiency: 89.5 },
    { month: 'Jul', deliveries: 2189, volume: 4678901, efficiency: 92.1 },
    { month: 'Aug', deliveries: 2078, volume: 4456789, efficiency: 91.4 },
    { month: 'Sep', deliveries: 1934, volume: 4123456, efficiency: 93.2 },
    { month: 'Oct', deliveries: 2145, volume: 4567890, efficiency: 92.6 },
    { month: 'Nov', deliveries: 2198, volume: 4678901, efficiency: 90.9 },
    { month: 'Dec', deliveries: 2156, volume: 4923456, efficiency: 91.8 }
  ],

  terminalPerformance: [
    { terminal: 'Kwinana Terminal', deliveries: 1078, volume: 2467890, percentage: 50.1 },
    { terminal: 'Fremantle Terminal', deliveries: 645, volume: 1456789, percentage: 29.9 },
    { terminal: 'Bunbury Terminal', deliveries: 433, volume: 998777, percentage: 20.0 }
  ],

  productMix: [
    { product: 'Diesel', deliveries: 1567, volume: 3645123, percentage: 74.1 },
    { product: 'Unleaded', deliveries: 489, volume: 1056234, percentage: 21.4 },
    { product: 'Premium Unleaded', deliveries: 100, volume: 222099, percentage: 4.5 }
  ],

  topCustomers: [
    { name: 'Transport Solutions Ltd', deliveries: 245, volume: 756890, avgVolume: 3089 },
    { name: 'Mining Services Pty Ltd', deliveries: 198, volume: 645789, avgVolume: 3262 },
    { name: 'Heavy Industries Inc', deliveries: 167, volume: 534567, avgVolume: 3201 },
    { name: 'Regional Mining Co.', deliveries: 134, volume: 423456, avgVolume: 3160 },
    { name: 'Logistics Partners', deliveries: 123, volume: 389456, avgVolume: 3166 }
  ],

  fleetMetrics: {
    totalVehicles: 28,
    activeVehicles: 26,
    averageUtilization: 92.8,
    maintenanceAlerts: 1,
    drivers: 34
  },

  regionalCoverage: [
    { region: 'Perth Metro', deliveries: 1234, percentage: 57.2 },
    { region: 'South West', deliveries: 567, percentage: 26.3 },
    { region: 'Regional WA', deliveries: 355, percentage: 16.5 }
  ],

  recentDeliveries: [
    { bolNumber: 'BOL-2024-003402', terminal: 'Fremantle Terminal', customer: 'Transport Solutions Ltd', product: 'Unleaded', quantity: 8940, deliveryDate: '2024-12-03', driverName: 'Sarah Johnson', vehicleId: 'GSF-089' },
    { bolNumber: 'BOL-2024-003404', terminal: 'Bunbury Terminal', customer: 'Mining Services Pty Ltd', product: 'Diesel', quantity: -2500, deliveryDate: '2024-12-02', driverName: 'James Brown', vehicleId: 'GSF-156' },
    { bolNumber: 'BOL-2024-003406', terminal: 'Kwinana Terminal', customer: 'Heavy Industries Inc', product: 'Diesel', quantity: 18750, deliveryDate: '2024-12-02', driverName: 'Robert Taylor', vehicleId: 'GSF-234' },
    { bolNumber: 'BOL-2024-003408', terminal: 'Bunbury Terminal', customer: 'Construction Corp', product: 'Diesel', quantity: 25000, deliveryDate: '2024-12-01', driverName: 'Michael Chen', vehicleId: 'GSF-467' },
    { bolNumber: 'BOL-2024-003410', terminal: 'Fremantle Terminal', customer: 'Regional Mining Co.', product: 'Unleaded', quantity: 9800, deliveryDate: '2024-11-30', driverName: 'Tom Anderson', vehicleId: 'GSF-345' }
  ]
};

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

const GSFDashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  const handleExportData = () => {
    const exportData = {
      carrier: 'GSF (Great Southern Fuels)',
      period: gsfData.performance.period,
      summary: gsfData.performance,
      deliveries: gsfData.recentDeliveries
    };
    console.log('Exporting GSF Performance Report:', exportData);
  };

  return (
    <DataCentreLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link 
                to="/data-centre/captive-payments" 
                className="flex items-center gap-2 text-green-600 hover:text-green-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Captive Payments
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Truck className="w-8 h-8 text-green-600" />
              GSF (Great Southern Fuels) Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Comprehensive delivery performance and operational metrics for GSF carrier operations
            </p>
            <div className="flex items-center gap-4 mt-2">
              <Badge variant="outline" className="text-green-600 border-green-200">
                <Building className="w-4 h-4 mr-1" />
                3 Terminal Access
              </Badge>
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                <Package className="w-4 h-4 mr-1" />
                {gsfData.performance.deliveries.toLocaleString()} BOLs/month
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportData}>
              <Download className="w-4 h-4 mr-2" />
              Export GSF Report
            </Button>
            <Badge variant="secondary" className="text-green-700 bg-green-100">
              <BarChart3 className="w-4 h-4 mr-1" />
              {gsfData.performance.efficiency}% Efficiency
            </Badge>
          </div>
        </div>

        {/* Key Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-2 border-green-200 bg-green-50/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">
                Monthly BOL Deliveries
              </CardTitle>
              <Truck className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900">
                {gsfData.performance.deliveries.toLocaleString()}
              </div>
              <p className="text-xs text-red-600 flex items-center mt-1">
                <TrendingDown className="w-3 h-3 mr-1" />
                {gsfData.performance.trend}% vs last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {gsfData.performance.volume.toLocaleString()} L
              </div>
              <p className="text-xs text-muted-foreground">
                Avg: {gsfData.performance.averageVolume.toLocaleString()} L per BOL
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fleet Utilization</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {gsfData.fleetMetrics.averageUtilization}%
              </div>
              <p className="text-xs text-muted-foreground">
                {gsfData.fleetMetrics.activeVehicles}/{gsfData.fleetMetrics.totalVehicles} vehicles active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Regional Coverage</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                3
              </div>
              <p className="text-xs text-muted-foreground">
                Perth Metro, SW, Regional WA
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Performance Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                GSF Monthly Performance Trend
              </CardTitle>
              <CardDescription>
                Delivery count and efficiency over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={gsfData.monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="deliveries" fill="#10b981" name="Deliveries" />
                  <Line yAxisId="right" type="monotone" dataKey="efficiency" stroke="#3b82f6" strokeWidth={3} name="Efficiency %" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Regional Coverage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Regional Coverage Analysis
              </CardTitle>
              <CardDescription>
                GSF delivery distribution across Western Australia
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={gsfData.regionalCoverage}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ region, percentage }) => `${region} ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="deliveries"
                  >
                    {gsfData.regionalCoverage.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Deliveries']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-1 gap-2 mt-4">
                {gsfData.regionalCoverage.map((region, index) => (
                  <div key={region.region} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium">{region.region}</span>
                    </div>
                    <span className="text-sm text-gray-500">{region.deliveries} BOLs</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Terminal Performance and Product Mix */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Terminal Performance
              </CardTitle>
              <CardDescription>
                Volume distribution across GSF terminals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {gsfData.terminalPerformance.map((terminal, index) => (
                  <div key={terminal.terminal} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{terminal.terminal}</span>
                      </div>
                      <span className="text-sm font-semibold">{terminal.percentage}%</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{terminal.deliveries} BOLs</span>
                      <span>{terminal.volume.toLocaleString()} L</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full" 
                        style={{ 
                          width: `${terminal.percentage}%`,
                          backgroundColor: COLORS[index % COLORS.length]
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Top GSF Customers
              </CardTitle>
              <CardDescription>
                Highest volume customers served by GSF
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {gsfData.topCustomers.map((customer, index) => (
                  <div key={customer.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-xs font-medium text-green-700 dark:text-green-300">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-sm text-gray-500">Avg: {customer.avgVolume.toLocaleString()} L/delivery</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{customer.deliveries} BOLs</div>
                      <div className="text-sm text-gray-500">{customer.volume.toLocaleString()} L</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fleet Metrics Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              GSF Fleet Performance Summary
            </CardTitle>
            <CardDescription>
              Operational metrics and fleet utilization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {gsfData.fleetMetrics.totalVehicles}
                </div>
                <div className="text-sm text-gray-500">Total Vehicles</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {gsfData.fleetMetrics.drivers}
                </div>
                <div className="text-sm text-gray-500">Licensed Drivers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {gsfData.fleetMetrics.averageUtilization}%
                </div>
                <div className="text-sm text-gray-500">Avg Utilization</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {gsfData.fleetMetrics.maintenanceAlerts}
                </div>
                <div className="text-sm text-gray-500">Maintenance Alerts</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent GSF Deliveries */}
        <BOLDeliveryTable 
          deliveries={gsfData.recentDeliveries}
          title="Recent GSF Deliveries"
          showFilters={false}
        />
      </div>
    </DataCentreLayout>
  );
};

export default GSFDashboard;