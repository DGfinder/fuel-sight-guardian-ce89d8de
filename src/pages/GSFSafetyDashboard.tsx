import React, { useState, useMemo } from 'react';
import { ArrowLeft, AlertTriangle, TrendingUp, Users, Award, MapPin, Truck, BarChart3, Calendar, Clock, Target, Shield, Settings, RefreshCw, Download, Filter, Search, Loader2, WifiOff } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, ComposedChart, Area, AreaChart } from 'recharts';
import { useLytxCarrierEvents, useLytxDashboardData } from '@/hooks/useLytxData';
import { lytxDataTransformer, LYTXEvent } from '@/services/lytxDataTransform';
import DateRangeFilter from '@/components/DateRangeFilter';
import { useDateRangeFilter } from '@/hooks/useDateRangeFilter';

interface DriverMetrics {
  name: string;
  employeeId: string;
  depot: string;
  totalEvents: number;
  coachableEvents: number;
  driverTaggedEvents: number;
  averageScore: number;
  resolutionRate: number;
  lastEventDate: string;
  trend: 'improving' | 'declining' | 'stable';
  riskLevel: 'low' | 'medium' | 'high';
}

interface DepotMetrics {
  name: string;
  totalEvents: number;
  eventsPerDay: number;
  resolutionRate: number;
  averageScore: number;
  driverCount: number;
  topTriggers: Array<{ trigger: string; count: number }>;
}

// Helper functions for data analysis
const calculateDriverMetrics = (events: LYTXEvent[]): DriverMetrics[] => {
  const driverMap = new Map<string, LYTXEvent[]>();
  
  // Group events by driver
  events.forEach(event => {
    if (event.driver !== 'Driver Unassigned') {
      const key = `${event.driver}-${event.employeeId}`;
      if (!driverMap.has(key)) {
        driverMap.set(key, []);
      }
      driverMap.get(key)!.push(event);
    }
  });
  
  return Array.from(driverMap.entries()).map(([key, driverEvents]) => {
    const totalEvents = driverEvents.length;
    const coachableEvents = driverEvents.filter(e => e.eventType === 'Coachable').length;
    const driverTaggedEvents = driverEvents.filter(e => e.eventType === 'Driver Tagged').length;
    const resolvedEvents = driverEvents.filter(e => e.status === 'Resolved').length;
    const totalScore = driverEvents.reduce((sum, e) => sum + e.score, 0);
    
    // Sort events by date to get trend
    const sortedEvents = driverEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const recentEvents = sortedEvents.slice(-5); // Last 5 events
    const olderEvents = sortedEvents.slice(0, -5);
    
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentEvents.length > 0 && olderEvents.length > 0) {
      const recentAvg = recentEvents.reduce((sum, e) => sum + e.score, 0) / recentEvents.length;
      const olderAvg = olderEvents.reduce((sum, e) => sum + e.score, 0) / olderEvents.length;
      trend = recentAvg < olderAvg ? 'improving' : recentAvg > olderAvg ? 'declining' : 'stable';
    }
    
    const averageScore = totalScore / totalEvents;
    const riskLevel: 'low' | 'medium' | 'high' = 
      totalEvents > 10 && averageScore > 3 ? 'high' :
      totalEvents > 5 && averageScore > 1 ? 'medium' : 'low';
    
    return {
      name: driverEvents[0].driver,
      employeeId: driverEvents[0].employeeId,
      depot: driverEvents[0].group,
      totalEvents,
      coachableEvents,
      driverTaggedEvents,
      averageScore,
      resolutionRate: (resolvedEvents / totalEvents) * 100,
      lastEventDate: sortedEvents[sortedEvents.length - 1].date,
      trend,
      riskLevel
    };
  }).sort((a, b) => b.totalEvents - a.totalEvents);
};

const calculateDepotMetrics = (events: LYTXEvent[]): DepotMetrics[] => {
  const depotMap = new Map<string, LYTXEvent[]>();
  
  events.forEach(event => {
    if (!depotMap.has(event.group)) {
      depotMap.set(event.group, []);
    }
    depotMap.get(event.group)!.push(event);
  });
  
  return Array.from(depotMap.entries()).map(([depot, depotEvents]) => {
    const totalEvents = depotEvents.length;
    const resolvedEvents = depotEvents.filter(e => e.status === 'Resolved').length;
    const totalScore = depotEvents.reduce((sum, e) => sum + e.score, 0);
    const uniqueDrivers = new Set(depotEvents.filter(e => e.driver !== 'Driver Unassigned').map(e => e.driver)).size;
    
    // Calculate events per day (assuming 30-day period)
    const eventsPerDay = totalEvents / 30;
    
    // Top triggers
    const triggerCounts = depotEvents.reduce((acc, event) => {
      acc[event.trigger] = (acc[event.trigger] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topTriggers = Object.entries(triggerCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([trigger, count]) => ({ trigger, count }));
    
    return {
      name: depot,
      totalEvents,
      eventsPerDay,
      resolutionRate: (resolvedEvents / totalEvents) * 100,
      averageScore: totalScore / totalEvents,
      driverCount: uniqueDrivers,
      topTriggers
    };
  }).sort((a, b) => b.totalEvents - a.totalEvents);
};

const generateMonthlyTrends = (events: LYTXEvent[]) => {
  const monthlyStats: Record<string, { 
    month: string; 
    coachable: number; 
    driverTagged: number; 
    avgScore: number; 
    resolved: number;
    newEvents: number;
  }> = {};
  
  events.forEach(event => {
    const date = new Date(event.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = { 
        month: monthName, 
        coachable: 0, 
        driverTagged: 0, 
        avgScore: 0, 
        resolved: 0,
        newEvents: 0
      };
    }
    
    const stats = monthlyStats[monthKey];
    if (event.eventType === 'Coachable') {
      stats.coachable++;
    } else {
      stats.driverTagged++;
    }
    
    if (event.status === 'Resolved') stats.resolved++;
    if (event.status === 'New') stats.newEvents++;
    stats.avgScore += event.score;
  });
  
  return Object.values(monthlyStats)
    .map(stats => ({
      ...stats,
      avgScore: stats.avgScore / (stats.coachable + stats.driverTagged) || 0,
      total: stats.coachable + stats.driverTagged
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
};

const GSFSafetyDashboard: React.FC = () => {
  const [selectedDepot, setSelectedDepot] = useState<'All' | 'Albany' | 'Geraldton' | 'Kalgoorlie' | 'Kewdale' | 'Narrogin' | 'Bunbury'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date range filtering
  const { startDate, endDate, setDateRange, isFiltered } = useDateRangeFilter();
  
  // Get date range for API calls
  const apiDateRange = useMemo(() => {
    if (startDate && endDate) {
      return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      };
    }
    return lytxDataTransformer.createDateRange(90); // Default to 90 days
  }, [startDate, endDate]);

  // Fetch GSF-specific data using API
  const gsfEventsQuery = useLytxCarrierEvents('Great Southern Fuels', apiDateRange);
  const dashboardData = useLytxDashboardData(apiDateRange);

  // Process events data
  const allEvents = useMemo(() => {
    return gsfEventsQuery.data?.events || [];
  }, [gsfEventsQuery.data]);

  // Filter events based on depot and search
  const filteredEvents = useMemo(() => {
    let filtered = allEvents;
    
    // Filter by depot
    if (selectedDepot !== 'All') {
      filtered = filtered.filter(event => event.group === selectedDepot);
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(event => 
        event.driver.toLowerCase().includes(term) ||
        event.employeeId.toLowerCase().includes(term) ||
        event.trigger.toLowerCase().includes(term)
      );
    }
    
    return filtered;
  }, [allEvents, selectedDepot, searchTerm]);

  // Calculate metrics
  const driverMetrics = useMemo(() => calculateDriverMetrics(filteredEvents), [filteredEvents]);
  const depotMetrics = useMemo(() => calculateDepotMetrics(allEvents), [allEvents]);
  const monthlyTrends = useMemo(() => generateMonthlyTrends(allEvents), [allEvents]);

  // Key performance indicators
  const totalEvents = filteredEvents.length;
  const coachableEvents = filteredEvents.filter(e => e.eventType === 'Coachable').length;
  const driverTaggedEvents = filteredEvents.filter(e => e.eventType === 'Driver Tagged').length;
  const resolvedEvents = filteredEvents.filter(e => e.status === 'Resolved').length;
  const unassignedEvents = filteredEvents.filter(e => e.driver === 'Driver Unassigned').length;
  const averageScore = totalEvents > 0 ? (filteredEvents.reduce((sum, e) => sum + e.score, 0) / totalEvents).toFixed(1) : '0';

  // Event status distribution for pie chart
  const statusData = [
    { name: 'Resolved', value: resolvedEvents, color: '#10b981' },
    { name: 'Face-To-Face', value: filteredEvents.filter(e => e.status === 'Face-To-Face').length, color: '#f59e0b' },
    { name: 'FYI Notify', value: filteredEvents.filter(e => e.status === 'FYI Notify').length, color: '#3b82f6' },
    { name: 'New', value: filteredEvents.filter(e => e.status === 'New').length, color: '#ef4444' }
  ];

  // Top safety triggers
  const triggerCounts = filteredEvents.reduce((acc, event) => {
    acc[event.trigger] = (acc[event.trigger] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topTriggers = Object.entries(triggerCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([trigger, count]) => ({ trigger, count }));

  if (gsfEventsQuery.isLoading || dashboardData.isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-green-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading GSF safety data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (gsfEventsQuery.isError) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <WifiOff className="h-6 w-6 text-red-600" />
            <div>
              <h3 className="text-lg font-semibold text-red-800">API Connection Failed</h3>
              <p className="text-red-700">Unable to load GSF safety data from LYTX API</p>
              <button 
                onClick={() => gsfEventsQuery.refetch()}
                className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
              >
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => window.history.back()}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-green-900 mb-2">Great Southern Fuels Safety Analytics</h1>
            <p className="text-green-600">Advanced driver performance and safety event analysis across all GSF depots</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {gsfEventsQuery.isLoading && <Loader2 className="h-5 w-5 text-green-500 animate-spin" />}
            <button 
              onClick={() => gsfEventsQuery.refetch()}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-green-600 mb-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>Depots: Albany, Geraldton, Kalgoorlie, Kewdale, Narrogin</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>Period: {apiDateRange.startDate} to {apiDateRange.endDate}</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span>{totalEvents} Total Events</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <DateRangeFilter 
            startDate={startDate}
            endDate={endDate}
            onDateRangeChange={setDateRange}
          />
          
          <select 
            value={selectedDepot} 
            onChange={(e) => setSelectedDepot(e.target.value as any)}
            className="px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-green-50"
          >
            <option value="All">All Depots</option>
            <option value="Albany">Albany</option>
            <option value="Geraldton">Geraldton</option>
            <option value="Kalgoorlie">Kalgoorlie</option>
            <option value="Kewdale">Kewdale</option>
            <option value="Narrogin">Narrogin</option>
            <option value="Bunbury">Bunbury</option>
          </select>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search drivers, triggers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Total Events</p>
              <p className="text-2xl font-bold text-green-900">{totalEvents}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">Coachable</p>
              <p className="text-2xl font-bold text-orange-900">{coachableEvents}</p>
              <p className="text-xs text-orange-600">{totalEvents > 0 ? ((coachableEvents/totalEvents)*100).toFixed(1) : 0}%</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-lg border border-indigo-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-700">Driver Tagged</p>
              <p className="text-2xl font-bold text-indigo-900">{driverTaggedEvents}</p>
              <p className="text-xs text-indigo-600">{totalEvents > 0 ? ((driverTaggedEvents/totalEvents)*100).toFixed(1) : 0}%</p>
            </div>
            <Users className="h-8 w-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-lg border border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">Resolution Rate</p>
              <p className="text-2xl font-bold text-emerald-900">{totalEvents > 0 ? ((resolvedEvents/totalEvents)*100).toFixed(1) : 0}%</p>
              <p className="text-xs text-emerald-600">{resolvedEvents} resolved</p>
            </div>
            <Award className="h-8 w-8 text-emerald-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Avg. Score</p>
              <p className="text-2xl font-bold text-purple-900">{averageScore}</p>
              <p className="text-xs text-purple-600">Safety severity</p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 p-6 rounded-lg border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-700">Unassigned</p>
              <p className="text-2xl font-bold text-red-900">{unassignedEvents}</p>
              <p className="text-xs text-red-600">Need assignment</p>
            </div>
            <Clock className="h-8 w-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Driver Performance Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Drivers by Event Count */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Driver Performance Analysis
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {driverMetrics.slice(0, 10).map((driver, index) => (
              <div key={`${driver.name}-${driver.employeeId}`} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-green-900">{driver.name}</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      driver.riskLevel === 'high' ? 'bg-red-100 text-red-800' :
                      driver.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {driver.riskLevel} risk
                    </span>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      driver.trend === 'improving' ? 'bg-green-100 text-green-800' :
                      driver.trend === 'declining' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {driver.trend}
                    </span>
                  </div>
                  <p className="text-xs text-green-600">
                    {driver.depot} • {driver.totalEvents} events • {driver.resolutionRate.toFixed(0)}% resolved • Avg: {driver.averageScore.toFixed(1)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Trends */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Monthly Event Trends
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis yAxisId="events" />
              <YAxis yAxisId="score" orientation="right" />
              <Tooltip />
              <Bar yAxisId="events" dataKey="coachable" stackId="events" fill="#f59e0b" name="Coachable" />
              <Bar yAxisId="events" dataKey="driverTagged" stackId="events" fill="#3b82f6" name="Driver Tagged" />
              <Line yAxisId="score" type="monotone" dataKey="avgScore" stroke="#ef4444" strokeWidth={2} name="Avg Score" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Depot Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Depot Performance */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Depot Performance Analysis
          </h3>
          <div className="space-y-3">
            {depotMetrics.map((depot) => (
              <div key={depot.name} className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-green-900">{depot.name}</h4>
                  <span className="text-lg font-bold text-green-700">{depot.totalEvents} events</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-green-600">Resolution Rate</p>
                    <p className="font-semibold">{depot.resolutionRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-green-600">Avg Score</p>
                    <p className="font-semibold">{depot.averageScore.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-green-600">Drivers</p>
                    <p className="font-semibold">{depot.driverCount}</p>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-xs text-green-600">Top triggers: {depot.topTriggers.map(t => t.trigger).join(', ')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Event Status Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Event Status Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <RechartsPieChart>
              <Tooltip />
              <RechartsPieChart data={statusData} cx="50%" cy="50%" outerRadius={80}>
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </RechartsPieChart>
            </ResponsiveContainer>
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

      {/* Top Safety Triggers */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-green-100 mb-8">
        <h3 className="text-lg font-semibold text-green-900 mb-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Top Safety Triggers Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {topTriggers.map((trigger, index) => (
            <div key={trigger.trigger} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-700">{trigger.count}</p>
                <p className="text-sm font-medium text-orange-800">{trigger.trigger}</p>
                <p className="text-xs text-orange-600">{totalEvents > 0 ? ((trigger.count/totalEvents)*100).toFixed(1) : 0}% of events</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 rounded-lg text-white">
        <h3 className="text-lg font-semibold mb-4">GSF Safety Management Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Assign Unassigned Events</h4>
            <p className="text-sm opacity-90">{unassignedEvents} events need driver assignment</p>
          </button>
          
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">High-Risk Driver Review</h4>
            <p className="text-sm opacity-90">{driverMetrics.filter(d => d.riskLevel === 'high').length} drivers need attention</p>
          </button>
          
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Export Safety Report</h4>
            <p className="text-sm opacity-90">Generate comprehensive analysis report</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GSFSafetyDashboard;