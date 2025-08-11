import React, { useState, useMemo } from 'react';
import { AlertTriangle, TrendingUp, Users, Calendar, Filter, Download, BarChart3, PieChart, Loader2, WifiOff, Settings, RefreshCw, X, Upload, Database, History } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell } from 'recharts';
import LYTXEventTable from '@/components/LYTXEventTable';
import LytxConnectionTest from '@/components/LytxConnectionTest';
import LytxCsvImportModal from '@/components/LytxCsvImportModal';
import LytxHistoricalDashboard from '@/components/LytxHistoricalDashboard';
import { LytxAnalyticsCharts } from '@/components/LytxAnalyticsCharts';
import { 
  useLytxHistoricalEvents,
  useLytxSummaryStats, 
  useLytxMonthlyTrends,
  useDateRanges,
  type LytxAnalyticsFilters 
} from '@/hooks/useLytxHistoricalData';
import { LytxAnalyticsService } from '@/services/lytxAnalyticsService';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useToast } from '@/hooks/use-toast';

interface LYTXEvent {
  eventId: string;
  driver: string;
  employeeId: string;
  group: string;
  vehicle: string;
  device: string;
  date: string;
  time: string;
  score: number;
  status: 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved';
  trigger: string;
  behaviors: string;
  eventType: 'Coachable' | 'Driver Tagged';
  carrier: 'Stevemacs' | 'Great Southern Fuels';
  excluded?: boolean;
}


// Generate enhanced monthly trend data with fleet breakdown
const generateMonthlyData = (events: LYTXEvent[]) => {
  const monthlyStats: Record<string, { 
    month: string; 
    coachableSMB: number; 
    coachableGSF: number;
    driverTaggedSMB: number;
    driverTaggedGSF: number;
    total: number;
    unassigned: number;
  }> = {};
  
  events.forEach(event => {
    const date = new Date(event.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = { 
        month: monthName, 
        coachableSMB: 0, 
        coachableGSF: 0,
        driverTaggedSMB: 0,
        driverTaggedGSF: 0,
        total: 0,
        unassigned: 0
      };
    }
    
    const isSMB = event.carrier === 'Stevemacs';
    const isGSF = event.carrier === 'Great Southern Fuels';
    const isUnassigned = event.driver === 'Driver Unassigned';
    
    if (event.eventType === 'Coachable') {
      if (isSMB) monthlyStats[monthKey].coachableSMB++;
      if (isGSF) monthlyStats[monthKey].coachableGSF++;
    } else {
      if (isSMB) monthlyStats[monthKey].driverTaggedSMB++;
      if (isGSF) monthlyStats[monthKey].driverTaggedGSF++;
    }
    
    if (isUnassigned) monthlyStats[monthKey].unassigned++;
    monthlyStats[monthKey].total++;
  });
  
  return Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month));
};

const LYTXSafetyDashboard: React.FC = () => {
  const { toast } = useToast();
  const [selectedCarrier, setSelectedCarrier] = useState<'All' | 'Stevemacs' | 'Great Southern Fuels'>('All');
  const [dateRange, setDateRange] = useState('allTime');
  const [showConnectionTest, setShowConnectionTest] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [dashboardMode, setDashboardMode] = useState<'enhanced' | 'legacy'>('enhanced');

  const dateRanges = useDateRanges();

  // Create filters for historical data
  const filters: LytxAnalyticsFilters = useMemo(() => ({
    carrier: selectedCarrier,
    dateRange: dateRanges[dateRange as keyof typeof dateRanges],
    status: 'All',
    eventType: 'All',
    driverAssigned: 'All',
    excluded: false
  }), [selectedCarrier, dateRange, dateRanges]);

  // Fetch historical data from database
  const historyEvents = useLytxHistoricalEvents(filters);
  const summaryStats = useLytxSummaryStats(filters);
  const monthlyTrends = useLytxMonthlyTrends(filters);

  // Convert historical data to legacy format for compatibility
  const allEvents = useMemo(() => {
    if (!historyEvents.data) return [];
    
    return historyEvents.data.map(event => ({
      eventId: event.event_id,
      driver: event.driver_name,
      employeeId: event.employee_id || '',
      group: event.group_name,
      vehicle: event.vehicle_registration || '',
      device: event.device_serial,
      date: new Date(event.event_datetime).toLocaleDateString(),
      time: new Date(event.event_datetime).toLocaleTimeString(),
      score: event.score,
      status: event.status,
      trigger: event.trigger,
      behaviors: event.behaviors || '',
      eventType: event.event_type,
      carrier: event.carrier,
      excluded: event.excluded
    }));
  }, [historyEvents.data]);

  // Maintain legacy compatibility
  const filteredEvents = allEvents;
  const dashboardData = {
    isLoading: historyEvents.isLoading,
    isError: historyEvents.isError,
    error: historyEvents.error,
    events: {
      data: allEvents,
      refetch: historyEvents.refetch
    }
  };

  const monthlyData = useMemo(() => generateMonthlyData(filteredEvents), [filteredEvents]);

  // Calculate key metrics
  const totalEvents = filteredEvents.length;
  const coachableEvents = filteredEvents.filter(e => e.eventType === 'Coachable').length;
  const driverTaggedEvents = filteredEvents.filter(e => e.eventType === 'Driver Tagged').length;
  const resolvedEvents = filteredEvents.filter(e => e.status === 'Resolved').length;
  const unassignedDrivers = filteredEvents.filter(e => e.driver === 'Driver Unassigned').length;

  // Event status distribution
  const statusData = [
    { name: 'Resolved', value: resolvedEvents, color: '#10b981' },
    { name: 'Face-To-Face', value: filteredEvents.filter(e => e.status === 'Face-To-Face').length, color: '#f59e0b' },
    { name: 'FYI Notify', value: filteredEvents.filter(e => e.status === 'FYI Notify').length, color: '#3b82f6' },
    { name: 'New', value: filteredEvents.filter(e => e.status === 'New').length, color: '#ef4444' }
  ];

  // Top triggers
  const triggerCounts = filteredEvents.reduce((acc, event) => {
    acc[event.trigger] = (acc[event.trigger] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topTriggers = Object.entries(triggerCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([trigger, count]) => ({ trigger, count }));

  // Enhanced trigger analysis for modal
  const enhancedTriggerAnalysis = Object.entries(triggerCounts)
    .sort(([,a], [,b]) => b - a)
    .map(([trigger, count]) => {
      const triggerEvents = filteredEvents.filter(e => e.trigger === trigger);
      const avgScore = triggerEvents.reduce((sum, e) => sum + e.score, 0) / triggerEvents.length || 0;
      const resolvedCount = triggerEvents.filter(e => e.status === 'Resolved').length;
      const unassignedCount = triggerEvents.filter(e => e.driver === 'Driver Unassigned').length;
      
      // Driver breakdown
      const driverBreakdown = triggerEvents.reduce((acc, event) => {
        if (event.driver !== 'Driver Unassigned') {
          acc[event.driver] = (acc[event.driver] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      
      const topDrivers = Object.entries(driverBreakdown)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

      // Fleet breakdown
      const fleetBreakdown = triggerEvents.reduce((acc, event) => {
        acc[event.carrier] = (acc[event.carrier] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Monthly trend for this trigger
      const monthlyTrend = triggerEvents.reduce((acc, event) => {
        const date = new Date(event.date);
        const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        acc[monthKey] = (acc[monthKey] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        trigger,
        count,
        percentage: (count / totalEvents * 100),
        avgScore,
        resolutionRate: (resolvedCount / count * 100),
        unassignedCount,
        topDrivers,
        fleetBreakdown,
        monthlyTrend: Object.entries(monthlyTrend).sort(([a], [b]) => a.localeCompare(b))
      };
    });

  // Handle CSV import completion
  const handleCsvImportComplete = (result: { imported: number; duplicates: number; failed: number }) => {
    setShowCsvImportModal(false);
    
    // Refresh the dashboard data to include newly imported events
    dashboardData.events.refetch();
    
    // Show success toast
    toast({
      title: 'CSV Import Completed',
      description: `${result.imported} events imported successfully. ${result.duplicates} duplicates skipped.${result.failed > 0 ? ` ${result.failed} events failed to import.` : ''}`,
      variant: result.failed > 0 ? 'destructive' : 'default',
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Enhanced Dashboard Mode */}
      {dashboardMode === 'enhanced' && (
        <LytxHistoricalDashboard 
          defaultCarrier={selectedCarrier}
          defaultDateRange={filters.dateRange}
          showTitle={true}
        />
      )}

      {/* Legacy Dashboard Mode */}
      {dashboardMode === 'legacy' && (
        <>
          {/* Header */}
          <div className="mb-8">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">LYTX Safety Dashboard</h1>
                  <p className="text-gray-600">Historical analysis of {allEvents.length.toLocaleString()}+ stored safety events</p>
                </div>
                {/* Loading/Connection Status */}
                <div className="flex items-center gap-2">
                  {dashboardData.isLoading ? (
                    <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  ) : dashboardData.isError ? (
                    <Database className="h-5 w-5 text-red-500" />
                  ) : (
                    <Database className="h-5 w-5 text-green-500" />
                  )}
                  <span className={`text-sm ${dashboardData.isError ? 'text-red-600' : 'text-green-600'}`}>
                    {dashboardData.isLoading ? 'Loading Historical Data...' : 
                     dashboardData.isError ? 'Database Error' : 
                     'Historical Data'}
                  </span>
                </div>
              </div>
          <div className="flex gap-3">
            {/* Dashboard Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setDashboardMode('enhanced')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  dashboardMode === 'enhanced' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <History className="h-4 w-4 inline mr-1" />
                Enhanced
              </button>
              <button
                onClick={() => setDashboardMode('legacy')}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  dashboardMode === 'legacy' 
                    ? 'bg-gray-600 text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Legacy
              </button>
            </div>
            <button 
              onClick={() => setShowConnectionTest(!showConnectionTest)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Settings className="h-4 w-4" />
              API Settings
            </button>
            <button 
              onClick={() => setShowCsvImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 border border-purple-300 text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </button>
            <button 
              onClick={() => dashboardData.events.refetch()}
              disabled={dashboardData.isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            >
              <RefreshCw className={`h-4 w-4 ${dashboardData.isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button 
              onClick={async () => {
                try {
                  const blob = await LytxAnalyticsService.exportData({
                    format: 'csv',
                    includeCharts: false,
                    includeRawData: true,
                    filters
                  });
                  
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `lytx_safety_report_${new Date().toISOString().split('T')[0]}.csv`;
                  link.click();
                  URL.revokeObjectURL(url);
                } catch (error) {
                  console.error('Export failed:', error);
                  toast({
                    title: 'Export Failed',
                    description: 'Unable to export safety report. Please try again.',
                    variant: 'destructive'
                  });
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {dashboardData.isError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div>
                <h3 className="text-sm font-medium text-red-800">API Connection Failed</h3>
                <p className="text-sm text-red-700">
                  {dashboardData.error?.message || 'Unable to connect to Lytx API'}. 
                  No data available.
                </p>
              </div>
              <button 
                onClick={() => dashboardData.events.refetch()}
                className="ml-auto text-sm text-red-600 hover:text-red-800 underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Connection Test Panel */}
        {showConnectionTest && (
          <div className="mb-4">
            <LytxConnectionTest />
          </div>
        )}

        {/* Data Source Info */}
        <div className="mb-4 text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-blue-600" />
            <span>
              {dashboardData.events.data && allEvents.length > 0 ? 
                `Historical database analysis • ${allEvents.length.toLocaleString()} events across 17+ months (Jan 2024 - Aug 2025)` :
                dashboardData.isError ? 'Database connection failed' :
                dashboardData.isLoading ? 'Loading historical data...' : 'No events found for selected filters'
              }
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <select 
            value={selectedCarrier} 
            onChange={(e) => setSelectedCarrier(e.target.value as any)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Carriers</option>
            <option value="Stevemacs">Stevemacs</option>
            <option value="Great Southern Fuels">Great Southern Fuels</option>
          </select>
          
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="last30Days">Last 30 Days</option>
            <option value="last90Days">Last 90 Days</option>
            <option value="last6Months">Last 6 Months</option>
            <option value="lastYear">Last Year</option>
            <option value="year2024">2024 Full Year</option>
            <option value="year2025">2025 YTD</option>
            <option value="allTime">All Historical Data</option>
          </select>
        </div>
      </div>

      {/* Empty State */}
      {!dashboardData.isLoading && allEvents.length === 0 && (
        <div className="bg-white p-12 rounded-lg shadow-md text-center">
          <WifiOff className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Safety Events Found</h3>
          <p className="text-gray-600 mb-6">
            {dashboardData.isError 
              ? 'Unable to connect to the LYTX API. Please check your connection and try again.'
              : 'No safety events found for the selected date range and filters.'}
          </p>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => dashboardData.events.refetch()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Connection
            </button>
            <button 
              onClick={() => setShowConnectionTest(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Settings className="h-4 w-4" />
              Check API Settings
            </button>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      {allEvents.length > 0 && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{totalEvents}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Coachable Events</p>
              <p className="text-2xl font-bold text-orange-600">{coachableEvents}</p>
              <p className="text-xs text-gray-500">{totalEvents > 0 ? ((coachableEvents/totalEvents)*100).toFixed(1) : '0'}% of total</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Driver Tagged</p>
              <p className="text-2xl font-bold text-blue-600">{driverTaggedEvents}</p>
              <p className="text-xs text-gray-500">{totalEvents > 0 ? ((driverTaggedEvents/totalEvents)*100).toFixed(1) : '0'}% of total</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Resolution Rate</p>
              <p className="text-2xl font-bold text-green-600">{totalEvents > 0 ? ((resolvedEvents/totalEvents)*100).toFixed(1) : '0'}%</p>
              <p className="text-xs text-gray-500">{resolvedEvents} resolved</p>
            </div>
            <Calendar className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className={`p-6 rounded-lg shadow-md transition-colors ${
          unassignedDrivers > 0 ? 'bg-red-50 border-2 border-red-200' : 'bg-white'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">⚠️ Driver Assignment Required</p>
              <p className={`text-3xl font-bold ${unassignedDrivers > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                {unassignedDrivers}
              </p>
              <p className="text-xs text-gray-500 mb-2">
                {totalEvents > 0 ? ((unassignedDrivers/totalEvents)*100).toFixed(1) : '0'}% need review
              </p>
              {unassignedDrivers > 0 && (
                <button 
                  onClick={() => {
                    // Scroll to event table and filter for unassigned
                    const tableElement = document.querySelector('[data-testid="lytx-event-table"]');
                    if (tableElement) {
                      tableElement.scrollIntoView({ behavior: 'smooth' });
                    }
                  }}
                  className="mt-2 flex items-center gap-1 text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 transition-colors"
                >
                  <Users className="h-3 w-3" />
                  Assign Drivers Now
                </button>
              )}
            </div>
            <div className={`p-3 rounded-full ${unassignedDrivers > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
              <Users className={`h-8 w-8 ${unassignedDrivers > 0 ? 'text-red-600' : 'text-gray-500'}`} />
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Charts Row */}
      {allEvents.length > 0 && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Enhanced Monthly Trends with Fleet Breakdown */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Monthly Events by Fleet & Type</h3>
            <div className="ml-auto text-sm text-gray-500">
              SMB = Stevemacs • GSF = Great Southern Fuels
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip 
                formatter={(value, name) => [value, name]}
                labelFormatter={(label) => `Month: ${label}`}
              />
              {/* Legend */}
              <Bar dataKey="coachableSMB" stackId="coachable" fill="#3b82f6" name="SMB Coachable" />
              <Bar dataKey="coachableGSF" stackId="coachable" fill="#60a5fa" name="GSF Coachable" />
              <Bar dataKey="driverTaggedSMB" stackId="driverTagged" fill="#f59e0b" name="SMB Driver Tagged" />
              <Bar dataKey="driverTaggedGSF" stackId="driverTagged" fill="#fbbf24" name="GSF Driver Tagged" />
            </BarChart>
          </ResponsiveContainer>
          
          {/* Fleet Summary */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="bg-blue-50 p-3 rounded">
              <div className="font-medium text-blue-900">Stevemacs (SMB)</div>
              <div className="text-blue-700">
                Coachable: {monthlyData.reduce((sum, m) => sum + m.coachableSMB, 0)} | 
                Driver Tagged: {monthlyData.reduce((sum, m) => sum + m.driverTaggedSMB, 0)}
              </div>
            </div>
            <div className="bg-green-50 p-3 rounded">
              <div className="font-medium text-green-900">Great Southern Fuels (GSF)</div>
              <div className="text-green-700">
                Coachable: {monthlyData.reduce((sum, m) => sum + m.coachableGSF, 0)} | 
                Driver Tagged: {monthlyData.reduce((sum, m) => sum + m.driverTaggedGSF, 0)}
              </div>
            </div>
          </div>
        </div>

        {/* Event Status Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Event Status Distribution</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <Tooltip />
              <RechartsPieChart data={statusData} cx="50%" cy="50%" outerRadius={80}>
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </RechartsPieChart>
            </RechartsPieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {statusData.map((status) => (
              <div key={status.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }}></div>
                <span className="text-sm text-gray-600">{status.name}: {status.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Top Triggers and Carrier Actions */}
      {allEvents.length > 0 && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Safety Triggers */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Top Safety Triggers</h3>
          <div className="space-y-3">
            {topTriggers.map((item, index) => (
              <div key={item.trigger} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">{item.trigger}</span>
                <span className="text-lg font-bold text-gray-900">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Carrier Actions */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Carrier-Specific Analysis</h3>
          <div className="space-y-4">
            <button 
              onClick={() => window.location.href = '/data-centre/lytx-safety/stevemacs'}
              className="w-full p-4 text-left bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-blue-900">Stevemacs Safety Details</h4>
                  <p className="text-sm text-blue-600">View Kewdale depot safety analytics</p>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {filteredEvents.filter(e => e.carrier === 'Stevemacs').length}
                </div>
              </div>
            </button>

            <button 
              onClick={() => window.location.href = '/data-centre/lytx-safety/gsf'}
              className="w-full p-4 text-left bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-green-900">Great Southern Fuels Safety Details</h4>
                  <p className="text-sm text-green-600">View multi-depot safety analytics</p>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {filteredEvents.filter(e => e.carrier === 'Great Southern Fuels').length}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Event Types Analysis Table */}
      {allEvents.length > 0 && (
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold">Safety Event Types Analysis</h3>
          <span className="text-sm text-gray-500 ml-2">Click any row for detailed breakdown</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left p-3 font-medium text-gray-900">Event Type</th>
                <th className="text-left p-3 font-medium text-gray-900">Count</th>
                <th className="text-left p-3 font-medium text-gray-900">% of Total</th>
                <th className="text-left p-3 font-medium text-gray-900">Avg Score</th>
                <th className="text-left p-3 font-medium text-gray-900">Resolution Rate</th>
                <th className="text-left p-3 font-medium text-gray-900">Unassigned</th>
                <th className="text-left p-3 font-medium text-gray-900">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {enhancedTriggerAnalysis.slice(0, 10).map((trigger, index) => (
                <tr 
                  key={trigger.trigger}
                  onClick={() => {
                    setSelectedTrigger(trigger.trigger);
                    setShowTriggerModal(true);
                  }}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="p-3">
                    <div className="font-medium text-gray-900">{trigger.trigger}</div>
                    <div className="text-xs text-gray-500">Click for details</div>
                  </td>
                  <td className="p-3">
                    <span className="text-lg font-bold text-gray-900">{trigger.count}</span>
                  </td>
                  <td className="p-3">
                    <span className="text-sm text-gray-600">{trigger.percentage.toFixed(1)}%</span>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(trigger.percentage, 100)}%` }}
                      ></div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`font-medium ${
                      trigger.avgScore >= 3 ? 'text-red-600' : 
                      trigger.avgScore >= 1 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {trigger.avgScore.toFixed(1)}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`font-medium ${
                      trigger.resolutionRate >= 80 ? 'text-green-600' : 
                      trigger.resolutionRate >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {trigger.resolutionRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`font-medium ${
                      trigger.unassignedCount > 0 ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {trigger.unassignedCount}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="w-16 h-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trigger.monthlyTrend.map(([month, count]) => ({ month, count }))}>
                          <Line 
                            type="monotone" 
                            dataKey="count" 
                            stroke="#3b82f6" 
                            strokeWidth={1}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Action Items */}
      {allEvents.length > 0 && (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Action Items & Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 text-left border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors">
            <h4 className="font-semibold text-gray-900 mb-2">Update Driver Assignments</h4>
            <p className="text-sm text-gray-600">Assign drivers to {unassignedDrivers} unassigned events</p>
          </button>
          
          <button className="p-4 text-left border-2 border-gray-200 rounded-lg hover:border-orange-500 transition-colors">
            <h4 className="font-semibold text-gray-900 mb-2">Data Quality Review</h4>
            <p className="text-sm text-gray-600">Mark inaccurate events for exclusion from analysis</p>
          </button>
          
          <button className="p-4 text-left border-2 border-gray-200 rounded-lg hover:border-green-500 transition-colors">
            <h4 className="font-semibold text-gray-900 mb-2">Generate Reports</h4>
            <p className="text-sm text-gray-600">Export monthly safety reports for management</p>
          </button>
        </div>
      </div>
      )}

      {/* LYTX Event Management Table */}
      <div className="mt-8" data-testid="lytx-event-table">
        <LYTXEventTable 
          showTitle={true}
          maxHeight="500px"
          carrierFilter={selectedCarrier}
        />
      </div>
        </>
      )}

      {/* Event Type Detail Modal */}
      {showTriggerModal && selectedTrigger && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {(() => {
              const triggerData = enhancedTriggerAnalysis.find(t => t.trigger === selectedTrigger);
              if (!triggerData) return null;
              
              return (
                <>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedTrigger}</h3>
                      <div className="flex gap-4 text-sm text-gray-600">
                        <span>Total Events: <strong>{triggerData.count}</strong></span>
                        <span>Avg Score: <strong>{triggerData.avgScore.toFixed(1)}</strong></span>
                        <span>Resolution Rate: <strong>{triggerData.resolutionRate.toFixed(1)}%</strong></span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setShowTriggerModal(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Fleet Distribution */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">Fleet Distribution</h4>
                      <div className="space-y-2">
                        {Object.entries(triggerData.fleetBreakdown).map(([fleet, count]) => (
                          <div key={fleet} className="flex justify-between items-center">
                            <span className={`text-sm ${fleet === 'Stevemacs' ? 'text-blue-600' : 'text-green-600'}`}>
                              {fleet}
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${fleet === 'Stevemacs' ? 'bg-blue-600' : 'bg-green-600'}`}
                                  style={{ width: `${(count / triggerData.count) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-sm font-medium">{count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Monthly Trend Chart */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-3">Monthly Trend</h4>
                      <ResponsiveContainer width="100%" height={150}>
                        <BarChart data={triggerData.monthlyTrend.map(([month, count]) => ({ month, count }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Top Drivers */}
                  <div className="mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">Top Drivers for {selectedTrigger}</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {triggerData.topDrivers.length > 0 ? (
                          triggerData.topDrivers.map(([driver, count]) => (
                            <div key={driver} className="flex justify-between items-center p-3 bg-white rounded border">
                              <div>
                                <div className="font-medium text-gray-900">{driver}</div>
                                <div className="text-xs text-gray-500">{count} events</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-orange-500 h-2 rounded-full"
                                    style={{ width: `${(count / triggerData.count) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm font-bold">{count}</span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-gray-500 text-sm">All events are unassigned to drivers</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Recommendations */}
                  <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                    <h4 className="font-semibold text-blue-900 mb-2">Recommended Actions</h4>
                    <div className="space-y-2 text-sm text-blue-800">
                      {triggerData.unassignedCount > 0 && (
                        <div>• Assign drivers to {triggerData.unassignedCount} unassigned events</div>
                      )}
                      {triggerData.resolutionRate < 50 && (
                        <div>• Focus on improving resolution rate (currently {triggerData.resolutionRate.toFixed(1)}%)</div>
                      )}
                      {triggerData.avgScore > 2 && (
                        <div>• High average score ({triggerData.avgScore.toFixed(1)}) indicates need for targeted coaching</div>
                      )}
                      {triggerData.topDrivers.length > 0 && triggerData.topDrivers[0][1] > 5 && (
                        <div>• Consider additional training for top driver: {triggerData.topDrivers[0][0]} ({triggerData.topDrivers[0][1]} events)</div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* CSV Import Modal - Available in both modes */}
      <LytxCsvImportModal
        open={showCsvImportModal}
        onOpenChange={setShowCsvImportModal}
        onImportComplete={handleCsvImportComplete}
        userId="current-user" // TODO: Get actual user ID from auth context
      />
    </div>
  );
};

// Wrap with ErrorBoundary for better error handling
const LYTXSafetyDashboardWithErrorBoundary: React.FC = () => (
  <ErrorBoundary 
    fallback={({ error, resetError }) => (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-semibold">LYTX Dashboard Error</h3>
          </div>
          <p className="text-red-700 mb-4">
            Failed to load LYTX safety data. This may be due to API connectivity issues or data processing errors.
          </p>
          <button 
            onClick={resetError}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Retry Loading
          </button>
        </div>
      </div>
    )}
  >
    <LYTXSafetyDashboard />
  </ErrorBoundary>
);

export default LYTXSafetyDashboardWithErrorBoundary;