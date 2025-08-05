/**
 * CAPTIVE PAYMENTS DASHBOARD - REBUILT
 * 
 * Clean, simplified dashboard with proper error handling and type safety
 * Uses only real Supabase data with comprehensive null checking
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, 
  TrendingUp, 
  Truck, 
  Calendar, 
  Package,
  Upload,
  BarChart3,
  FileText,
  AlertCircle,
  X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDateRangeFilter } from '@/hooks/useDateRangeFilter';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { 
  useAllCarrierData,
  useBOLDeliveries,
  useAvailableDateRange,
  useMonthlyAnalytics,
  useTerminalAnalytics,
  useCustomerAnalytics
} from '@/hooks/useCaptivePayments';
import CompactDateFilter from '@/components/CompactDateFilter';
import BOLDeliveryTable from '@/components/BOLDeliveryTable';
import MonthlyVolumeChart from '@/components/charts/MonthlyVolumeChart';
import VolumeBreakdownCharts from '@/components/charts/VolumeBreakdownCharts';
import type { DashboardFilters } from '@/types/captivePayments';

const CaptivePaymentsDashboard: React.FC = () => {
  // Permission check
  const { data: permissions, isLoading: permissionsLoading } = useUserPermissions();
  
  // Date range filtering - start with NO filters to show all 23,756 deliveries
  const { startDate, endDate, setDateRange, isFiltered, clearDateRange } = useDateRangeFilter();
  
  // Create filters object - only apply dates if user has actively filtered
  const filters: DashboardFilters = { 
    startDate: isFiltered ? startDate : null, 
    endDate: isFiltered ? endDate : null 
  };
  
  console.log('Dashboard filters:', { startDate, endDate, isFiltered, filtersApplied: filters });
  
  // Data fetching
  const { 
    combinedData, 
    smbData, 
    gsfData, 
    isLoading, 
    error 
  } = useAllCarrierData(filters);
  
  const { data: bolDeliveries } = useBOLDeliveries(filters);
  const { data: availableDateRange } = useAvailableDateRange();
  
  // Analytics data for compliance charts
  const { data: monthlyAnalytics } = useMonthlyAnalytics(filters);
  const { data: terminalAnalytics } = useTerminalAnalytics(filters);
  const { data: customerAnalytics } = useCustomerAnalytics(filters);

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

  // Check permissions
  const hasPermission = permissions?.isAdmin || 
    permissions?.role === 'manager' || 
    permissions?.role === 'viewer';

  if (!hasPermission) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="bg-red-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to view captive payments data.
          </p>
          <p className="text-sm text-gray-500">
            Please contact your administrator if you need access to this section.
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="bg-red-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Data Loading Error</h2>
          <p className="text-gray-600 mb-4">
            Unable to load captive payments data. This could be due to a network issue or server problem.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Error: {error.message}
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            <AlertCircle className="w-4 h-4 mr-2" />
            Retry Loading
          </Button>
        </div>
      </div>
    );
  }

  // Create available range for date filter
  const availableRange = availableDateRange ? {
    min: new Date(availableDateRange.minDate),
    max: new Date(availableDateRange.maxDate)
  } : null;

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
          <Button variant="outline">
            <Upload className="w-4 h-4 mr-2" />
            Upload MYOB Data
          </Button>
          <Button variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            Export Compliance Report
          </Button>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-blue-700 bg-blue-100">
              <BarChart3 className="w-4 h-4 mr-1" />
              {combinedData ? `${combinedData.totalDeliveries.toLocaleString()} BOLs` : 'Loading...'}
              {isFiltered && ' (Filtered)'}
            </Badge>
            {isFiltered && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearDateRange}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                <X className="w-4 h-4 mr-2" />
                Show All Data
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      {availableRange && (
        <div className="mb-6">
          <CompactDateFilter
            startDate={startDate}
            endDate={endDate}
            onDateChange={setDateRange}
            availableRange={availableRange}
            totalRecords={23756} // Total deliveries in database
            filteredRecords={combinedData?.totalDeliveries || 0}
            className=""
          />
          {!isFiltered && (
            <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Showing all data • No date filters applied • Use date picker above to filter by period</span>
            </div>
          )}
        </div>
      )}

      {/* Core Compliance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Deliveries */}
        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">
              Total Deliveries
            </CardTitle>
            <Truck className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">
              {isLoading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-24 rounded"></div>
              ) : (
                combinedData?.totalDeliveries?.toLocaleString() || '0'
              )}
            </div>
            <p className="text-xs text-blue-600 flex items-center mt-1">
              {isFiltered ? (
                <span className="flex items-center gap-1">
                  <span>Filtered Period</span>
                  <button 
                    onClick={clearDateRange}
                    className="text-orange-600 hover:text-orange-800 font-medium underline"
                  >
                    (Show All 23,756)
                  </button>
                </span>
              ) : (
                <span>All Data • {combinedData?.dateRange ? 
                  `${combinedData.dateRange.startDate} - ${combinedData.dateRange.endDate}` : 
                  'Complete Dataset'
                }</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Total Volume */}
        <Card className="border-2 border-green-200 bg-green-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">
              Total Volume
            </CardTitle>
            <Package className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">
              {isLoading ? (
                <div className="animate-pulse bg-gray-200 h-8 w-24 rounded"></div>
              ) : (
                combinedData ? `${combinedData.totalVolumeMegaLitres.toFixed(1)} ML` : '0 ML'
              )}
            </div>
            <p className="text-xs text-green-600 flex items-center mt-1">
              {combinedData?.totalVolumeLitres ? (
                <span>{combinedData.totalVolumeLitres.toLocaleString()} litres total</span>
              ) : (
                <span>Loading...</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Average Volume per BOL */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Volume per BOL</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <div className="animate-pulse bg-gray-200 h-6 w-20 rounded"></div>
              ) : (
                combinedData ? `${Math.round(combinedData.averageDeliverySize).toLocaleString()} L` : '0 L'
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {combinedData?.uniqueTerminals ? `${combinedData.uniqueTerminals} terminals served` : 'Loading...'}
            </p>
          </CardContent>
        </Card>

        {/* Data Coverage */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Coverage</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? (
                <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
              ) : (
                combinedData?.dateRange ? `${combinedData.dateRange.monthsCovered} months` : '0 months'
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {combinedData?.uniqueCustomers ? `${combinedData.uniqueCustomers} unique customers` : 'Loading...'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Carrier Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SMB Performance */}
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
                <span className="text-2xl font-bold text-blue-600">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                  ) : (
                    smbData?.totalDeliveries?.toLocaleString() || '0'
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Volume</span>
                <span className="text-xl font-semibold">
                  {smbData ? `${smbData.totalVolumeMegaLitres.toFixed(1)} ML` : '0 ML'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Avg per BOL</span>
                <span className="text-lg font-semibold">
                  {smbData ? `${Math.round(smbData.averageDeliverySize).toLocaleString()} L` : '0 L'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* GSF Performance */}
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
                <span className="text-2xl font-bold text-green-600">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                  ) : (
                    gsfData?.totalDeliveries?.toLocaleString() || '0'
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Total Volume</span>
                <span className="text-xl font-semibold">
                  {gsfData ? `${gsfData.totalVolumeMegaLitres.toFixed(1)} ML` : '0 ML'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">Avg per BOL</span>
                <span className="text-lg font-semibold">
                  {gsfData ? `${Math.round(gsfData.averageDeliverySize).toLocaleString()} L` : '0 L'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Customers */}
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
            {isLoading ? (
              Array(5).fill(0).map((_, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="animate-pulse bg-gray-200 w-6 h-6 rounded-full"></div>
                    <div>
                      <div className="animate-pulse bg-gray-200 h-4 w-32 rounded mb-1"></div>
                      <div className="animate-pulse bg-gray-200 h-3 w-20 rounded"></div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="animate-pulse bg-gray-200 h-4 w-16 rounded mb-1"></div>
                    <div className="animate-pulse bg-gray-200 h-3 w-12 rounded"></div>
                  </div>
                </div>
              ))
            ) : combinedData?.topCustomers?.length ? (
              combinedData.topCustomers.slice(0, 5).map((customer, index) => (
                <div key={customer.customer} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{customer.customer}</div>
                      <div className="text-xs text-gray-500">Top Customer</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{customer.total_deliveries} BOLs</div>
                    <div className="text-sm text-gray-500">{customer.total_volume_litres.toLocaleString()} L</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 py-4">
                No customer data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Compliance Charts Section */}
      {monthlyAnalytics && monthlyAnalytics.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Compliance Analytics
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Professional charts for regulatory reporting and management review
              </p>
            </div>
            <Badge variant="outline" className="text-green-700 border-green-200">
              <BarChart3 className="w-4 h-4 mr-1" />
              Ready for Export
            </Badge>
          </div>
          
          {/* Monthly Volume Trend Chart */}
          <MonthlyVolumeChart 
            data={monthlyAnalytics}
            carrier="Combined"
            showExportButton={true}
            className="col-span-full"
          />
          
          {/* Volume Breakdown Charts */}
          {terminalAnalytics && customerAnalytics && (
            <VolumeBreakdownCharts
              terminalData={terminalAnalytics}
              customerData={customerAnalytics}
              carrierBreakdown={
                smbData && gsfData
                  ? {
                      SMB: {
                        volume: smbData.totalVolumeLitres,
                        deliveries: smbData.totalDeliveries
                      },
                      GSF: {
                        volume: gsfData.totalVolumeLitres,
                        deliveries: gsfData.totalDeliveries
                      }
                    }
                  : undefined
              }
            />
          )}
        </div>
      )}

      {/* BOL Delivery Records Table */}
      {bolDeliveries && bolDeliveries.length > 0 ? (
        <BOLDeliveryTable 
          deliveries={bolDeliveries}
          title={`BOL Delivery Records (${bolDeliveries.length.toLocaleString()} deliveries)`}
          showFilters={true}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>BOL Delivery Records</CardTitle>
            <CardDescription>Detailed delivery transactions with BOL tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="text-gray-500 mb-4">
                {isLoading ? 'Loading delivery records...' : 'No delivery records available'}
              </div>
              {isLoading && (
                <div className="animate-pulse bg-gray-200 h-96 rounded-lg"></div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CaptivePaymentsDashboard;