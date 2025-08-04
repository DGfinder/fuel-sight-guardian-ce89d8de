import React, { useState, useMemo } from 'react';
import { AlertTriangle, TrendingUp, Users, Calendar, Filter, Download, BarChart3, PieChart, Loader2, WifiOff, Settings, RefreshCw } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell } from 'recharts';
import LYTXEventTable from '@/components/LYTXEventTable';
import LytxConnectionTest from '@/components/LytxConnectionTest';
import { useLytxDashboardData } from '@/hooks/useLytxData';
import { lytxDataTransformer } from '@/services/lytxDataTransform';

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

// Sample data based on 365-day LYTX export analysis
const mockLYTXEvents: LYTXEvent[] = [
  {
    eventId: 'AAQZB23038',
    driver: 'Driver Unassigned',
    employeeId: '',
    group: 'Kewdale',
    vehicle: '1ILI310',
    device: 'QM40999887',
    date: '8/3/25',
    time: '6:31:52 PM',
    score: 0,
    status: 'New',
    trigger: 'Lens Obstruction',
    behaviors: '',
    eventType: 'Coachable',
    carrier: 'Stevemacs'
  },
  {
    eventId: 'AAQZB09348',
    driver: 'Driver Unassigned',
    employeeId: '',
    group: 'Geraldton',
    vehicle: '1GLD510',
    device: 'MV00252104',
    date: '8/3/25',
    time: '4:49:47 PM',
    score: 0,
    status: 'New',
    trigger: 'Food or Drink',
    behaviors: '',
    eventType: 'Coachable',
    carrier: 'Great Southern Fuels'
  },
  {
    eventId: 'AAQYA94405',
    driver: 'Driver Unassigned',
    employeeId: '',
    group: 'Kalgoorlie',
    vehicle: '1GSF248',
    device: 'QM40025388',
    date: '8/3/25',
    time: '2:54:45 PM',
    score: 0,
    status: 'Resolved',
    trigger: 'Handheld Device',
    behaviors: '',
    eventType: 'Coachable',
    carrier: 'Great Southern Fuels'
  },
  {
    eventId: 'AAQYF72979',
    driver: 'Driver Unassigned',
    employeeId: '',
    group: 'Kewdale',
    vehicle: '1IFJ910',
    device: 'QM40999881',
    date: '7/31/25',
    time: '2:02:29 PM',
    score: 0,
    status: 'Resolved',
    trigger: 'Driver Tagged',
    behaviors: 'Driver Tagged',
    eventType: 'Driver Tagged',
    carrier: 'Stevemacs'
  }
];

// Generate monthly trend data
const generateMonthlyData = (events: LYTXEvent[]) => {
  const monthlyStats: Record<string, { month: string; coachable: number; driverTagged: number; total: number }> = {};
  
  events.forEach(event => {
    const date = new Date(event.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = { month: monthName, coachable: 0, driverTagged: 0, total: 0 };
    }
    
    if (event.eventType === 'Coachable') {
      monthlyStats[monthKey].coachable++;
    } else {
      monthlyStats[monthKey].driverTagged++;
    }
    monthlyStats[monthKey].total++;
  });
  
  return Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month));
};

const LYTXSafetyDashboard: React.FC = () => {
  const [selectedCarrier, setSelectedCarrier] = useState<'All' | 'Stevemacs' | 'Great Southern Fuels'>('All');
  const [dateRange, setDateRange] = useState('30');
  const [showConnectionTest, setShowConnectionTest] = useState(false);

  // Get date range for API calls
  const apiDateRange = useMemo(() => {
    const days = parseInt(dateRange);
    return lytxDataTransformer.createDateRange(days);
  }, [dateRange]);

  // Fetch dashboard data from API
  const dashboardData = useLytxDashboardData(apiDateRange);

  // Use API data or fallback to mock data
  const allEvents = useMemo(() => {
    console.log('Dashboard events data:', dashboardData.events.data);
    
    // Handle different possible data structures
    let events = mockLYTXEvents; // Default fallback
    
    if (dashboardData.events.data?.events && Array.isArray(dashboardData.events.data.events)) {
      events = dashboardData.events.data.events;
    } else if (dashboardData.events.data && Array.isArray(dashboardData.events.data)) {
      events = dashboardData.events.data;
    } else if (dashboardData.events.isSuccess && dashboardData.events.data) {
      console.warn('Unexpected events data structure:', dashboardData.events.data);
    }
    
    console.log('Final events array:', events, 'Length:', events?.length);
    return Array.isArray(events) ? events : mockLYTXEvents;
  }, [dashboardData.events.data, dashboardData.events.isSuccess]);

  // Filter events based on selected carrier
  const filteredEvents = useMemo(() => {
    return allEvents.filter(event => {
      if (selectedCarrier === 'All') return true;
      return event.carrier === selectedCarrier;
    });
  }, [allEvents, selectedCarrier]);

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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">LYTX Safety Dashboard</h1>
              <p className="text-gray-600">Monitor safety events, driver performance, and compliance metrics</p>
            </div>
            {/* Loading/Connection Status */}
            <div className="flex items-center gap-2">
              {dashboardData.isLoading ? (
                <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
              ) : dashboardData.isError ? (
                <WifiOff className="h-5 w-5 text-red-500" />
              ) : (
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              )}
              <span className={`text-sm ${dashboardData.isError ? 'text-red-600' : 'text-gray-500'}`}>
                {dashboardData.isLoading ? 'Loading...' : 
                 dashboardData.isError ? 'API Error' : 
                 'Live Data'}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowConnectionTest(!showConnectionTest)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Settings className="h-4 w-4" />
              API Settings
            </button>
            <button 
              onClick={() => dashboardData.events.refetch()}
              disabled={dashboardData.isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            >
              <RefreshCw className={`h-4 w-4 ${dashboardData.isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
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
                  Showing demo data instead.
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
        <div className="mb-4 text-sm text-gray-600">
          {dashboardData.events.data ? 
            `Showing live data from ${apiDateRange.startDate} to ${apiDateRange.endDate} • ${allEvents.length} total events` :
            'Showing demo data (API connection failed)'
          }
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
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="180">Last 180 Days</option>
            <option value="365">Last 365 Days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
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
              <p className="text-xs text-gray-500">{((coachableEvents/totalEvents)*100).toFixed(1)}% of total</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Driver Tagged</p>
              <p className="text-2xl font-bold text-blue-600">{driverTaggedEvents}</p>
              <p className="text-xs text-gray-500">{((driverTaggedEvents/totalEvents)*100).toFixed(1)}% of total</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Resolution Rate</p>
              <p className="text-2xl font-bold text-green-600">{((resolvedEvents/totalEvents)*100).toFixed(1)}%</p>
              <p className="text-xs text-gray-500">{resolvedEvents} resolved</p>
            </div>
            <Calendar className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unassigned Drivers</p>
              <p className="text-2xl font-bold text-gray-600">{unassignedDrivers}</p>
              <p className="text-xs text-gray-500">{((unassignedDrivers/totalEvents)*100).toFixed(1)}% pending</p>
            </div>
            <Filter className="h-8 w-8 text-gray-500" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Trends */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold">Monthly Event Trends</h3>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="coachable" stroke="#f59e0b" strokeWidth={2} name="Coachable Events" />
              <Line type="monotone" dataKey="driverTagged" stroke="#3b82f6" strokeWidth={2} name="Driver Tagged" />
            </LineChart>
          </ResponsiveContainer>
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

      {/* Top Triggers and Carrier Actions */}
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

      {/* Action Items */}
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

      {/* LYTX Event Management Table */}
      <div className="mt-8">
        <LYTXEventTable 
          showTitle={true}
          maxHeight="500px"
          carrierFilter={selectedCarrier}
        />
      </div>
    </div>
  );
};

export default LYTXSafetyDashboard;