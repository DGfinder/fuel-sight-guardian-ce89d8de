import React, { useState, useEffect } from 'react';
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
  ArrowLeft,
  ToggleLeft,
  ToggleRight,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import DataCentreLayout from '@/components/DataCentreLayout';
import BOLDeliveryTable from '@/components/BOLDeliveryTable';
import DateRangeFilter from '@/components/DateRangeFilter';
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
import { 
  ProcessedCaptiveData, 
  formatVolume
} from '@/services/captivePaymentsDataProcessor';
import { useDateRangeFilter } from '@/hooks/useDateRangeFilter';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useSMBData, useBOLDeliveries, useAvailableDateRange } from '@/hooks/useCaptivePayments';

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
  // Permission check - require view_myob_deliveries permission and SMB access
  const { data: permissions, isLoading: permissionsLoading } = useUserPermissions();
  
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [showVolumeView, setShowVolumeView] = useState(false);

  // Date range filtering
  const { startDate, endDate, setDateRange, isFiltered } = useDateRangeFilter();

  // Database hooks - replace CSV loading with database queries
  const filters = { startDate, endDate, carrier: 'SMB' as const };
  const { data: smbDatabaseData, isLoading, error: dataError } = useSMBData(filters);
  const { data: bolDeliveries } = useBOLDeliveries(filters);
  const { data: availableDateRange } = useAvailableDateRange();

  // Convert error type for compatibility
  const error = dataError ? String(dataError) : null;

  // Check if user has permission to view SMB data specifically
  const hasSMBPermission = permissions?.isAdmin || 
    permissions?.role === 'manager' ||
    permissions?.accessibleGroups?.some(group => 
      group.name.includes('SMB') || group.name.includes('Stevemac')
    );

  // Show loading state while checking permissions
  if (permissionsLoading) {
    return (
      <DataCentreLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <div className="text-gray-500">Checking permissions...</div>
          </div>
        </div>
      </DataCentreLayout>
    );
  }

  // Show access denied if user doesn't have SMB permission
  if (!hasSMBPermission) {
    return (
      <DataCentreLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="bg-red-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              You don't have permission to view SMB (Stevemacs) captive payments data.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              This section requires access to SMB group data. Please contact your administrator if you need access.
            </p>
            <Link to="/data-centre/captive-payments">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Captive Payments
              </Button>
            </Link>
          </div>
        </div>
      </DataCentreLayout>
    );
  }

  // Load initial data to get available date range
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Load all data first to establish available date range
        const response = await fetch('/Inputdata_southern Fuel (3)(Carrier - SMB).csv');
        if (!response.ok) throw new Error('Failed to load SMB data');
        const csvText = await response.text();
        const records = processCSVData(csvText);
        
        setAllRecords(records);
        
        if (records.length > 0) {
          const dateRange = getAvailableDateRange(records);
          setAvailableRange({
            min: dateRange.minDate,
            max: dateRange.maxDate
          });
        }
        
        // Load initial filtered data
        const data = await loadSMBDataWithDateFilter(startDate, endDate);
        setRealData(data);
      } catch (err) {
        setError('Failed to load SMB data');
        console.error('Error loading SMB data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);

  // Reload data when date range changes
  useEffect(() => {
    if (availableRange) {
      const loadFilteredData = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const data = await loadSMBDataWithDateFilter(startDate, endDate);
          setRealData(data);
        } catch (err) {
          setError('Failed to load filtered SMB data');
          console.error('Error loading filtered SMB data:', err);
        } finally {
          setIsLoading(false);
        }
      };

      loadFilteredData();
    }
  }, [startDate, endDate, availableRange]);

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
                {realData ? `${realData.totalDeliveries.toLocaleString()} BOLs Total` : `${smbData.performance.deliveries.toLocaleString()} BOLs/month`}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportData}>
              <Download className="w-4 h-4 mr-2" />
              Export SMB Report
            </Button>
            <Badge variant="secondary" className="text-green-700 bg-green-100">
              <BarChart3 className="w-4 h-4 mr-1" />
              {realData ? `${realData.totalVolumeMegaLitres.toFixed(1)} ML Total` : `${(smbData.performance.volume / 1000000).toFixed(1)} ML`}
            </Badge>
          </div>
        </div>

        {/* Date Range Filter */}
        {availableRange && (
          <DateRangeFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={setDateRange}
            availableRange={availableRange}
            totalRecords={allRecords.length}
            filteredRecords={realData?.rawRecords.length}
            className="mb-6"
          />
        )}

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
                {realData ? realData.totalDeliveries.toLocaleString() : smbData.performance.deliveries.toLocaleString()}
              </div>
              <p className="text-xs text-blue-600 flex items-center mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                +{smbData.performance.trend}% vs last month
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200 bg-green-50/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">Total Volume Delivered</CardTitle>
              <Package className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900">
                {realData ? `${realData.totalVolumeMegaLitres.toFixed(1)} ML` : `${(smbData.performance.volume / 1000000).toFixed(1)} ML`}
              </div>
              <p className="text-xs text-green-600">
                {realData ? `${realData.totalVolumeLitres.toLocaleString()} litres total` : `Avg: ${smbData.performance.averageVolume.toLocaleString()} L per BOL`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Data Coverage</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {realData ? `${realData.dateRange.monthsCovered} months` : '20+ months'}
              </div>
              <p className="text-xs text-muted-foreground">
                {realData ? `${realData.dateRange.startDate} - ${realData.dateRange.endDate}` : 'Sept 2023 - May 2025'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Customer Base</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {realData ? realData.uniqueCustomers : smbData.topCustomers.length}
              </div>
              <p className="text-xs text-muted-foreground">
                {realData ? `${realData.terminals.length} terminals served` : 'Active delivery locations'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Volume Analytics */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    SMB Monthly Volume Analytics
                  </CardTitle>
                  <CardDescription>
                    {showVolumeView ? 'Monthly delivery volumes in megalitres' : 'Monthly delivery count trends'}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowVolumeView(!showVolumeView)}
                  className="flex items-center gap-2"
                >
                  {showVolumeView ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {showVolumeView ? 'Volume (ML)' : 'Deliveries'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Loading SMB data...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-center">
                    <p className="text-sm text-red-600 mb-2">{error}</p>
                    <p className="text-xs text-muted-foreground">Falling back to mock data</p>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={realData?.monthlyData || smbData.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month"
                      tickFormatter={(value, index) => {
                        const data = realData?.monthlyData || smbData.monthlyTrends;
                        const dataPoint = data[index];
                        return dataPoint?.year ? `${value} ${dataPoint.year}` : value;
                      }}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis yAxisId="left" />
                    {showVolumeView && <YAxis yAxisId="right" orientation="right" />}
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === 'Volume (ML)') {
                          return [`${value.toFixed(2)} ML`, name];
                        }
                        return [value.toLocaleString(), name];
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload[0] && payload[0].payload) {
                          const data = payload[0].payload;
                          return `${label} ${data.year || ''}`;
                        }
                        return label;
                      }}
                    />
                    <Legend />
                    <Bar 
                      yAxisId="left" 
                      dataKey="deliveries" 
                      fill="#3b82f6" 
                      name="Deliveries" 
                      opacity={showVolumeView ? 0.6 : 1}
                    />
                    {showVolumeView && (
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="volumeMegaLitres" 
                        stroke="#10b981" 
                        strokeWidth={3} 
                        name="Volume (ML)" 
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
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
                    data={realData?.terminalAnalysis || smbData.terminalPerformance}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ terminal, percentage }) => `${terminal.split(' ')[0]} ${percentage.toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey={realData ? "volumeLitres" : "volume"}
                  >
                    {(realData?.terminalAnalysis || smbData.terminalPerformance).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value.toLocaleString() + ' L', 'Volume']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3 mt-4">
                {(realData?.terminalAnalysis || smbData.terminalPerformance).map((terminal, index) => (
                  <div key={terminal.terminal} className="border rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium text-gray-900">{terminal.terminal}</span>
                      </div>
                      <span className="font-semibold text-blue-600">{terminal.percentage.toFixed(1)}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">BOLs</div>
                        <div className="font-medium">{terminal.deliveries.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Volume (ML)</div>
                        <div className="font-medium">
                          {((realData ? terminal.volumeLitres : terminal.volume) / 1000000).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Avg/BOL</div>
                        <div className="font-medium">
                          {((realData ? terminal.volumeLitres : terminal.volume) / terminal.deliveries).toFixed(0)} L
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
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
                {(realData?.productMix || smbData.productMix).map((product, index) => (
                  <div key={product.product} className="border rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div className="font-medium text-gray-900">{product.product}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-lg text-blue-600">{product.percentage.toFixed(1)}%</div>
                        <div className="text-xs text-gray-500">of total volume</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Deliveries</div>
                        <div className="font-medium">{product.deliveries.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Volume (ML)</div>
                        <div className="font-medium">
                          {((realData ? product.volumeLitres : product.volume) / 1000000).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Avg/BOL</div>
                        <div className="font-medium">
                          {((realData ? product.volumeLitres : product.volume) / product.deliveries).toFixed(0)} L
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full" 
                          style={{ 
                            width: `${product.percentage}%`,
                            backgroundColor: COLORS[index % COLORS.length]
                          }}
                        />
                      </div>
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
              <div className="space-y-4">
                {(realData?.topCustomers || smbData.topCustomers).map((customer, index) => (
                  <div key={customer.name} className="border rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">
                          {index + 1}
                        </div>
                        <div className="font-medium text-gray-900">{customer.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-blue-600">{customer.deliveries} BOLs</div>
                        {realData && (
                          <div className="text-xs text-gray-500">
                            {((customer.deliveries / realData.totalDeliveries) * 100).toFixed(1)}% of total
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Volume</div>
                        <div className="font-medium">
                          {realData ? customer.volumeMegaLitres.toFixed(2) : (customer.volume / 1000000).toFixed(2)} ML
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Avg/BOL</div>
                        <div className="font-medium">
                          {realData 
                            ? (customer.volumeLitres / customer.deliveries).toFixed(0) 
                            : customer.avgVolume.toLocaleString()
                          } L
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Total Litres</div>
                        <div className="font-medium">{(realData ? customer.volumeLitres : customer.volume).toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent SMB Deliveries */}
        <BOLDeliveryTable 
          deliveries={realData ? 
            realData.rawRecords
              .slice(-20) // Get last 20 deliveries
              .reverse() // Most recent first
              .map((record, index) => ({
                bolNumber: record.billOfLading || `BOL-${new Date(record.date).getFullYear()}-${String(index + 1).padStart(6, '0')}`,
                carrier: 'SMB',
                terminal: record.location,
                customer: record.customer,
                product: record.product,
                quantity: record.volume,
                deliveryDate: record.date,
                driverName: 'N/A', // Not available in CSV data
                vehicleId: 'N/A'   // Not available in CSV data
              }))
            : smbData.recentDeliveries
          }
          title="Recent SMB Deliveries"
          showFilters={false}
        />
      </div>
    </DataCentreLayout>
  );
};

export default SMBDashboard;