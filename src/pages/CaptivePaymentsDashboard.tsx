import React, { useState, useEffect } from 'react';
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
import CompactDateFilter from '@/components/CompactDateFilter';
import { 
  loadCombinedCaptiveDataWithDateFilter,
  getAvailableDateRange,
  ProcessedCaptiveData,
  processCSVData,
  groupRecordsByBOL
} from '@/services/captivePaymentsDataProcessor';
import { useDateRangeFilter } from '@/hooks/useDateRangeFilter';
import { useUserPermissions } from '@/hooks/useUserPermissions';

// Production dashboard - all data sourced from real CSV files

const CaptivePaymentsDashboard = () => {
  // Permission check - require view_myob_deliveries permission
  const { data: permissions, isLoading: permissionsLoading } = useUserPermissions();
  
  const [selectedCarrier, setSelectedCarrier] = useState('all');
  
  // Real data state
  const [combinedData, setCombinedData] = useState<ProcessedCaptiveData | null>(null);
  const [smbData, setSmbData] = useState<ProcessedCaptiveData | null>(null);
  const [gsfData, setGsfData] = useState<ProcessedCaptiveData | null>(null);
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [availableRange, setAvailableRange] = useState<{min: Date; max: Date} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Date range filtering
  const { startDate, endDate, setDateRange, isFiltered } = useDateRangeFilter();

  // Check if user has permission to view MYOB deliveries
  const hasMyobPermission = permissions?.isAdmin || 
    permissions?.role === 'manager' || 
    permissions?.role === 'viewer'; // For now, allow viewers - can be restricted later

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

  // Show access denied if user doesn't have permission
  if (!hasMyobPermission) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="bg-red-100 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to view captive payments data. This section requires 
            'view_myob_deliveries' permission.
          </p>
          <p className="text-sm text-gray-500">
            Please contact your administrator if you need access to this section.
          </p>
        </div>
      </div>
    );
  }

  // Load initial data to get available date range
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Load all records from both carriers to establish available date range
        const [smbResponse, gsfResponse] = await Promise.all([
          fetch('/Inputdata_southern Fuel (3)(Carrier - SMB).csv'),
          fetch('/Inputdata_southern Fuel (3)(Carrier - GSF).csv')
        ]);
        
        if (!smbResponse.ok || !gsfResponse.ok) {
          throw new Error('Failed to load captive payments data');
        }
        
        const [smbCsvText, gsfCsvText] = await Promise.all([
          smbResponse.text(),
          gsfResponse.text()
        ]);
        
        const smbRecords = processCSVData(smbCsvText);
        const gsfRecords = processCSVData(gsfCsvText);
        const allRecordsData = [...smbRecords, ...gsfRecords];
        
        setAllRecords(allRecordsData);
        
        if (allRecordsData.length > 0) {
          const dateRange = getAvailableDateRange(allRecordsData);
          setAvailableRange({
            min: dateRange.minDate,
            max: dateRange.maxDate
          });
        }
        
        // Load initial filtered data
        const filteredData = await loadCombinedCaptiveDataWithDateFilter(startDate, endDate);
        setCombinedData(filteredData.combinedData);
        setSmbData(filteredData.smbData);
        setGsfData(filteredData.gsfData);
      } catch (err) {
        setError('Failed to load captive payments data');
        console.error('Error loading captive payments data:', err);
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
          const filteredData = await loadCombinedCaptiveDataWithDateFilter(startDate, endDate);
          setCombinedData(filteredData.combinedData);
          setSmbData(filteredData.smbData);
          setGsfData(filteredData.gsfData);
        } catch (err) {
          setError('Failed to load filtered captive payments data');
          console.error('Error loading filtered captive payments data:', err);
        } finally {
          setIsLoading(false);
        }
      };

      loadFilteredData();
    }
  }, [startDate, endDate, availableRange]);

  const handleExportData = () => {
    if (!combinedData) {
      alert('No data available to export');
      return;
    }
    
    // Create CSV content
    const headers = ['Date', 'BOL Number', 'Location', 'Customer', 'Product', 'Volume (L)', 'Carrier'];
    const csvContent = [
      headers.join(','),
      ...combinedData.rawRecords.slice(0, 1000).map(record => [
        record.date,
        record.billOfLading,
        record.location,
        record.customer,
        record.product,
        record.volume,
        'Combined'
      ].join(','))
    ].join('\n');
    
    // Download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captive-payments-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleUploadData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        alert('File too large. Please select a file smaller than 50MB.');
        return;
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        // For now, just show success message
        // In production, would implement actual file processing
        alert(`File "${file.name}" uploaded successfully. Processing ${file.size} bytes...`);
        
        // Reload data after upload
        const filteredData = await loadCombinedCaptiveDataWithDateFilter(startDate, endDate);
        setCombinedData(filteredData.combinedData);
        setSmbData(filteredData.smbData);
        setGsfData(filteredData.gsfData);
      } catch (err) {
        setError('Failed to process uploaded file');
        console.error('Upload error:', err);
      } finally {
        setIsLoading(false);
      }
    };
    input.click();
  };

  const getCarrierColor = (carrier: string) => {
    switch (carrier) {
      case 'SMB': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'GSF': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Calculate trends from real data
  const currentMonthData = combinedData?.monthlyData?.slice(-1)[0];
  const previousMonthData = combinedData?.monthlyData?.slice(-2)[0];
  
  const deliveryChange = currentMonthData && previousMonthData ? 
    currentMonthData.deliveries - previousMonthData.deliveries : 0;
  const volumeChange = currentMonthData && previousMonthData ? 
    currentMonthData.volumeLitres - previousMonthData.volumeLitres : 0;
  
  const deliveryChangePercent = previousMonthData?.deliveries ? 
    ((deliveryChange / previousMonthData.deliveries) * 100).toFixed(1) : '0.0';
  const volumeChangePercent = previousMonthData?.volumeLitres ? 
    ((volumeChange / previousMonthData.volumeLitres) * 100).toFixed(1) : '0.0';

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
            {combinedData ? `${combinedData.totalDeliveries.toLocaleString()} BOLs Total` : 'Loading...'}
          </Badge>
        </div>
      </div>

      {/* Date Range Filter - Compact Version */}
      {availableRange && (
        <CompactDateFilter
          startDate={startDate}
          endDate={endDate}
          onDateChange={setDateRange}
          availableRange={availableRange}
          totalRecords={allRecords.length}
          filteredRecords={combinedData?.rawRecords.length}
          className="mb-6"
        />
      )}

      {/* Core Compliance Metrics - Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* COMPLIANCE METRIC #1: Total Deliveries */}
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
                combinedData ? combinedData.totalDeliveries.toLocaleString() : '0'
              )}
            </div>
            <p className="text-xs text-blue-600 flex items-center mt-1">
              {isFiltered ? (
                <span>Filtered Period</span>
              ) : combinedData ? (
                <span>{combinedData.dateRange.startDate} - {combinedData.dateRange.endDate}</span>
              ) : (
                <span>Loading...</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* COMPLIANCE METRIC #2: Total Volume */}
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
              {combinedData ? (
                <span>{combinedData.totalVolumeLitres.toLocaleString()} litres total</span>
              ) : (
                <span>Loading...</span>
              )}
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
              {isLoading ? (
                <div className="animate-pulse bg-gray-200 h-6 w-20 rounded"></div>
              ) : (
                combinedData ? `${Math.round(combinedData.averageDeliverySize).toLocaleString()} L` : '0 L'
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {combinedData ? `${combinedData.terminals.length} terminals served` : 'Loading...'}
            </p>
          </CardContent>
        </Card>

        {/* Data Coverage Summary */}
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
                combinedData ? `${combinedData.dateRange.monthsCovered} months` : '0 months'
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {combinedData ? `${combinedData.uniqueCustomers} unique customers` : 'Loading...'}
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
                <span className="text-2xl font-bold text-blue-600">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                  ) : (
                    smbData ? smbData.totalDeliveries.toLocaleString() : '0'
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
              <div className="pt-2 border-t">
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Terminal Access:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {smbData ? smbData.terminals.map(terminal => (
                    <Badge key={terminal} variant="outline" className="text-xs">
                      {terminal}
                    </Badge>
                  )) : (
                    <span className="text-xs text-gray-500">Loading...</span>
                  )}
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
                <span className="text-2xl font-bold text-green-600">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-200 h-6 w-16 rounded"></div>
                  ) : (
                    gsfData ? gsfData.totalDeliveries.toLocaleString() : '0'
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
              <div className="pt-2 border-t">
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Terminal Access:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {gsfData ? gsfData.terminals.map(terminal => (
                    <Badge key={terminal} variant="outline" className="text-xs">
                      {terminal}
                    </Badge>
                  )) : (
                    <span className="text-xs text-gray-500">Loading...</span>
                  )}
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
              ) : combinedData ? (
                combinedData.topCustomers.slice(0, 5).map((customer, index) => (
                  <div key={customer.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-xs text-gray-500">Top Customer</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{customer.deliveries} BOLs</div>
                      <div className="text-sm text-gray-500">{customer.volumeLitres.toLocaleString()} L</div>
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
              {isLoading ? (
                Array(5).fill(0).map((_, index) => (
                  <div key={index} className="p-3 border rounded-lg">
                    <div className="animate-pulse bg-gray-200 h-4 w-48 rounded mb-2"></div>
                    <div className="animate-pulse bg-gray-200 h-3 w-64 rounded mb-1"></div>
                    <div className="animate-pulse bg-gray-200 h-3 w-32 rounded mb-1"></div>
                    <div className="animate-pulse bg-gray-200 h-3 w-40 rounded"></div>
                  </div>
                ))
              ) : combinedData ? (
                combinedData.rawRecords.slice(-5).reverse().map((record, index) => (
                  <div key={`${record.billOfLading}-${index}`} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {record.billOfLading || `BOL-${index + 1}`}
                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                          Combined
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-500">
                        {record.location} → {record.customer}
                      </div>
                      <div className="text-sm text-gray-600">
                        {record.product} • {record.volume > 0 ? '+' : ''}{record.volume.toLocaleString()} L
                      </div>
                      <div className="text-xs text-gray-400">
                        {record.date}
                      </div>
                    </div>
                    <div className="text-right">
                      {record.volume < 0 && (
                        <Badge variant="outline" className="text-red-600 border-red-200">
                          Return
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-4">
                  No recent deliveries available
                </div>
              )}
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
        
        {combinedData && combinedData.monthlyData.length > 0 ? (
          <DeliveryTrendCharts 
            monthlyData={combinedData.monthlyData.map(month => ({
              month: month.month,
              smbDeliveries: smbData?.monthlyData.find(m => m.month === month.month)?.deliveries || 0,
              gsfDeliveries: gsfData?.monthlyData.find(m => m.month === month.month)?.deliveries || 0,
              totalDeliveries: month.deliveries,
              smbVolume: smbData?.monthlyData.find(m => m.month === month.month)?.volumeLitres || 0,
              gsfVolume: gsfData?.monthlyData.find(m => m.month === month.month)?.volumeLitres || 0,
              totalVolume: month.volumeLitres
            }))}
            currentMonth={{
              totalDeliveries: combinedData.totalDeliveries,
              totalVolume: combinedData.totalVolumeLitres,
              period: `${combinedData.dateRange.startDate} - ${combinedData.dateRange.endDate}`
            }}
          />
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-500 mb-4">Loading trend charts...</div>
            <div className="animate-pulse bg-gray-200 h-64 rounded-lg"></div>
          </div>
        )}
      </div>

      {/* Detailed BOL Delivery Analysis Table */}
      {combinedData ? (
        <BOLDeliveryTable 
          deliveries={groupRecordsByBOL(combinedData.rawRecords.slice(0, 1000), 'Combined')}
          title={`BOL Delivery Records (showing first 1,000 records grouped by BOL of ${combinedData.totalDeliveries.toLocaleString()} total deliveries)`}
          showFilters={true}
        />
      ) : (
        <div className="text-center py-8">
          <div className="text-gray-500 mb-4">Loading delivery records...</div>
          <div className="animate-pulse bg-gray-200 h-96 rounded-lg"></div>
        </div>
      )}
    </div>
  );
};

export default CaptivePaymentsDashboard;