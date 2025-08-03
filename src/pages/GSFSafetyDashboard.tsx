import React, { useState, useMemo } from 'react';
import { ArrowLeft, AlertTriangle, TrendingUp, Users, Award, MapPin, Truck, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell } from 'recharts';

interface GSFEvent {
  eventId: string;
  driver: string;
  vehicle: string;
  depot: string;
  date: string;
  score: number;
  status: 'New' | 'Face-To-Face' | 'FYI Notify' | 'Resolved';
  trigger: string;
  behaviors: string;
  eventType: 'Coachable' | 'Driver Tagged';
}

// Sample GSF safety data across multiple depots
const mockGSFEvents: GSFEvent[] = [
  {
    eventId: 'AAQZB09348',
    driver: 'Driver Unassigned',
    vehicle: '1GLD510',
    depot: 'Geraldton',
    date: '8/3/25',
    score: 0,
    status: 'New',
    trigger: 'Food or Drink',
    behaviors: '',
    eventType: 'Coachable'
  },
  {
    eventId: 'AAQYA94405',
    driver: 'Driver Unassigned',
    vehicle: '1GSF248',
    depot: 'Kalgoorlie',
    date: '8/3/25',
    score: 0,
    status: 'Resolved',
    trigger: 'Handheld Device',
    behaviors: '',
    eventType: 'Coachable'
  },
  {
    eventId: 'EYKR01503',
    driver: 'Mark Geary',
    vehicle: '1ECE509',
    depot: 'Kewdale',
    date: '1/3/2024',
    score: 3,
    status: 'Resolved',
    trigger: 'Braking',
    behaviors: 'Other Concern',
    eventType: 'Coachable'
  },
  {
    eventId: 'EYLX78719',
    driver: 'Andrew Buchanan',
    vehicle: '1EXM998',
    depot: 'Geraldton',
    date: '1/7/2024',
    score: 0,
    status: 'Resolved',
    trigger: 'Cornering',
    behaviors: 'Driver Unbelted [Roadway]',
    eventType: 'Coachable'
  },
  {
    eventId: 'EYMG49224',
    driver: 'Ken Atkins',
    vehicle: '1HDO841',
    depot: 'Geraldton',
    date: '1/30/2024',
    score: 0,
    status: 'Resolved',
    trigger: 'Braking',
    behaviors: 'Cell Handheld - Observed,Driver Unbelted [Yard]',
    eventType: 'Coachable'
  },
  {
    eventId: 'EYMQ48496',
    driver: 'Gavin Coulls',
    vehicle: '1GSF249',
    depot: 'Kalgoorlie',
    date: '2/5/2024',
    score: 0,
    status: 'Resolved',
    trigger: 'Braking',
    behaviors: 'ER Obstruction',
    eventType: 'Coachable'
  }
];

// Generate monthly safety trends by depot
const generateDepotTrends = (events: GSFEvent[]) => {
  const monthlyStats: Record<string, Record<string, { coachable: number; driverTagged: number; avgScore: number; eventCount: number }>> = {};
  
  events.forEach(event => {
    const date = new Date(event.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = {};
    }
    if (!monthlyStats[monthKey][event.depot]) {
      monthlyStats[monthKey][event.depot] = { coachable: 0, driverTagged: 0, avgScore: 0, eventCount: 0 };
    }
    
    const depotStats = monthlyStats[monthKey][event.depot];
    if (event.eventType === 'Coachable') {
      depotStats.coachable++;
    } else {
      depotStats.driverTagged++;
    }
    depotStats.avgScore += event.score;
    depotStats.eventCount++;
  });
  
  // Convert to chart format
  const chartData = Object.entries(monthlyStats).map(([monthKey, depots]) => {
    const date = new Date(monthKey);
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    const result: any = { month: monthName };
    Object.entries(depots).forEach(([depot, stats]) => {
      result[`${depot}_events`] = stats.coachable + stats.driverTagged;
      result[`${depot}_score`] = stats.eventCount > 0 ? stats.avgScore / stats.eventCount : 0;
    });
    
    return result;
  }).sort((a, b) => a.month.localeCompare(b.month));
  
  return chartData;
};

const GSFSafetyDashboard: React.FC = () => {
  const [selectedDepot, setSelectedDepot] = useState<'All' | 'Geraldton' | 'Kalgoorlie' | 'Kewdale' | 'Narrogin' | 'Albany'>('All');

  // Filter events by depot
  const filteredEvents = useMemo(() => {
    return selectedDepot === 'All' 
      ? mockGSFEvents 
      : mockGSFEvents.filter(e => e.depot === selectedDepot);
  }, [selectedDepot]);

  const depotTrends = useMemo(() => generateDepotTrends(mockGSFEvents), []);

  // Calculate key metrics
  const totalEvents = filteredEvents.length;
  const coachableEvents = filteredEvents.filter(e => e.eventType === 'Coachable').length;
  const driverTaggedEvents = filteredEvents.filter(e => e.eventType === 'Driver Tagged').length;
  const resolvedEvents = filteredEvents.filter(e => e.status === 'Resolved').length;
  const highScoreEvents = filteredEvents.filter(e => e.score >= 5).length;
  const averageScore = totalEvents > 0 ? (filteredEvents.reduce((sum, e) => sum + e.score, 0) / totalEvents).toFixed(1) : '0';

  // Depot performance analysis
  const depotStats = mockGSFEvents.reduce((acc, event) => {
    if (!acc[event.depot]) {
      acc[event.depot] = { events: 0, totalScore: 0, resolved: 0, coachable: 0 };
    }
    acc[event.depot].events++;
    acc[event.depot].totalScore += event.score;
    if (event.status === 'Resolved') acc[event.depot].resolved++;
    if (event.eventType === 'Coachable') acc[event.depot].coachable++;
    return acc;
  }, {} as Record<string, { events: number; totalScore: number; resolved: number; coachable: number }>);

  const depotPerformance = Object.entries(depotStats)
    .map(([depot, stats]) => ({
      depot,
      events: stats.events,
      avgScore: (stats.totalScore / stats.events).toFixed(1),
      resolutionRate: ((stats.resolved / stats.events) * 100).toFixed(0),
      coachableRate: ((stats.coachable / stats.events) * 100).toFixed(0)
    }))
    .sort((a, b) => b.events - a.events);

  // Driver performance analysis
  const driverStats = filteredEvents.reduce((acc, event) => {
    if (event.driver !== 'Driver Unassigned') {
      if (!acc[event.driver]) {
        acc[event.driver] = { events: 0, totalScore: 0, resolved: 0, depot: event.depot };
      }
      acc[event.driver].events++;
      acc[event.driver].totalScore += event.score;
      if (event.status === 'Resolved') acc[event.driver].resolved++;
    }
    return acc;
  }, {} as Record<string, { events: number; totalScore: number; resolved: number; depot: string }>);

  const topDrivers = Object.entries(driverStats)
    .map(([driver, stats]) => ({
      driver,
      depot: stats.depot,
      events: stats.events,
      avgScore: (stats.totalScore / stats.events).toFixed(1),
      resolutionRate: ((stats.resolved / stats.events) * 100).toFixed(0)
    }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 5);

  // Safety trigger analysis
  const triggerCounts = filteredEvents.reduce((acc, event) => {
    acc[event.trigger] = (acc[event.trigger] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topTriggers = Object.entries(triggerCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 4);

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
            <p className="text-green-600">Multi-depot safety performance tracking across regional operations</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-green-600 mb-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>Regional Coverage: Geraldton, Kalgoorlie, Narrogin, Albany</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span>Fleet Operations: Multi-depot coordination</span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            <span>Safety Focus: Regional consistency</span>
          </div>
        </div>

        {/* Depot Filter */}
        <div className="mb-6">
          <select 
            value={selectedDepot} 
            onChange={(e) => setSelectedDepot(e.target.value as any)}
            className="px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-green-50"
          >
            <option value="All">All Depots</option>
            <option value="Geraldton">Geraldton</option>
            <option value="Kalgoorlie">Kalgoorlie</option>
            <option value="Kewdale">Kewdale</option>
            <option value="Narrogin">Narrogin</option>
            <option value="Albany">Albany</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
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
              <p className="text-sm font-medium text-orange-700">Coachable Events</p>
              <p className="text-2xl font-bold text-orange-900">{coachableEvents}</p>
              <p className="text-xs text-orange-600">{((coachableEvents/totalEvents)*100).toFixed(1)}% of total</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-lg border border-indigo-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-700">Driver Tagged</p>
              <p className="text-2xl font-bold text-indigo-900">{driverTaggedEvents}</p>
              <p className="text-xs text-indigo-600">{((driverTaggedEvents/totalEvents)*100).toFixed(1)}% of total</p>
            </div>
            <Users className="h-8 w-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-lg border border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">Resolution Rate</p>
              <p className="text-2xl font-bold text-emerald-900">{((resolvedEvents/totalEvents)*100).toFixed(1)}%</p>
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
              <p className="text-xs text-purple-600">{highScoreEvents} high severity</p>
            </div>
            <BarChart3 className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Depot Performance Comparison */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4">Depot Safety Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={depotPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="depot" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="events" fill="#10b981" name="Total Events" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Regional Safety Trends */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4">Monthly Regional Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={depotTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="Geraldton_events" stroke="#059669" strokeWidth={2} name="Geraldton" />
              <Line type="monotone" dataKey="Kalgoorlie_events" stroke="#dc2626" strokeWidth={2} name="Kalgoorlie" />
              <Line type="monotone" dataKey="Kewdale_events" stroke="#2563eb" strokeWidth={2} name="Kewdale" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Depot Performance Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Depot Performance Summary */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4">Depot Performance Analysis</h3>
          <div className="space-y-3">
            {depotPerformance.map((depot, index) => (
              <div key={depot.depot} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-green-900">{depot.depot}</span>
                  <p className="text-xs text-green-600">{depot.events} events • {depot.resolutionRate}% resolved • {depot.coachableRate}% coachable</p>
                </div>
                <span className="text-lg font-bold text-green-700">Avg: {depot.avgScore}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Driver Performance (filtered by depot) */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4">
            Driver Performance {selectedDepot !== 'All' ? `- ${selectedDepot}` : ''}
          </h3>
          <div className="space-y-3">
            {topDrivers.length > 0 ? topDrivers.map((driver, index) => (
              <div key={driver.driver} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-green-900">{driver.driver}</span>
                  <p className="text-xs text-green-600">{driver.depot} • {driver.events} events • {driver.resolutionRate}% resolved</p>
                </div>
                <span className="text-lg font-bold text-green-700">Avg: {driver.avgScore}</span>
              </div>
            )) : (
              <p className="text-sm text-green-600 italic">No assigned drivers for selected depot filter</p>
            )}
          </div>
        </div>
      </div>

      {/* Safety Focus Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Safety Triggers */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4">
            Top Safety Concerns {selectedDepot !== 'All' ? `- ${selectedDepot}` : ''}
          </h3>
          <div className="space-y-3">
            {topTriggers.map(([trigger, count], index) => (
              <div key={trigger} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-sm font-medium text-orange-800">{trigger}</span>
                <span className="text-lg font-bold text-orange-700">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Regional Improvement Actions */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4">Regional Safety Initiatives</h3>
          <div className="space-y-3">
            <div className="p-4 bg-emerald-50 rounded-lg border-l-4 border-emerald-500">
              <h4 className="font-semibold text-emerald-800">Cross-Depot Training</h4>
              <p className="text-sm text-emerald-700">Standardize safety procedures across all GSF locations</p>
            </div>
            
            <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
              <h4 className="font-semibold text-green-800">Regional Safety Champions</h4>
              <p className="text-sm text-green-700">Identify and develop safety leaders at each depot</p>
            </div>
            
            <div className="p-4 bg-teal-50 rounded-lg border-l-4 border-teal-500">
              <h4 className="font-semibold text-teal-800">Equipment Standardization</h4>
              <p className="text-sm text-teal-700">Ensure consistent safety equipment across all depots</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 rounded-lg text-white">
        <h3 className="text-lg font-semibold mb-4">GSF Regional Safety Management Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Regional Safety Meeting</h4>
            <p className="text-sm opacity-90">Coordinate safety initiatives across all depots</p>
          </button>
          
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Depot Safety Audits</h4>
            <p className="text-sm opacity-90">Schedule comprehensive safety reviews by location</p>
          </button>
          
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Regional Safety Report</h4>
            <p className="text-sm opacity-90">Generate comprehensive GSF safety performance analysis</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GSFSafetyDashboard;