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
  Cell
} from 'recharts';

// SMB-specific data
const smbData = {
  performance: {
    period: 'December 2024',
    deliveries: 1247,
    volume: 2856789,
    averageVolume: 2291,
    efficiency: 94.2,
    trend: 2.3,
    terminals: ['Kwinana Terminal', 'Fremantle Terminal', 'Geraldton Terminal']
  },
  
  monthlyTrends: [
    { month: 'Jan', deliveries: 1165, volume: 2456789, efficiency: 92.1 },
    { month: 'Feb', deliveries: 1089, volume: 2234567, efficiency: 93.4 },
    { month: 'Mar', deliveries: 1234, volume: 2567890, efficiency: 91.8 },
    { month: 'Apr', deliveries: 1098, volume: 2345678, efficiency: 94.1 },
    { month: 'May', deliveries: 1198, volume: 2678901, efficiency: 93.7 },
    { month: 'Jun', deliveries: 1156, volume: 2456789, efficiency: 92.9 },
    { month: 'Jul', deliveries: 1287, volume: 2789012, efficiency: 94.6 },
    { month: 'Aug', deliveries: 1201, volume: 2567890, efficiency: 93.2 },
    { month: 'Sep', deliveries: 1123, volume: 2345678, efficiency: 95.1 },
    { month: 'Oct', deliveries: 1267, volume: 2678901, efficiency: 94.8 },
    { month: 'Nov', deliveries: 1298, volume: 2789012, efficiency: 93.9 },
    { month: 'Dec', deliveries: 1247, volume: 2856789, efficiency: 94.2 }
  ],

  terminalPerformance: [
    { terminal: 'Kwinana Terminal', deliveries: 687, volume: 1567890, percentage: 55.1 },
    { terminal: 'Fremantle Terminal', deliveries: 345, volume: 789456, percentage: 27.7 },
    { terminal: 'Geraldton Terminal', deliveries: 215, volume: 499443, percentage: 17.2 }
  ],

  productMix: [
    { product: 'Diesel', deliveries: 892, volume: 2142567, percentage: 71.5 },
    { product: 'Unleaded', deliveries: 298, volume: 634123, percentage: 22.2 },
    { product: 'Premium Unleaded', deliveries: 57, volume: 80099, percentage: 6.3 }
  ],

  topCustomers: [
    { name: 'Regional Mining Co.', deliveries: 167, volume: 567890, avgVolume: 3401 },
    { name: 'Construction Corp', deliveries: 134, volume: 456789, avgVolume: 3409 },
    { name: 'Heavy Industries Inc', deliveries: 98, volume: 345678, avgVolume: 3528 },
    { name: 'Mining Services Pty Ltd', deliveries: 87, volume: 234567, avgVolume: 2696 },
    { name: 'Transport Solutions Ltd', deliveries: 76, volume: 189456, avgVolume: 2493 }
  ],

  fleetMetrics: {
    totalVehicles: 18,
    activeVehicles: 16,
    averageUtilization: 87.4,
    maintenanceAlerts: 2,
    drivers: 24
  },

  recentDeliveries: [
    { bolNumber: 'BOL-2024-003401', terminal: 'Kwinana Terminal', customer: 'Regional Mining Co.', product: 'Diesel', quantity: 15750, deliveryDate: '2024-12-03', driverName: 'John Smith', vehicleId: 'SMB-045' },
    { bolNumber: 'BOL-2024-003403', terminal: 'Kwinana Terminal', customer: 'Construction Corp', product: 'Diesel', quantity: 22100, deliveryDate: '2024-12-03', driverName: 'Mike Wilson', vehicleId: 'SMB-023' },
    { bolNumber: 'BOL-2024-003405', terminal: 'Geraldton Terminal', customer: 'Regional Mining Co.', product: 'Unleaded', quantity: 12000, deliveryDate: '2024-12-02', driverName: 'David Lee', vehicleId: 'SMB-078' },
    { bolNumber: 'BOL-2024-003407', terminal: 'Fremantle Terminal', customer: 'Logistics Partners', product: 'Unleaded', quantity: 6500, deliveryDate: '2024-12-01', driverName: 'Emma Davis', vehicleId: 'SMB-156' },
    { bolNumber: 'BOL-2024-003409', terminal: 'Kwinana Terminal', customer: 'Transport Solutions Ltd', product: 'Diesel', quantity: 14200, deliveryDate: '2024-11-30', driverName: 'Lisa Wang', vehicleId: 'SMB-289' }
  ]
};

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const SMBDashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  const handleExportData = () => {
    const exportData = {
      carrier: 'SMB (Stevemacs)',
      period: smbData.performance.period,
      summary: smbData.performance,
      deliveries: smbData.recentDeliveries
    };
    console.log('Exporting SMB Performance Report:', exportData);
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
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Captive Payments
              </Link>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
              <Truck className="w-8 h-8 text-blue-600" />
              SMB (Stevemacs) Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Detailed delivery performance and operational metrics for SMB carrier operations
            </p>
            <div className="flex items-center gap-4 mt-2">
              <Badge variant="outline" className="text-blue-600 border-blue-200">
                <Building className="w-4 h-4 mr-1" />
                3 Terminal Access
              </Badge>
              <Badge variant="outline" className="text-green-600 border-green-200">
                <Package className="w-4 h-4 mr-1" />
                {smbData.performance.deliveries.toLocaleString()} BOLs/month
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportData}>
              <Download className="w-4 h-4 mr-2" />
              Export SMB Report
            </Button>
            <Badge variant="secondary" className="text-blue-700 bg-blue-100">
              <BarChart3 className="w-4 h-4 mr-1" />
              {smbData.performance.efficiency}% Efficiency
            </Badge>
          </div>
        </div>

        {/* Key Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-2 border-blue-200 bg-blue-50/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">
                Monthly BOL Deliveries
              </CardTitle>
              <Truck className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">
                {smbData.performance.deliveries.toLocaleString()}
              </div>
              <p className="text-xs text-blue-600 flex items-center mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                +{smbData.performance.trend}% vs last month
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
                {smbData.performance.volume.toLocaleString()} L
              </div>
              <p className="text-xs text-muted-foreground">
                Avg: {smbData.performance.averageVolume.toLocaleString()} L per BOL
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
                {smbData.fleetMetrics.averageUtilization}%
              </div>
              <p className="text-xs text-muted-foreground">
                {smbData.fleetMetrics.activeVehicles}/{smbData.fleetMetrics.totalVehicles} vehicles active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Operational Status</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {smbData.performance.efficiency}%
              </div>
              <p className="text-xs text-muted-foreground">
                {smbData.fleetMetrics.maintenanceAlerts} maintenance alerts
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
                SMB Monthly Performance Trend
              </CardTitle>
              <CardDescription>
                Delivery count and efficiency over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={smbData.monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="deliveries" fill="#3b82f6" name="Deliveries" />
                  <Line yAxisId="right" type="monotone" dataKey="efficiency" stroke="#10b981" strokeWidth={3} name="Efficiency %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Terminal Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                Terminal Distribution
              </CardTitle>
              <CardDescription>
                SMB delivery volume by terminal location
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={smbData.terminalPerformance}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ terminal, percentage }) => `${terminal.split(' ')[0]} ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="volume"
                  >
                    {smbData.terminalPerformance.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value.toLocaleString() + ' L', 'Volume']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-1 gap-2 mt-4">
                {smbData.terminalPerformance.map((terminal, index) => (
                  <div key={terminal.terminal} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium">{terminal.terminal}</span>
                    </div>
                    <span className="text-sm text-gray-500">{terminal.deliveries} BOLs</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Product Mix and Top Customers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Product Mix Analysis
              </CardTitle>
              <CardDescription>
                Fuel type distribution for SMB deliveries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {smbData.productMix.map((product, index) => (
                  <div key={product.product} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <div>
                        <div className="font-medium">{product.product}</div>
                        <div className="text-sm text-gray-500">{product.deliveries} deliveries</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{product.percentage}%</div>
                      <div className="text-sm text-gray-500">{product.volume.toLocaleString()} L</div>
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
                Top SMB Customers
              </CardTitle>
              <CardDescription>
                Highest volume customers served by SMB
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {smbData.topCustomers.map((customer, index) => (
                  <div key={customer.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">
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

        {/* Recent SMB Deliveries */}
        <BOLDeliveryTable 
          deliveries={smbData.recentDeliveries}
          title="Recent SMB Deliveries"
          showFilters={false}
        />
      </div>
    </DataCentreLayout>
  );
};

export default SMBDashboard;