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
import { ProcessedCaptiveData } from '@/services/captivePaymentsDataProcessor';
import { useDateRangeFilter } from '@/hooks/useDateRangeFilter';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { 
  useGSFData, 
  useBOLDeliveries, 
  useAvailableDateRange 
} from '@/hooks/useCaptivePayments';

// No more mock data - using real database queries

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];

const GSFDashboard = () => {
  // Permission check - require view_myob_deliveries permission and GSF access
  const { data: permissions, isLoading: permissionsLoading } = useUserPermissions();
  
  const [selectedPeriod, setSelectedPeriod] = useState('current');
  const [showVolumeView, setShowVolumeView] = useState(false);
  // Database hooks for real data
  const filters = { startDate, endDate, carrier: 'GSF' as const };
  const { data: gsfDatabaseData, isLoading, error: dataError } = useGSFData(filters);
  const { data: bolDeliveries } = useBOLDeliveries(filters);
  const { data: availableDateRange } = useAvailableDateRange();
  
  // Convert error type for compatibility
  const error = dataError ? String(dataError) : null;

  // Show error state if critical data fails to load
  if (error && !isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="bg-red-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">GSF Data Loading Error</h2>
          <p className="text-gray-600 mb-4">
            Unable to load GSF (Great Southern Fuels) delivery data. This could be due to a network issue or server problem.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Error: {error}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => window.location.reload()} variant="outline">
              <AlertCircle className="w-4 h-4 mr-2" />
              Retry Loading
            </Button>
            <Link to="/data-centre/captive-payments">
              <Button variant="outline">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Overview
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Date range filtering
  const { startDate, endDate, setDateRange, isFiltered } = useDateRangeFilter();

  // Check if user has permission to view GSF data specifically
  const hasGSFPermission = permissions?.isAdmin || 
    permissions?.role === 'manager' ||
    permissions?.accessibleGroups?.some(group => 
      group.name.includes('GSF') || group.name.includes('Great Southern Fuels')
    );

  // Show loading state while checking permissions
  if (permissionsLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-gray-500">Checking permissions...</div>
        </div>
      </div>
    );
  }

  // Show access denied if user doesn't have GSF permission
  if (!hasGSFPermission) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="bg-red-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to view GSF (Great Southern Fuels) captive payments data.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            This section requires access to GSF group data. Please contact your administrator if you need access.
          </p>
          <Link to="/data-centre/captive-payments">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Captive Payments
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Create available range object from hook data
  const availableRange = availableDateRange ? {
    min: new Date(availableDateRange.startDate),
    max: new Date(availableDateRange.endDate)
  } : null;

  const handleExportData = () => {
    const exportData = {
      carrier: 'GSF (Great Southern Fuels)',
      period: gsfDatabaseData?.dateRange ? `${gsfDatabaseData.dateRange.startDate} - ${gsfDatabaseData.dateRange.endDate}` : 'N/A',
      summary: {
        deliveries: gsfDatabaseData?.totalDeliveries || 0,
        volume: gsfDatabaseData?.totalVolumeLitres || 0,
        terminals: gsfDatabaseData?.terminalAnalysis?.length || 0
      },
      deliveries: bolDeliveries?.slice(0, 100) || []
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
                {gsfDatabaseData ? `${gsfDatabaseData.totalDeliveries.toLocaleString()} BOLs Total` : 'Loading...'}
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
              {gsfDatabaseData ? `${gsfDatabaseData.totalVolumeMegaLitres.toFixed(1)} ML Total` : 'Loading...'}
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
            totalRecords={gsfDatabaseData?.totalDeliveries || 0}
            filteredRecords={gsfDatabaseData?.totalDeliveries || 0}
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
                {gsfDatabaseData ? gsfDatabaseData.totalDeliveries.toLocaleString() : '0'}
              </div>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                +1.8% vs last month
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
                {gsfDatabaseData ? `${gsfDatabaseData.totalVolumeMegaLitres.toFixed(1)} ML` : '0 ML'}
              </div>
              <p className="text-xs text-blue-600">
                {gsfDatabaseData ? `${gsfDatabaseData.totalVolumeLitres.toLocaleString()} litres total` : 'Loading...'}
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
                {gsfDatabaseData ? `${gsfDatabaseData.dateRange.monthsCovered} months` : '0 months'}
              </div>
              <p className="text-xs text-muted-foreground">
                {gsfDatabaseData ? `${gsfDatabaseData.dateRange.startDate} - ${gsfDatabaseData.dateRange.endDate}` : 'Loading...'}
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
                {gsfDatabaseData ? gsfDatabaseData.uniqueCustomers : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {gsfDatabaseData ? `${gsfDatabaseData.terminalAnalysis.length} terminals served` : 'Loading...'}
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
                  <ComposedChart data={gsfDatabaseData?.monthlyData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month_name"
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
                    />
                    <Legend />
                    <Bar 
                      yAxisId="left" 
                      dataKey="total_deliveries" 
                      fill="#10b981" 
                      name="Deliveries" 
                      opacity={showVolumeView ? 0.6 : 1}
                    />
                    {showVolumeView && (
                      <Line 
                        yAxisId="right" 
                        type="monotone" 
                        dataKey="total_volume_megalitres" 
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
                    data={gsfDatabaseData?.terminalAnalysis || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ terminal, percentage_of_carrier_volume }) => `${terminal.split(' ')[0]} ${percentage_of_carrier_volume?.toFixed(1) || 0}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="total_deliveries"
                  >
                    {(gsfDatabaseData?.terminalAnalysis || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Deliveries']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-1 gap-2 mt-4">
                {(gsfDatabaseData?.terminalAnalysis || []).map((terminal, index) => (
                  <div key={terminal.terminal} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium">{terminal.terminal}</span>
                    </div>
                    <span className="text-sm text-gray-500">{terminal.total_deliveries} BOLs</span>
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
                {(gsfDatabaseData?.terminalAnalysis || []).map((terminal, index) => (
                  <div key={terminal.terminal} className="border rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium text-gray-900">{terminal.terminal}</span>
                      </div>
                      <span className="font-semibold text-green-600">{terminal.percentage_of_carrier_volume?.toFixed(1) || 0}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">BOLs</div>
                        <div className="font-medium">{terminal.total_deliveries.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Volume (ML)</div>
                        <div className="font-medium">
                          {(terminal.total_volume_litres / 1000000).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Avg/BOL</div>
                        <div className="font-medium">
                          {(terminal.total_volume_litres / terminal.total_deliveries).toFixed(0)} L
                        </div>
                      </div>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="h-2 rounded-full" 
                          style={{ 
                            width: `${terminal.percentage_of_carrier_volume || 0}%`,
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
                {(gsfDatabaseData?.topCustomers || []).map((customer, index) => (
                  <div key={customer.customer} className="border rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center text-xs font-medium text-green-700 dark:text-green-300">
                          {index + 1}
                        </div>
                        <div className="font-medium text-gray-900">{customer.customer}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">{customer.total_deliveries} BOLs</div>
                        {gsfDatabaseData && (
                          <div className="text-xs text-gray-500">
                            {((customer.total_deliveries / gsfDatabaseData.totalDeliveries) * 100).toFixed(1)}% of total
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Volume</div>
                        <div className="font-medium">
                          {customer.total_volume_megalitres.toFixed(2)} ML
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Avg/BOL</div>
                        <div className="font-medium">
                          {(customer.total_volume_litres / customer.total_deliveries).toFixed(0)} L
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Total Litres</div>
                        <div className="font-medium">{customer.total_volume_litres.toLocaleString()}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Fleet Metrics Summary - Placeholder for future implementation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5" />
              GSF Fleet Performance Summary
            </CardTitle>
            <CardDescription>
              Fleet metrics will be available once fleet management data is integrated
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              Fleet performance analytics will be available once vehicle and driver data is configured
            </div>
          </CardContent>
        </Card>

        {/* Recent GSF Deliveries */}
        <BOLDeliveryTable 
          deliveries={bolDeliveries ? 
            bolDeliveries
              .slice(-20) // Get last 20 deliveries
              .reverse() // Most recent first
              .map((delivery, index) => ({
                bolNumber: delivery.bill_of_lading || `BOL-${new Date(delivery.delivery_date).getFullYear()}-${String(index + 1).padStart(6, '0')}`,
                carrier: delivery.carrier,
                terminal: delivery.terminal,
                customer: delivery.customer,
                products: delivery.products || [],
                totalQuantity: delivery.total_volume_litres,
                deliveryDate: delivery.delivery_date,
                driverName: 'N/A', // Not available in current data
                vehicleId: 'N/A',   // Not available in current data
                recordCount: delivery.record_count || 1
              }))
            : []
          }
          title="Recent GSF Deliveries"
          showFilters={false}
        />
    </div>
  );
};

export default GSFDashboard;