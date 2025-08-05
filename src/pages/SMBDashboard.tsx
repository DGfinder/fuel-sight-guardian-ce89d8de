/**
 * SMB DASHBOARD - REBUILT
 * 
 * Clean, simplified SMB-specific dashboard with proper error handling
 * Uses only real Supabase data with comprehensive null checking
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Truck, 
  TrendingUp, 
  Building, 
  Package, 
  Users,
  Calendar,
  BarChart3,
  Download,
  ArrowLeft,
  AlertCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import DataCentreLayout from '@/components/DataCentreLayout';
import BOLDeliveryTable from '@/components/BOLDeliveryTable';
import CompactDateFilter from '@/components/CompactDateFilter';
import DashboardHero from '@/components/DashboardHero';
import MonthlyVolumeChart from '@/components/charts/MonthlyVolumeChart';
import VolumeBreakdownCharts from '@/components/charts/VolumeBreakdownCharts';
import { useDateRangeFilter } from '@/hooks/useDateRangeFilter';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { 
  useSMBData, 
  useBOLDeliveries, 
  useAvailableDateRange 
} from '@/hooks/useCaptivePayments';
import type { DashboardFilters } from '@/types/captivePayments';

const SMBDashboard: React.FC = () => {
  // Permission check
  const { data: permissions, isLoading: permissionsLoading } = useUserPermissions();
  
  // Date range filtering
  const { startDate, endDate, setDateRange, isFiltered } = useDateRangeFilter();
  
  // Create filters object - SMB-specific (no date filters unless explicitly set by user)
  const filters: DashboardFilters = { 
    startDate: isFiltered ? startDate : null, 
    endDate: isFiltered ? endDate : null 
  };
  
  console.log('SMB Dashboard filters:', { startDate, endDate, isFiltered, filtersApplied: filters });
  
  // Database hooks for real data
  const { data: smbData, isLoading, error: dataError } = useSMBData(filters);
  const { data: bolDeliveries } = useBOLDeliveries(filters);
  const { data: availableDateRange } = useAvailableDateRange();
  
  // Convert error type for compatibility
  const error = dataError ? String(dataError) : null;

  // Show error state if critical data fails to load
  if (error && !isLoading) {
    return (
      <DataCentreLayout>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="bg-red-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">SMB Data Loading Error</h2>
            <p className="text-gray-600 mb-4">
              Unable to load SMB (Stevemacs) delivery data. This could be due to a network issue or server problem.
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
      </DataCentreLayout>
    );
  }

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

  // Create available range object from hook data
  const availableRange = availableDateRange ? {
    min: new Date(availableDateRange.minDate),
    max: new Date(availableDateRange.maxDate)
  } : null;

  const handleExportData = () => {
    const exportData = {
      carrier: 'SMB (Stevemacs)',
      period: smbData?.dateRange ? `${smbData.dateRange.startDate} - ${smbData.dateRange.endDate}` : 'N/A',
      summary: {
        deliveries: smbData?.totalDeliveries || 0,
        volume: smbData?.totalVolumeLitres || 0,
        terminals: smbData?.terminalAnalysis?.length || 0
      },
      deliveries: bolDeliveries?.slice(0, 100) || []
    };
    console.log('Exporting SMB Performance Report:', exportData);
  };

  return (
    <DataCentreLayout>
      <div className="space-y-6">
        {/* Header with Compact Controls */}
        <div className="flex flex-col gap-4">
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                SMB Analytics
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Stevemacs delivery performance and operational metrics
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleExportData} size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
          
          {/* Compact Date Filter */}
          {availableRange && (
            <CompactDateFilter
              startDate={startDate}
              endDate={endDate}
              onDateChange={setDateRange}
              availableRange={availableRange}
              totalRecords={smbData?.totalDeliveries || 0}
              filteredRecords={smbData?.totalDeliveries || 0}
            />
          )}
        </div>

        {/* Dashboard Hero Section */}
        {smbData && (
          <DashboardHero
            carrier="SMB"
            totalDeliveries={smbData.totalDeliveries}
            totalVolumeMegaLitres={smbData.totalVolumeMegaLitres}
            totalVolumeLitres={smbData.totalVolumeLitres}
            uniqueCustomers={smbData.uniqueCustomers}
            terminalCount={smbData.terminalAnalysis?.length || 0}
            monthlyData={smbData.monthlyData || []}
            dateRange={smbData.dateRange}
            isFiltered={isFiltered}
          />
        )}

        {/* Monthly Volume Chart - Moved to Position #2 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Monthly Volume Trends
            </CardTitle>
            <CardDescription>
              Professional monthly volume analysis for compliance reporting
            </CardDescription>
          </CardHeader>
          <CardContent>
            {smbData?.monthlyData && smbData.monthlyData.length > 0 ? (
              <MonthlyVolumeChart 
                data={smbData.monthlyData} 
                carrier="SMB"
                height={350}
              />
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-500 mb-4">
                  {isLoading ? 'Loading monthly volume data...' : 'No monthly data available'}
                </div>
                {isLoading && (
                  <div className="animate-pulse bg-gray-200 h-64 rounded-lg"></div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Terminal Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="w-5 h-5" />
              Terminal Performance
            </CardTitle>
            <CardDescription>
              Volume distribution across SMB terminals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                Array(3).fill(0).map((_, index) => (
                  <div key={index} className="animate-pulse border rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="bg-gray-200 h-4 w-32 rounded"></div>
                      <div className="bg-gray-200 h-4 w-12 rounded"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-200 h-12 rounded"></div>
                      <div className="bg-gray-200 h-12 rounded"></div>
                      <div className="bg-gray-200 h-12 rounded"></div>
                    </div>
                  </div>
                ))
              ) : smbData?.terminalAnalysis?.length ? (
                smbData.terminalAnalysis.map((terminal, index) => (
                  <div key={terminal.terminal} className="border rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900">{terminal.terminal}</span>
                      <span className="font-semibold text-blue-600">{terminal.percentage_of_carrier_volume?.toFixed(1) || 0}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Deliveries</div>
                        <div className="font-medium">{terminal.total_deliveries.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Volume (ML)</div>
                        <div className="font-medium">
                          {(terminal.total_volume_litres / 1000000).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Avg/Delivery</div>
                        <div className="font-medium">
                          {(terminal.total_volume_litres / terminal.total_deliveries).toFixed(0)} L
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-4">
                  No terminal data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Customers */}
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
              {isLoading ? (
                Array(5).fill(0).map((_, index) => (
                  <div key={index} className="animate-pulse border rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-200 w-6 h-6 rounded-full"></div>
                        <div className="bg-gray-200 h-4 w-32 rounded"></div>
                      </div>
                      <div className="bg-gray-200 h-4 w-16 rounded"></div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gray-200 h-8 rounded"></div>
                      <div className="bg-gray-200 h-8 rounded"></div>
                      <div className="bg-gray-200 h-8 rounded"></div>
                    </div>
                  </div>
                ))
              ) : smbData?.topCustomers?.length ? (
                smbData.topCustomers.map((customer, index) => (
                  <div key={customer.customer} className="border rounded-lg p-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">
                          {index + 1}
                        </div>
                        <div className="font-medium text-gray-900">{customer.customer}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-blue-600">{customer.total_deliveries} Deliveries</div>
                        {smbData && (
                          <div className="text-xs text-gray-500">
                            {((customer.total_deliveries / smbData.totalDeliveries) * 100).toFixed(1)}% of total
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
                        <div className="text-gray-500">Avg/Delivery</div>
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
                ))
              ) : (
                <div className="text-center text-gray-500 py-4">
                  No customer data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>


        {/* Volume Breakdown Analytics */}
        {smbData && (
          <VolumeBreakdownCharts 
            terminalAnalysis={smbData.terminalAnalysis || []}
            topCustomers={smbData.topCustomers || []}
            carrier="SMB"
          />
        )}

        {/* Recent SMB Deliveries */}
        {bolDeliveries && bolDeliveries.length > 0 ? (
          <BOLDeliveryTable 
            deliveries={bolDeliveries.slice(-20).reverse()}
            title="Recent SMB Deliveries"
            showFilters={false}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Recent SMB Deliveries</CardTitle>
              <CardDescription>Latest delivery transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="text-gray-500 mb-4">
                  {isLoading ? 'Loading delivery records...' : 'No delivery records available'}
                </div>
                {isLoading && (
                  <div className="animate-pulse bg-gray-200 h-64 rounded-lg"></div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DataCentreLayout>
  );
};

export default SMBDashboard;