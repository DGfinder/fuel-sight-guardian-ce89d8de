import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Truck, 
  TrendingUp, 
  BarChart3,
  MapPin,
  Calendar,
  Package,
  DollarSign,
  Clock,
  Users
} from 'lucide-react';

export function DeliveryPage() {
  const [selectedCarrier, setSelectedCarrier] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('month');

  // Mock data - replace with real API calls
  const deliveryStats = {
    totalDeliveries: 76660,
    smbDeliveries: 21706,
    gsfDeliveries: 54954,
    avgDeliveryTime: 2.3,
    totalRevenue: 2450000,
    avgDeliveryValue: 32.15
  };

  const carrierPerformance = [
    {
      name: 'SMB Carrier',
      deliveries: 21706,
      revenue: 698500,
      avgValue: 32.15,
      onTimeRate: 94.2,
      trend: '+5.2%'
    },
    {
      name: 'GSF Carrier', 
      deliveries: 54954,
      revenue: 1751500,
      avgValue: 31.85,
      onTimeRate: 96.8,
      trend: '+8.1%'
    }
  ];

  const topCustomers = [
    { name: 'Customer A', deliveries: 2450, revenue: 78400, avgOrder: 32.00 },
    { name: 'Customer B', deliveries: 1890, revenue: 60480, avgOrder: 32.00 },
    { name: 'Customer C', deliveries: 1650, revenue: 52800, avgOrder: 32.00 },
    { name: 'Customer D', deliveries: 1420, revenue: 45440, avgOrder: 32.00 },
    { name: 'Customer E', deliveries: 1280, revenue: 40960, avgOrder: 32.00 }
  ];

  const recentDeliveries = [
    {
      id: 'DEL001',
      customer: 'Acme Corp',
      destination: 'Sydney CBD',
      value: 1250.00,
      status: 'completed',
      timestamp: '2024-01-15 16:30',
      carrier: 'SMB'
    },
    {
      id: 'DEL002', 
      customer: 'Global Industries',
      destination: 'Melbourne', 
      value: 890.50,
      status: 'in_transit',
      timestamp: '2024-01-15 15:45',
      carrier: 'GSF'
    },
    {
      id: 'DEL003',
      customer: 'Tech Solutions',
      destination: 'Brisbane',
      value: 2100.00,
      status: 'scheduled',
      timestamp: '2024-01-15 14:20',
      carrier: 'SMB'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Delivery Analytics</h1>
          <p className="text-gray-600 mt-1">MYOB delivery performance and insights</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant={selectedCarrier === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCarrier('all')}
          >
            All Carriers
          </Button>
          <Button 
            variant={selectedCarrier === 'smb' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCarrier('smb')}
          >
            SMB
          </Button>
          <Button 
            variant={selectedCarrier === 'gsf' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCarrier('gsf')}
          >
            GSF
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deliveries</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveryStats.totalDeliveries.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">SMB: {deliveryStats.smbDeliveries.toLocaleString()} | GSF: {deliveryStats.gsfDeliveries.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(deliveryStats.totalRevenue / 1000000).toFixed(1)}M</div>
            <div className="flex items-center space-x-1 text-xs text-green-600">
              <TrendingUp className="w-3 h-3" />
              <span>+12.5% from last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Delivery Value</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${deliveryStats.avgDeliveryValue}</div>
            <p className="text-xs text-muted-foreground">Per delivery transaction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Delivery Time</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveryStats.avgDeliveryTime}h</div>
            <p className="text-xs text-muted-foreground">From dispatch to completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Carrier Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Carrier Performance</CardTitle>
          <CardDescription>Comparative analysis of SMB and GSF carrier performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {carrierPerformance.map((carrier, index) => (
              <div key={index} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">{carrier.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    carrier.trend.startsWith('+') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {carrier.trend}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Deliveries</span>
                    <span className="font-medium">{carrier.deliveries.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Revenue</span>
                    <span className="font-medium">${carrier.revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Value</span>
                    <span className="font-medium">${carrier.avgValue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">On-Time Rate</span>
                    <span className="font-medium text-green-600">{carrier.onTimeRate}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Trends Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery Trends</CardTitle>
          <CardDescription>Monthly delivery volume and revenue trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-md">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Delivery trends chart would be implemented here</p>
              <p className="text-sm text-gray-400">Monthly volume, revenue, and efficiency metrics</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Customers and Recent Deliveries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
            <CardDescription>Highest volume customers this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topCustomers.map((customer, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-gray-500">{customer.deliveries} deliveries</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${customer.revenue.toLocaleString()}</p>
                    <p className="text-sm text-gray-500">${customer.avgOrder}/avg</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Deliveries */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Deliveries</CardTitle>
            <CardDescription>Latest delivery transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentDeliveries.map((delivery) => (
                <div key={delivery.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded">
                      <Truck className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">{delivery.id}</p>
                      <p className="text-sm text-gray-500">{delivery.customer}</p>
                      <p className="text-xs text-gray-400">{delivery.destination}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${delivery.value}</p>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        delivery.status === 'completed' ? 'bg-green-100 text-green-800' :
                        delivery.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {delivery.status}
                      </span>
                      <span className="text-xs text-gray-500">{delivery.carrier}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}