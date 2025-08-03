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
import { Link } from 'react-router-dom';
import BOLDeliveryTable from '@/components/BOLDeliveryTable';
import DeliveryTrendCharts from '@/components/DeliveryTrendCharts';

// Enhanced BOL-focused delivery data for compliance analytics
const mockDeliveryData = {
  currentMonth: {
    period: 'December 2024',
    smb: {
      name: 'SMB (Stevemacs)',
      deliveries: 1247,        // Unique BOL count
      volume: 2856789,         // Total liters delivered
      averageVolume: 2291,     // Average liters per BOL
      terminals: ['Kwinana', 'Fremantle', 'Geraldton'],
      efficiency: 94.2,
      trend: 2.3
    },
    gsf: {
      name: 'GSF (Great Southern Fuels)',
      deliveries: 2156,        // Unique BOL count
      volume: 4923456,         // Total liters delivered
      averageVolume: 2284,     // Average liters per BOL
      terminals: ['Kwinana', 'Fremantle', 'Bunbury'],
      efficiency: 91.8,
      trend: -1.7
    },
    totalDeliveries: 3403,     // Total BOL count (compliance metric #1)
    totalVolume: 7780245,      // Total liters (compliance metric #2)
    negativeAdjustments: 15,   // BOLs with negative quantities
    adjustmentVolume: -23456   // Total negative volume
  },
  yearToDate: {
    totalDeliveries: 41567,    // Total BOL count for year
    totalVolume: 156789234,    // Total liters for year
    // Monthly delivery tracking (BOL count and volume)
    monthlyDeliveries: [
      { month: 'Jan', smbDeliveries: 1165, gsfDeliveries: 1987, totalDeliveries: 3152, smbVolume: 2456789, gsfVolume: 4234567, totalVolume: 6691356 },
      { month: 'Feb', smbDeliveries: 1089, gsfDeliveries: 1823, totalDeliveries: 2912, smbVolume: 2234567, gsfVolume: 3987654, totalVolume: 6222221 },
      { month: 'Mar', smbDeliveries: 1234, gsfDeliveries: 2098, totalDeliveries: 3332, smbVolume: 2567890, gsfVolume: 4456789, totalVolume: 7024679 },
      { month: 'Apr', smbDeliveries: 1098, gsfDeliveries: 1956, totalDeliveries: 3054, smbVolume: 2345678, gsfVolume: 4123456, totalVolume: 6469134 },
      { month: 'May', smbDeliveries: 1198, gsfDeliveries: 2134, totalDeliveries: 3332, smbVolume: 2678901, gsfVolume: 4567890, totalVolume: 7246791 },
      { month: 'Jun', smbDeliveries: 1156, gsfDeliveries: 2003, totalDeliveries: 3159, smbVolume: 2456789, gsfVolume: 4234567, totalVolume: 6691356 },
      { month: 'Jul', smbDeliveries: 1287, gsfDeliveries: 2189, totalDeliveries: 3476, smbVolume: 2789012, gsfVolume: 4678901, totalVolume: 7467913 },
      { month: 'Aug', smbDeliveries: 1201, gsfDeliveries: 2078, totalDeliveries: 3279, smbVolume: 2567890, gsfVolume: 4456789, totalVolume: 7024679 },
      { month: 'Sep', smbDeliveries: 1123, gsfDeliveries: 1934, totalDeliveries: 3057, smbVolume: 2345678, gsfVolume: 4123456, totalVolume: 6469134 },
      { month: 'Oct', smbDeliveries: 1267, gsfDeliveries: 2145, totalDeliveries: 3412, smbVolume: 2678901, gsfVolume: 4567890, totalVolume: 7246791 },
      { month: 'Nov', smbDeliveries: 1298, gsfDeliveries: 2198, totalDeliveries: 3496, smbVolume: 2789012, gsfVolume: 4678901, totalVolume: 7467913 },
      { month: 'Dec', smbDeliveries: 1247, gsfDeliveries: 2156, totalDeliveries: 3403, smbVolume: 2856789, gsfVolume: 4923456, totalVolume: 7780245 }
    ]
  },
  // Recent BOL deliveries for detailed tracking
  recentDeliveries: [
    {
      bolNumber: 'BOL-2024-003401',
      carrier: 'SMB',
      terminal: 'Kwinana Terminal',
      customer: 'Regional Mining Co.',
      product: 'Diesel',
      quantity: 15750,
      deliveryDate: '2024-12-03',
      driverName: 'John Smith',
      vehicleId: 'SMB-045'
    },
    {
      bolNumber: 'BOL-2024-003402',
      carrier: 'GSF',
      terminal: 'Fremantle Terminal',
      customer: 'Transport Solutions Ltd',
      product: 'Unleaded',
      quantity: 8940,
      deliveryDate: '2024-12-03',
      driverName: 'Sarah Johnson',
      vehicleId: 'GSF-089'
    },
    {
      bolNumber: 'BOL-2024-003403',
      carrier: 'SMB',
      terminal: 'Kwinana Terminal',
      customer: 'Construction Corp',
      product: 'Diesel',
      quantity: 22100,
      deliveryDate: '2024-12-03',
      driverName: 'Mike Wilson',
      vehicleId: 'SMB-023'
    },
    {
      bolNumber: 'BOL-2024-003404',
      carrier: 'GSF',
      terminal: 'Bunbury Terminal',
      customer: 'Mining Services Pty Ltd',
      product: 'Diesel',
      quantity: -2500,  // Return/adjustment
      deliveryDate: '2024-12-02',
      driverName: 'James Brown',
      vehicleId: 'GSF-156'
    },
    {
      bolNumber: 'BOL-2024-003405',
      carrier: 'SMB',
      terminal: 'Geraldton Terminal',
      customer: 'Regional Mining Co.',
      product: 'Unleaded',
      quantity: 12000,
      deliveryDate: '2024-12-02',
      driverName: 'David Lee',
      vehicleId: 'SMB-078'
    }
  ],
  // Top customers by delivery frequency and volume
  topCustomers: [
    { name: 'Regional Mining Co.', deliveries: 267, volume: 1567890, terminals: ['Kwinana', 'Geraldton'] },
    { name: 'Transport Solutions Ltd', deliveries: 189, volume: 1345670, terminals: ['Fremantle', 'Kwinana'] },
    { name: 'Construction Corp', deliveries: 156, volume: 1234560, terminals: ['Kwinana'] },
    { name: 'Mining Services Pty Ltd', deliveries: 134, volume: 987650, terminals: ['Bunbury', 'Fremantle'] },
    { name: 'Logistics Partners', deliveries: 98, volume: 876540, terminals: ['Fremantle'] }
  ],
  
  // Terminal performance summary
  terminals: [
    { name: 'Kwinana Terminal', deliveries: 1456, volume: 3234567, carriers: ['SMB', 'GSF'] },
    { name: 'Fremantle Terminal', deliveries: 987, volume: 2345678, carriers: ['SMB', 'GSF'] },
    { name: 'Bunbury Terminal', deliveries: 534, volume: 1456789, carriers: ['GSF'] },
    { name: 'Geraldton Terminal', deliveries: 426, volume: 743211, carriers: ['SMB'] }
  ],

  // Comprehensive BOL delivery dataset for detailed analysis
  allDeliveries: [
    // Recent December deliveries
    { bolNumber: 'BOL-2024-003401', carrier: 'SMB', terminal: 'Kwinana Terminal', customer: 'Regional Mining Co.', product: 'Diesel', quantity: 15750, deliveryDate: '2024-12-03', driverName: 'John Smith', vehicleId: 'SMB-045' },
    { bolNumber: 'BOL-2024-003402', carrier: 'GSF', terminal: 'Fremantle Terminal', customer: 'Transport Solutions Ltd', product: 'Unleaded', quantity: 8940, deliveryDate: '2024-12-03', driverName: 'Sarah Johnson', vehicleId: 'GSF-089' },
    { bolNumber: 'BOL-2024-003403', carrier: 'SMB', terminal: 'Kwinana Terminal', customer: 'Construction Corp', product: 'Diesel', quantity: 22100, deliveryDate: '2024-12-03', driverName: 'Mike Wilson', vehicleId: 'SMB-023' },
    { bolNumber: 'BOL-2024-003404', carrier: 'GSF', terminal: 'Bunbury Terminal', customer: 'Mining Services Pty Ltd', product: 'Diesel', quantity: -2500, deliveryDate: '2024-12-02', driverName: 'James Brown', vehicleId: 'GSF-156' },
    { bolNumber: 'BOL-2024-003405', carrier: 'SMB', terminal: 'Geraldton Terminal', customer: 'Regional Mining Co.', product: 'Unleaded', quantity: 12000, deliveryDate: '2024-12-02', driverName: 'David Lee', vehicleId: 'SMB-078' },
    
    // Additional comprehensive dataset
    { bolNumber: 'BOL-2024-003406', carrier: 'GSF', terminal: 'Kwinana Terminal', customer: 'Heavy Industries Inc', product: 'Diesel', quantity: 18750, deliveryDate: '2024-12-02', driverName: 'Robert Taylor', vehicleId: 'GSF-234' },
    { bolNumber: 'BOL-2024-003407', carrier: 'SMB', terminal: 'Fremantle Terminal', customer: 'Logistics Partners', product: 'Unleaded', quantity: 6500, deliveryDate: '2024-12-01', driverName: 'Emma Davis', vehicleId: 'SMB-156' },
    { bolNumber: 'BOL-2024-003408', carrier: 'GSF', terminal: 'Bunbury Terminal', customer: 'Construction Corp', product: 'Diesel', quantity: 25000, deliveryDate: '2024-12-01', driverName: 'Michael Chen', vehicleId: 'GSF-467' },
    { bolNumber: 'BOL-2024-003409', carrier: 'SMB', terminal: 'Kwinana Terminal', customer: 'Transport Solutions Ltd', product: 'Diesel', quantity: 14200, deliveryDate: '2024-11-30', driverName: 'Lisa Wang', vehicleId: 'SMB-289' },
    { bolNumber: 'BOL-2024-003410', carrier: 'GSF', terminal: 'Fremantle Terminal', customer: 'Regional Mining Co.', product: 'Unleaded', quantity: 9800, deliveryDate: '2024-11-30', driverName: 'Tom Anderson', vehicleId: 'GSF-345' },

    // November deliveries sample
    { bolNumber: 'BOL-2024-003350', carrier: 'SMB', terminal: 'Geraldton Terminal', customer: 'Mining Services Pty Ltd', product: 'Diesel', quantity: 20500, deliveryDate: '2024-11-29', driverName: 'Peter Jackson', vehicleId: 'SMB-167' },
    { bolNumber: 'BOL-2024-003351', carrier: 'GSF', terminal: 'Kwinana Terminal', customer: 'Heavy Industries Inc', product: 'Diesel', quantity: 17800, deliveryDate: '2024-11-29', driverName: 'Anna Rodriguez', vehicleId: 'GSF-678' },
    { bolNumber: 'BOL-2024-003352', carrier: 'SMB', terminal: 'Fremantle Terminal', customer: 'Construction Corp', product: 'Unleaded', quantity: 11200, deliveryDate: '2024-11-28', driverName: 'Mark Thompson', vehicleId: 'SMB-234' },
    { bolNumber: 'BOL-2024-003353', carrier: 'GSF', terminal: 'Bunbury Terminal', customer: 'Logistics Partners', product: 'Diesel', quantity: 23400, deliveryDate: '2024-11-28', driverName: 'Karen Miller', vehicleId: 'GSF-789' },
    { bolNumber: 'BOL-2024-003354', carrier: 'SMB', terminal: 'Kwinana Terminal', customer: 'Regional Mining Co.', product: 'Diesel', quantity: 16700, deliveryDate: '2024-11-27', driverName: 'Steve Roberts', vehicleId: 'SMB-345' },

    // Earlier deliveries with various scenarios
    { bolNumber: 'BOL-2024-003300', carrier: 'GSF', terminal: 'Fremantle Terminal', customer: 'Transport Solutions Ltd', product: 'Unleaded', quantity: 7200, deliveryDate: '2024-11-26', driverName: 'Jennifer Lee', vehicleId: 'GSF-123' },
    { bolNumber: 'BOL-2024-003301', carrier: 'SMB', terminal: 'Geraldton Terminal', customer: 'Heavy Industries Inc', product: 'Diesel', quantity: 19500, deliveryDate: '2024-11-25', driverName: 'Chris Wilson', vehicleId: 'SMB-456' },
    { bolNumber: 'BOL-2024-003302', carrier: 'GSF', terminal: 'Kwinana Terminal', customer: 'Mining Services Pty Ltd', product: 'Diesel', quantity: -1800, deliveryDate: '2024-11-24', driverName: 'Nancy Brown', vehicleId: 'GSF-567' },
    { bolNumber: 'BOL-2024-003303', carrier: 'SMB', terminal: 'Fremantle Terminal', customer: 'Construction Corp', product: 'Unleaded', quantity: 13500, deliveryDate: '2024-11-23', driverName: 'Daniel Garcia', vehicleId: 'SMB-678' },
    { bolNumber: 'BOL-2024-003304', carrier: 'GSF', terminal: 'Bunbury Terminal', customer: 'Logistics Partners', product: 'Diesel', quantity: 21800, deliveryDate: '2024-11-22', driverName: 'Rachel Martinez', vehicleId: 'GSF-890' },

    // Different fuel types and scenarios
    { bolNumber: 'BOL-2024-003250', carrier: 'SMB', terminal: 'Kwinana Terminal', customer: 'Regional Mining Co.', product: 'Premium Unleaded', quantity: 8500, deliveryDate: '2024-11-21', driverName: 'Kevin Davis', vehicleId: 'SMB-789' },
    { bolNumber: 'BOL-2024-003251', carrier: 'GSF', terminal: 'Fremantle Terminal', customer: 'Transport Solutions Ltd', product: 'Diesel', quantity: 24500, deliveryDate: '2024-11-20', driverName: 'Laura Johnson', vehicleId: 'GSF-901' },
    { bolNumber: 'BOL-2024-003252', carrier: 'SMB', terminal: 'Geraldton Terminal', customer: 'Heavy Industries Inc', product: 'Diesel', quantity: 18200, deliveryDate: '2024-11-19', driverName: 'Brian Smith', vehicleId: 'SMB-890' },
    { bolNumber: 'BOL-2024-003253', carrier: 'GSF', terminal: 'Bunbury Terminal', customer: 'Mining Services Pty Ltd', product: 'Unleaded', quantity: 10500, deliveryDate: '2024-11-18', driverName: 'Susan Williams', vehicleId: 'GSF-234' },
    { bolNumber: 'BOL-2024-003254', carrier: 'SMB', terminal: 'Kwinana Terminal', customer: 'Construction Corp', product: 'Diesel', quantity: -3200, deliveryDate: '2024-11-17', driverName: 'Tony Anderson', vehicleId: 'SMB-901' }
  ]
};

const CaptivePaymentsDashboard = () => {
  const [selectedCarrier, setSelectedCarrier] = useState('all');
  const { currentMonth, yearToDate } = mockDeliveryData;

  const handleExportData = () => {
    // Mock export functionality for compliance reporting
    const exportData = {
      period: currentMonth.period,
      complianceMetrics: {
        totalDeliveries: currentMonth.totalDeliveries,
        totalVolume: currentMonth.totalVolume,
        smbDeliveries: currentMonth.smb.deliveries,
        gsfDeliveries: currentMonth.gsf.deliveries
      },
      carriers: [currentMonth.smb, currentMonth.gsf],
      recentDeliveries: mockDeliveryData.recentDeliveries
    };
    console.log('Exporting Fuel Delivery Compliance Report:', exportData);
  };

  const handleUploadData = () => {
    // Mock upload functionality - would open file dialog for MYOB data
    console.log('Opening file upload dialog for MYOB delivery data');
  };

  const getCarrierColor = (carrier: string) => {
    switch (carrier) {
      case 'SMB': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'GSF': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Calculate month-over-month changes for compliance metrics
  const previousMonth = yearToDate.monthlyDeliveries[10]; // November data
  const deliveryChange = currentMonth.totalDeliveries - previousMonth.totalDeliveries;
  const volumeChange = currentMonth.totalVolume - previousMonth.totalVolume;
  const deliveryChangePercent = ((deliveryChange / previousMonth.totalDeliveries) * 100).toFixed(1);
  const volumeChangePercent = ((volumeChange / previousMonth.totalVolume) * 100).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Fuel Delivery Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Monitor BOL deliveries, volume tracking, and carrier performance metrics
          </p>
          <div className="flex items-center gap-4 mt-2">
            <Badge variant="outline" className="text-orange-600 border-orange-200">
              <Package className="w-4 h-4 mr-1" />
              MYOB Source Data
            </Badge>
            <Badge variant="outline" className="text-purple-600 border-purple-200">
              <Truck className="w-4 h-4 mr-1" />
              BOL Tracking
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleUploadData}>
            <Upload className="w-4 h-4 mr-2" />
            Upload MYOB Data
          </Button>
          <Button variant="outline" onClick={handleExportData}>
            <FileText className="w-4 h-4 mr-2" />
            Export Compliance Report
          </Button>
          <Badge variant="secondary" className="text-blue-700 bg-blue-100">
            <BarChart3 className="w-4 h-4 mr-1" />
            {yearToDate.totalDeliveries.toLocaleString()} BOLs YTD
          </Badge>
        </div>
      </div>

      {/* Core Compliance Metrics - Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* COMPLIANCE METRIC #1: Monthly Deliveries */}
        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">
              Monthly Deliveries ({currentMonth.period})
            </CardTitle>
            <Truck className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">
              {currentMonth.totalDeliveries.toLocaleString()}
            </div>
            <p className="text-xs text-blue-600 flex items-center mt-1">
              {deliveryChange > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {deliveryChangePercent}% vs last month
            </p>
          </CardContent>
        </Card>

        {/* COMPLIANCE METRIC #2: Monthly Volume */}
        <Card className="border-2 border-green-200 bg-green-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">
              Monthly Volume ({currentMonth.period})
            </CardTitle>
            <Package className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">
              {currentMonth.totalVolume.toLocaleString()} L
            </div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              {volumeChange > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {volumeChangePercent}% vs last month
            </p>
          </CardContent>
        </Card>

        {/* Supporting Metric: Average Volume per BOL */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Volume per BOL</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(currentMonth.totalVolume / currentMonth.totalDeliveries).toLocaleString()} L
            </div>
            <p className="text-xs text-muted-foreground">
              {currentMonth.negativeAdjustments} returns/adjustments
            </p>
          </CardContent>
        </Card>

        {/* YTD Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Year to Date Summary</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {yearToDate.totalDeliveries.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              BOLs • {(yearToDate.totalVolume / 1000000).toFixed(1)}M liters delivered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Carrier Delivery Performance Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-600" />
                  SMB (Stevemacs) Deliveries
                </CardTitle>
                <CardDescription>
                  BOL delivery performance and terminal operations
                </CardDescription>
              </div>
              <Link to="/data-centre/captive-payments/smb">
                <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                  View Details
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">BOL Count</span>
                <span className="text-2xl font-bold text-blue-600">{currentMonth.smb.deliveries.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Volume</span>
                <span className="text-xl font-semibold">{currentMonth.smb.volume.toLocaleString()} L</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Avg per BOL</span>
                <span className="text-lg font-semibold">{currentMonth.smb.averageVolume.toLocaleString()} L</span>
              </div>
              <div className="pt-2 border-t">
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Terminal Access:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {currentMonth.smb.terminals.map(terminal => (
                    <Badge key={terminal} variant="outline" className="text-xs">
                      {terminal}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-green-600" />
                  GSF (Great Southern Fuels) Deliveries
                </CardTitle>
                <CardDescription>
                  BOL delivery performance and terminal operations
                </CardDescription>
              </div>
              <Link to="/data-centre/captive-payments/gsf">
                <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50">
                  View Details
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="font-medium">BOL Count</span>
                <span className="text-2xl font-bold text-green-600">{currentMonth.gsf.deliveries.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Volume</span>
                <span className="text-xl font-semibold">{currentMonth.gsf.volume.toLocaleString()} L</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Avg per BOL</span>
                <span className="text-lg font-semibold">{currentMonth.gsf.averageVolume.toLocaleString()} L</span>
              </div>
              <div className="pt-2 border-t">
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Terminal Access:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {currentMonth.gsf.terminals.map(terminal => (
                    <Badge key={terminal} variant="outline" className="text-xs">
                      {terminal}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Analysis and Recent BOL Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Top Customers by Delivery Frequency
            </CardTitle>
            <CardDescription>
              Customer ranking by BOL count and volume delivered
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockDeliveryData.topCustomers.map((customer, index) => (
                <div key={customer.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        {customer.terminals.map(terminal => (
                          <Badge key={terminal} variant="outline" className="text-xs py-0">
                            {terminal}
                          </Badge>
                        ))}
                      </div>
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Recent BOL Deliveries
            </CardTitle>
            <CardDescription>
              Latest delivery transactions with BOL tracking
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockDeliveryData.recentDeliveries.map((delivery) => (
                <div key={delivery.bolNumber} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {delivery.bolNumber}
                      <Badge variant="outline" className={getCarrierColor(delivery.carrier)}>
                        {delivery.carrier}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500">
                      {delivery.terminal} → {delivery.customer}
                    </div>
                    <div className="text-sm text-gray-600">
                      {delivery.product} • {delivery.quantity > 0 ? '+' : ''}{delivery.quantity.toLocaleString()} L
                    </div>
                    <div className="text-xs text-gray-400">
                      {delivery.deliveryDate} • {delivery.driverName} • {delivery.vehicleId}
                    </div>
                  </div>
                  <div className="text-right">
                    {delivery.quantity < 0 && (
                      <Badge variant="outline" className="text-red-600 border-red-200">
                        Return
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Compliance Trends */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Monthly Compliance Trends
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Visualize delivery and volume patterns for compliance reporting
          </p>
        </div>
        
        <DeliveryTrendCharts 
          monthlyData={yearToDate.monthlyDeliveries}
          currentMonth={{
            totalDeliveries: currentMonth.totalDeliveries,
            totalVolume: currentMonth.totalVolume,
            period: currentMonth.period
          }}
        />
      </div>

      {/* Detailed BOL Delivery Analysis Table */}
      <BOLDeliveryTable 
        deliveries={mockDeliveryData.allDeliveries}
        title="Detailed BOL Delivery Records"
        showFilters={true}
      />
    </div>
  );
};

export default CaptivePaymentsDashboard;