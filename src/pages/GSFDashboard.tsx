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
  ToggleRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
  loadGSFData, 
  loadGSFDataWithDateFilter,
  getAvailableDateRange,
  ProcessedCaptiveData, 
  formatVolume,
  processCSVData
} from '@/services/captivePaymentsDataProcessor';
import { useDateRangeFilter } from '@/hooks/useDateRangeFilter';

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
  const [showVolumeView, setShowVolumeView] = useState(false);
  const [realData, setRealData] = useState<ProcessedCaptiveData | null>(null);
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [availableRange, setAvailableRange] = useState<{min: Date; max: Date} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date range filtering
  const { startDate, endDate, setDateRange, isFiltered } = useDateRangeFilter();

  // Load initial data to get available date range
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Load all data first to establish available date range
        const response = await fetch('/Inputdata_southern Fuel (3)(Carrier - GSF).csv');
        if (!response.ok) throw new Error('Failed to load GSF data');
        const csvText = await response.text();
        
        // Parse GSF CSV data
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
        const data = await loadGSFDataWithDateFilter(startDate, endDate);
        setRealData(data);
      } catch (err) {
        setError('Failed to load GSF data');
        console.error('Error loading GSF data:', err);
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
          const data = await loadGSFDataWithDateFilter(startDate, endDate);
          setRealData(data);
        } catch (err) {
          setError('Failed to load filtered GSF data');
          console.error('Error loading filtered GSF data:', err);
        } finally {
          setIsLoading(false);
        }
      };

      loadFilteredData();
    }
  }, [startDate, endDate, availableRange]);

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
                {realData ? `${realData.totalDeliveries.toLocaleString()} BOLs Total` : `${gsfData.performance.deliveries.toLocaleString()} BOLs/month`}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExportData}>
              <Download className="w-4 h-4 mr-2" />
              Export GSF Report
            </Button>
            <Badge variant="secondary" className="text-blue-700 bg-blue-100">
              <BarChart3 className="w-4 h-4 mr-1" />
              {realData ? `${realData.totalVolumeMegaLitres.toFixed(1)} ML Total` : `${(gsfData.performance.volume / 1000000).toFixed(1)} ML`}
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
          <Card className="border-2 border-green-200 bg-green-50/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-800">
                Monthly BOL Deliveries
              </CardTitle>
              <Truck className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900">
                {realData ? realData.totalDeliveries.toLocaleString() : gsfData.performance.deliveries.toLocaleString()}
              </div>
              <p className="text-xs text-red-600 flex items-center mt-1">
                <TrendingDown className="w-3 h-3 mr-1" />
                {gsfData.performance.trend}% vs last month
              </p>
            </CardContent>
          </Card>

          <Card className="border-2 border-blue-200 bg-blue-50/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">Total Volume Delivered</CardTitle>
              <Package className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900">
                {realData ? `${realData.totalVolumeMegaLitres.toFixed(1)} ML` : `${(gsfData.performance.volume / 1000000).toFixed(1)} ML`}
              </div>
              <p className="text-xs text-blue-600">
                {realData ? `${realData.totalVolumeLitres.toLocaleString()} litres total` : `Avg: ${gsfData.performance.averageVolume.toLocaleString()} L per BOL`}
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
                {realData ? realData.uniqueCustomers : gsfData.topCustomers.length}
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
                    GSF Monthly Volume Analytics
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
                    <p className="text-sm text-muted-foreground">Loading GSF data...</p>
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
                  <ComposedChart data={realData?.monthlyData || gsfData.monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month"
                      tickFormatter={(value, index) => {
                        const data = realData?.monthlyData || gsfData.monthlyTrends;
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
                      fill="#10b981" 
                      name="Deliveries" 
                      opacity={showVolumeView ? 0.6 : 1}
                    />
                    {showVolumeView && (
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="volumeMegaLitres" 
                        stroke="#3b82f6" 
                        strokeWidth={3} 
                        name="Volume (ML)" 
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
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
              <div className="space-y-3">
                {(realData?.terminalAnalysis || gsfData.terminalPerformance).map((terminal, index) => (
                  <div key={terminal.terminal} className="border rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium text-gray-900">{terminal.terminal}</span>
                      </div>
                      <span className="font-semibold text-green-600">{terminal.percentage.toFixed(1)}%</span>
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
              <div className="space-y-4">
                {(realData?.topCustomers || gsfData.topCustomers).map((customer, index) => (
                  <div key={customer.name} className="border rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-xs font-medium text-green-700 dark:text-green-300">
                          {index + 1}
                        </div>
                        <div className="font-medium text-gray-900">{customer.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">{customer.deliveries} BOLs</div>
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
          deliveries={realData ? 
            realData.rawRecords
              .slice(-20) // Get last 20 deliveries
              .reverse() // Most recent first
              .map((record, index) => ({
                bolNumber: record.billOfLading || `BOL-${new Date(record.date).getFullYear()}-${String(index + 1).padStart(6, '0')}`,
                carrier: 'GSF',
                terminal: record.location,
                customer: record.customer,
                product: record.product,
                quantity: record.volume,
                deliveryDate: record.date,
                driverName: 'N/A', // Not available in CSV data
                vehicleId: 'N/A'   // Not available in CSV data
              }))
            : gsfData.recentDeliveries
          }
          title="Recent GSF Deliveries"
          showFilters={false}
        />
    </div>
  );
};

export default GSFDashboard;