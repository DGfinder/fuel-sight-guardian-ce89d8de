import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Truck, 
  Calendar, 
  DollarSign,
  Package,
  Upload,
  BarChart3,
  FileText,
  AlertCircle
} from 'lucide-react';
import DataCentreLayout from '@/components/DataCentreLayout';

// Static mock data for captive payments
const mockCaptivePaymentsData = {
  currentMonth: {
    period: 'December 2024',
    smb: {
      name: 'SMB (Stevemacs)',
      deliveries: 1247,
      volume: 2856789,
      averageVolume: 2291,
      efficiency: 94.2,
      trend: 2.3
    },
    gsf: {
      name: 'GSF (Great Southern Fuels)',
      deliveries: 2156,
      volume: 4923456,
      averageVolume: 2284,
      efficiency: 91.8,
      trend: -1.7
    },
    totalValue: 18742650,
    paymentStatus: {
      processed: 3248,
      pending: 155,
      disputed: 12
    }
  },
  yearToDate: {
    totalRecords: 78945,
    totalVolume: 156789234,
    totalValue: 234567890,
    monthlyTrends: [
      { month: 'Jan', smb: 2456789, gsf: 4234567, total: 6691356 },
      { month: 'Feb', smb: 2234567, gsf: 3987654, total: 6222221 },
      { month: 'Mar', smb: 2567890, gsf: 4456789, total: 7024679 },
      { month: 'Apr', smb: 2345678, gsf: 4123456, total: 6469134 },
      { month: 'May', smb: 2678901, gsf: 4567890, total: 7246791 },
      { month: 'Jun', smb: 2456789, gsf: 4234567, total: 6691356 },
      { month: 'Jul', smb: 2789012, gsf: 4678901, total: 7467913 },
      { month: 'Aug', smb: 2567890, gsf: 4456789, total: 7024679 },
      { month: 'Sep', smb: 2345678, gsf: 4123456, total: 6469134 },
      { month: 'Oct', smb: 2678901, gsf: 4567890, total: 7246791 },
      { month: 'Nov', smb: 2789012, gsf: 4678901, total: 7467913 },
      { month: 'Dec', smb: 2856789, gsf: 4923456, total: 7780245 }
    ]
  },
  recentPayments: [
    {
      id: 'CP-2024-001234',
      carrier: 'SMB',
      customer: 'Regional Mining Co.',
      product: 'Diesel',
      volume: 15750,
      value: 23625,
      status: 'processed',
      date: '2024-12-03T14:23:15Z',
      paymentRef: 'PAY-SMB-241203-001'
    },
    {
      id: 'CP-2024-001235',
      carrier: 'GSF',
      customer: 'Transport Solutions Ltd',
      product: 'Unleaded',
      volume: 8940,
      value: 12456,
      status: 'pending',
      date: '2024-12-03T11:45:22Z',
      paymentRef: 'PAY-GSF-241203-002'
    },
    {
      id: 'CP-2024-001236',
      carrier: 'SMB',
      customer: 'Construction Corp',
      product: 'Diesel',
      volume: 22100,
      value: 33150,
      status: 'disputed',
      date: '2024-12-03T09:15:33Z',
      paymentRef: 'PAY-SMB-241203-003'
    }
  ],
  topCustomers: [
    { name: 'Regional Mining Co.', volume: 156789, value: 234567 },
    { name: 'Transport Solutions Ltd', volume: 134567, value: 201850 },
    { name: 'Construction Corp', volume: 123456, value: 185184 },
    { name: 'Heavy Industries Inc', volume: 98765, value: 148147 },
    { name: 'Logistics Partners', volume: 87654, value: 131481 }
  ]
};

const CaptivePaymentsDashboard = () => {
  const [selectedCarrier, setSelectedCarrier] = useState('all');
  const { currentMonth } = mockCaptivePaymentsData;

  const handleExportData = () => {
    // Mock export functionality
    const exportData = {
      period: currentMonth.period,
      carriers: [currentMonth.smb, currentMonth.gsf],
      payments: mockCaptivePaymentsData.recentPayments
    };
    console.log('Exporting Captive Payments Data:', exportData);
  };

  const handleUploadData = () => {
    // Mock upload functionality - would open file dialog
    console.log('Opening file upload dialog for captive payments data');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'bg-green-100 text-green-700 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'disputed': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <DataCentreLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Captive Payments Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track SMB and GSF carrier performance and payment metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleUploadData}>
            <Upload className="w-4 h-4 mr-2" />
            Upload MYOB Data
          </Button>
          <Button variant="outline" onClick={handleExportData}>
            <FileText className="w-4 h-4 mr-2" />
            Export Report
          </Button>
          <Badge variant="secondary" className="text-blue-700 bg-blue-100">
            <CreditCard className="w-4 h-4 mr-1" />
            75,000+ Records
          </Badge>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Payments ({currentMonth.period})
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${currentMonth.totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {(currentMonth.smb.deliveries + currentMonth.gsf.deliveries).toLocaleString()} transactions
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
              {(currentMonth.smb.volume + currentMonth.gsf.volume).toLocaleString()} L
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: {Math.round((currentMonth.smb.averageVolume + currentMonth.gsf.averageVolume) / 2)} L per delivery
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing Status</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {currentMonth.paymentStatus.processed}
            </div>
            <p className="text-xs text-muted-foreground">
              {currentMonth.paymentStatus.pending} pending, {currentMonth.paymentStatus.disputed} disputed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Year to Date</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${mockCaptivePaymentsData.yearToDate.totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {mockCaptivePaymentsData.yearToDate.totalRecords.toLocaleString()} total records
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Carrier Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              SMB (Stevemacs) Performance
            </CardTitle>
            <CardDescription>
              Current month delivery metrics and efficiency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Deliveries</span>
                <span className="text-2xl font-bold">{currentMonth.smb.deliveries.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Volume</span>
                <span className="text-xl font-semibold">{currentMonth.smb.volume.toLocaleString()} L</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Efficiency</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold">{currentMonth.smb.efficiency}%</span>
                  <div className="flex items-center text-green-600">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm">+{currentMonth.smb.trend}%</span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Avg per delivery:</span>
                  <span>{currentMonth.smb.averageVolume.toLocaleString()} L</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              GSF (Great Southern Fuels) Performance
            </CardTitle>
            <CardDescription>
              Current month delivery metrics and efficiency
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">Deliveries</span>
                <span className="text-2xl font-bold">{currentMonth.gsf.deliveries.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Volume</span>
                <span className="text-xl font-semibold">{currentMonth.gsf.volume.toLocaleString()} L</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Efficiency</span>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-semibold">{currentMonth.gsf.efficiency}%</span>
                  <div className="flex items-center text-red-600">
                    <TrendingDown className="w-4 h-4" />
                    <span className="text-sm">{currentMonth.gsf.trend}%</span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Avg per delivery:</span>
                  <span>{currentMonth.gsf.averageVolume.toLocaleString()} L</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers and Recent Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Top Customers by Volume
            </CardTitle>
            <CardDescription>
              Highest volume customers this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockCaptivePaymentsData.topCustomers.map((customer, index) => (
                <div key={customer.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">
                      {index + 1}
                    </div>
                    <span className="font-medium">{customer.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{customer.volume.toLocaleString()} L</div>
                    <div className="text-sm text-gray-500">${customer.value.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Recent Payment Activity
            </CardTitle>
            <CardDescription>
              Latest payment transactions requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockCaptivePaymentsData.recentPayments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{payment.carrier} - {payment.customer}</div>
                    <div className="text-sm text-gray-500">
                      {payment.product} • {payment.volume.toLocaleString()} L • ${payment.value.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(payment.date).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="outline" className={getStatusColor(payment.status)}>
                    {payment.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
    </DataCentreLayout>
  );
};

export default CaptivePaymentsDashboard;