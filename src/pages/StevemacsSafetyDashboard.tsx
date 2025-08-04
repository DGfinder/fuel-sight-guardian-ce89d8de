import React, { useState, useMemo } from 'react';
import { ArrowLeft, AlertTriangle, TrendingUp, Users, Award, MapPin, Truck, BarChart3 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell } from 'recharts';

interface StevemacsEvent {
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

// Sample Stevemacs safety data
const mockStevemacsEvents: StevemacsEvent[] = [
  {
    eventId: 'AAQZB23038',
    driver: 'Driver Unassigned',
    vehicle: '1ILI310',
    depot: 'Kewdale',
    date: '8/3/25',
    score: 0,
    status: 'New',
    trigger: 'Lens Obstruction',
    behaviors: '',
    eventType: 'Coachable'
  },
  {
    eventId: 'AAQYF72979',
    driver: 'Driver Unassigned',
    vehicle: '1IFJ910',
    depot: 'Kewdale',
    date: '7/31/25',
    score: 0,
    status: 'Resolved',
    trigger: 'Driver Tagged',
    behaviors: 'Driver Tagged',
    eventType: 'Driver Tagged'
  },
  {
    eventId: 'EYKP77802',
    driver: 'Peter Aramini',
    vehicle: '1HOO182',
    depot: 'Kewdale',
    date: '1/2/2024',
    score: 0,
    status: 'Resolved',
    trigger: 'No Seat Belt',
    behaviors: 'Driver Unbelted [Roadway]',
    eventType: 'Coachable'
  },
  {
    eventId: 'EYKY54453',
    driver: 'Peter Aramini',
    vehicle: '1HOO182',
    depot: 'Kewdale',
    date: '1/5/2024',
    score: 7,
    status: 'Resolved',
    trigger: 'No Seat Belt',
    behaviors: 'Cell Hands Free - Distraction,Following Distance: ≥ 1 sec to < 2 sec',
    eventType: 'Coachable'
  },
  {
    eventId: 'EYKY98890',
    driver: 'Craig Bean',
    vehicle: '1GDJ946',
    depot: 'Kewdale',
    date: '1/8/2024',
    score: 8,
    status: 'Resolved',
    trigger: 'Braking',
    behaviors: 'Failed to Keep an Out,Near Collision',
    eventType: 'Coachable'
  }
];

// Generate monthly safety trends
const generateMonthlyTrends = (events: StevemacsEvent[]) => {
  const monthlyStats: Record<string, { month: string; coachable: number; driverTagged: number; avgScore: number; eventCount: number }> = {};
  
  events.forEach(event => {
    const date = new Date(event.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    
    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = { month: monthName, coachable: 0, driverTagged: 0, avgScore: 0, eventCount: 0 };
    }
    
    if (event.eventType === 'Coachable') {
      monthlyStats[monthKey].coachable++;
    } else {
      monthlyStats[monthKey].driverTagged++;
    }
    monthlyStats[monthKey].avgScore += event.score;
    monthlyStats[monthKey].eventCount++;
  });
  
  // Calculate average scores
  Object.values(monthlyStats).forEach(month => {
    month.avgScore = month.eventCount > 0 ? month.avgScore / month.eventCount : 0;
  });
  
  return Object.values(monthlyStats).sort((a, b) => a.month.localeCompare(b.month));
};

const StevemacsSafetyDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState('365');

  const monthlyTrends = useMemo(() => generateMonthlyTrends(mockStevemacsEvents), []);

  // Calculate key metrics
  const totalEvents = mockStevemacsEvents.length;
  const coachableEvents = mockStevemacsEvents.filter(e => e.eventType === 'Coachable').length;
  const driverTaggedEvents = mockStevemacsEvents.filter(e => e.eventType === 'Driver Tagged').length;
  const resolvedEvents = mockStevemacsEvents.filter(e => e.status === 'Resolved').length;
  const highScoreEvents = mockStevemacsEvents.filter(e => e.score >= 5).length;
  const averageScore = totalEvents > 0 ? (mockStevemacsEvents.reduce((sum, e) => sum + e.score, 0) / totalEvents).toFixed(1) : '0';

  // Driver performance analysis
  const driverStats = mockStevemacsEvents.reduce((acc, event) => {
    if (event.driver !== 'Driver Unassigned') {
      if (!acc[event.driver]) {
        acc[event.driver] = { events: 0, totalScore: 0, resolved: 0 };
      }
      acc[event.driver].events++;
      acc[event.driver].totalScore += event.score;
      if (event.status === 'Resolved') acc[event.driver].resolved++;
    }
    return acc;
  }, {} as Record<string, { events: number; totalScore: number; resolved: number }>);

  const topDrivers = Object.entries(driverStats)
    .map(([driver, stats]) => ({
      driver,
      events: stats.events,
      avgScore: (stats.totalScore / stats.events).toFixed(1),
      resolutionRate: ((stats.resolved / stats.events) * 100).toFixed(0)
    }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 5);

  // Fleet performance by vehicle
  const vehicleStats = mockStevemacsEvents.reduce((acc, event) => {
    if (!acc[event.vehicle]) {
      acc[event.vehicle] = { events: 0, totalScore: 0 };
    }
    acc[event.vehicle].events++;
    acc[event.vehicle].totalScore += event.score;
    return acc;
  }, {} as Record<string, { events: number; totalScore: number }>);

  const topVehicles = Object.entries(vehicleStats)
    .map(([vehicle, stats]) => ({
      vehicle,
      events: stats.events,
      avgScore: (stats.totalScore / stats.events).toFixed(1)
    }))
    .sort((a, b) => b.events - a.events)
    .slice(0, 5);

  // Safety trigger analysis
  const triggerCounts = mockStevemacsEvents.reduce((acc, event) => {
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
            <h1 className="text-3xl font-bold text-blue-900 mb-2">Stevemacs Safety Analytics</h1>
            <p className="text-blue-600">Comprehensive safety performance tracking for Stevemacs fleet operations</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-blue-600">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>Primary Depot: Kewdale</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span>Fleet Coverage: Perth Metro</span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            <span>Safety Focus: Driver Development</span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Total Events</p>
              <p className="text-2xl font-bold text-blue-900">{totalEvents}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-blue-600" />
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

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Resolution Rate</p>
              <p className="text-2xl font-bold text-green-900">{((resolvedEvents/totalEvents)*100).toFixed(1)}%</p>
              <p className="text-xs text-green-600">{resolvedEvents} resolved</p>
            </div>
            <Award className="h-8 w-8 text-green-600" />
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
        {/* Monthly Safety Trends */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Monthly Safety Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="coachable" stroke="#f59e0b" strokeWidth={2} name="Coachable Events" />
              <Line type="monotone" dataKey="driverTagged" stroke="#3b82f6" strokeWidth={2} name="Driver Tagged" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Safety Score Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Average Monthly Severity Scores</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="avgScore" fill="#3b82f6" name="Average Score" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Drivers Performance */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Driver Performance Summary</h3>
          <div className="space-y-3">
            {topDrivers.map((driver, index) => (
              <div key={driver.driver} className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-blue-900">{driver.driver}</span>
                  <p className="text-xs text-blue-600">{driver.events} events • {driver.resolutionRate}% resolved</p>
                </div>
                <span className="text-lg font-bold text-blue-700">Avg: {driver.avgScore}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fleet Vehicle Analysis */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Fleet Vehicle Safety</h3>
          <div className="space-y-3">
            {topVehicles.map((vehicle, index) => (
              <div key={vehicle.vehicle} className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-blue-900">{vehicle.vehicle}</span>
                  <p className="text-xs text-blue-600">{vehicle.events} safety events</p>
                </div>
                <span className="text-lg font-bold text-blue-700">Avg: {vehicle.avgScore}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Safety Focus Areas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Safety Triggers */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Top Safety Concerns</h3>
          <div className="space-y-3">
            {topTriggers.map(([trigger, count], index) => (
              <div key={trigger} className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-sm font-medium text-orange-800">{trigger}</span>
                <span className="text-lg font-bold text-orange-700">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Improvement Actions */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Recommended Actions</h3>
          <div className="space-y-3">
            <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
              <h4 className="font-semibold text-green-800">Driver Training Focus</h4>
              <p className="text-sm text-green-700">Implement targeted coaching for high-frequency triggers</p>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <h4 className="font-semibold text-blue-800">Fleet Maintenance Review</h4>
              <p className="text-sm text-blue-700">Schedule safety equipment checks for top event vehicles</p>
            </div>
            
            <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
              <h4 className="font-semibold text-yellow-800">Policy Reinforcement</h4>
              <p className="text-sm text-yellow-700">Review seatbelt and device usage policies with drivers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-lg text-white">
        <h3 className="text-lg font-semibold mb-4">Stevemacs Safety Management Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Schedule Driver Coaching</h4>
            <p className="text-sm opacity-90">Set up face-to-face sessions for high-risk events</p>
          </button>
          
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Fleet Safety Audit</h4>
            <p className="text-sm opacity-90">Review vehicle safety systems and maintenance</p>
          </button>
          
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Generate Safety Report</h4>
            <p className="text-sm opacity-90">Export Stevemacs safety performance summary</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StevemacsSafetyDashboard;