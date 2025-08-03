import React, { useState, useMemo } from 'react';
import { ArrowLeft, Truck, Users, MapPin, TrendingUp, Award, Activity, Fuel, Calendar, Route } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface StevemacsVehicle {
  registration: string;
  driver?: string;
  status: 'Active' | 'Maintenance' | 'Available' | 'Out of Service';
  utilization: number;
  fuelEfficiency: number;
  safetyScore: number;
  totalDeliveries: number;
  totalKilometers: number;
  lastService: string;
  nextService: string;
  route: string;
  deliveriesThisMonth: number;
}

// Stevemacs fleet data focused on Kewdale operations
const stevemacsFleet: StevemacsVehicle[] = [
  {
    registration: '1BMU188',
    driver: 'Brad Cameron',
    status: 'Active',
    utilization: 85,
    fuelEfficiency: 3.2,
    safetyScore: 8.5,
    totalDeliveries: 156,
    totalKilometers: 287450,
    lastService: '2025-07-15',
    nextService: '2025-10-15',
    route: 'Perth Metro North',
    deliveriesThisMonth: 22
  },
  {
    registration: '1ILI310',
    driver: undefined,
    status: 'Available',
    utilization: 0,
    fuelEfficiency: 3.5,
    safetyScore: 8.9,
    totalDeliveries: 89,
    totalKilometers: 156780,
    lastService: '2025-07-25',
    nextService: '2025-10-25',
    route: 'Standby',
    deliveriesThisMonth: 0
  },
  {
    registration: '1CCL525',
    driver: 'Craig Bean',
    status: 'Active',
    utilization: 92,
    fuelEfficiency: 3.1,
    safetyScore: 8.7,
    totalDeliveries: 203,
    totalKilometers: 342890,
    lastService: '2025-06-30',
    nextService: '2025-09-30',
    route: 'Perth Metro South',
    deliveriesThisMonth: 28
  },
  {
    registration: '1CVU378',
    driver: 'Simon Rankin',
    status: 'Active',
    utilization: 88,
    fuelEfficiency: 3.4,
    safetyScore: 8.3,
    totalDeliveries: 178,
    totalKilometers: 298660,
    lastService: '2025-07-10',
    nextService: '2025-10-10',
    route: 'Perth Metro East',
    deliveriesThisMonth: 25
  },
  {
    registration: '1DFI259',
    driver: 'Dheyaa Al-Kaabi',
    status: 'Maintenance',
    utilization: 0,
    fuelEfficiency: 2.9,
    safetyScore: 7.9,
    totalDeliveries: 145,
    totalKilometers: 389140,
    lastService: '2025-08-02',
    nextService: '2025-11-02',
    route: 'Workshop',
    deliveriesThisMonth: 18
  },
  {
    registration: '1GMQ115',
    driver: 'Terry Harrop',
    status: 'Active',
    utilization: 94,
    fuelEfficiency: 3.3,
    safetyScore: 9.1,
    totalDeliveries: 234,
    totalKilometers: 456220,
    lastService: '2025-05-20',
    nextService: '2025-08-20',
    route: 'Perth Metro West',
    deliveriesThisMonth: 31
  }
];

// Generate delivery route performance data
const generateRoutePerformance = () => {
  return [
    { route: 'Perth Metro North', vehicles: 1, deliveries: 22, efficiency: 3.2, utilization: 85 },
    { route: 'Perth Metro South', vehicles: 1, deliveries: 28, efficiency: 3.1, utilization: 92 },
    { route: 'Perth Metro East', vehicles: 1, deliveries: 25, efficiency: 3.4, utilization: 88 },
    { route: 'Perth Metro West', vehicles: 1, deliveries: 31, efficiency: 3.3, utilization: 94 }
  ];
};

// Generate monthly performance trends
const generateMonthlyTrends = () => {
  return [
    { month: 'Mar 25', deliveries: 420, utilization: 82, efficiency: 3.1, safety: 8.2 },
    { month: 'Apr 25', deliveries: 445, utilization: 85, efficiency: 3.2, safety: 8.4 },
    { month: 'May 25', deliveries: 412, utilization: 88, efficiency: 3.3, safety: 8.5 },
    { month: 'Jun 25', deliveries: 478, utilization: 84, efficiency: 3.0, safety: 8.3 },
    { month: 'Jul 25', deliveries: 502, utilization: 90, efficiency: 3.4, safety: 8.6 },
    { month: 'Aug 25', deliveries: 495, utilization: 89, efficiency: 3.2, safety: 8.7 }
  ];
};

const StevemacsFleetDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState('30');

  const routePerformance = useMemo(() => generateRoutePerformance(), []);
  const monthlyTrends = useMemo(() => generateMonthlyTrends(), []);

  // Calculate fleet metrics
  const totalVehicles = stevemacsFleet.length;
  const activeVehicles = stevemacsFleet.filter(v => v.status === 'Active').length;
  const availableVehicles = stevemacsFleet.filter(v => v.status === 'Available').length;
  const averageUtilization = (stevemacsFleet.reduce((sum, v) => sum + v.utilization, 0) / totalVehicles).toFixed(1);
  const averageSafetyScore = (stevemacsFleet.reduce((sum, v) => sum + v.safetyScore, 0) / totalVehicles).toFixed(1);
  const totalDeliveriesThisMonth = stevemacsFleet.reduce((sum, v) => sum + v.deliveriesThisMonth, 0);
  const averageFuelEfficiency = (stevemacsFleet.reduce((sum, v) => sum + v.fuelEfficiency, 0) / totalVehicles).toFixed(1);

  // Driver performance
  const driverPerformance = stevemacsFleet
    .filter(v => v.driver)
    .map(v => ({
      driver: v.driver!,
      vehicle: v.registration,
      deliveries: v.deliveriesThisMonth,
      utilization: v.utilization,
      safety: v.safetyScore,
      efficiency: v.fuelEfficiency
    }))
    .sort((a, b) => b.deliveries - a.deliveries);

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
            <h1 className="text-3xl font-bold text-blue-900 mb-2">Stevemacs Fleet Analytics</h1>
            <p className="text-blue-600">Kewdale depot operations and Perth metropolitan delivery optimization</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-blue-600 mb-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>Primary Base: Kewdale Depot</span>
          </div>
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4" />
            <span>Coverage: Perth Metro & Surrounding Areas</span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            <span>Fleet Focus: Urban Delivery Efficiency</span>
          </div>
        </div>

        {/* Time Range Filter */}
        <div className="mb-6">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-blue-50"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="365">Last Year</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Fleet Size</p>
              <p className="text-2xl font-bold text-blue-900">{totalVehicles}</p>
            </div>
            <Truck className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Active Fleet</p>
              <p className="text-2xl font-bold text-green-900">{activeVehicles}</p>
              <p className="text-xs text-green-600">{availableVehicles} available</p>
            </div>
            <Activity className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Utilization</p>
              <p className="text-2xl font-bold text-purple-900">{averageUtilization}%</p>
              <p className="text-xs text-purple-600">Fleet efficiency</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-700">Safety Score</p>
              <p className="text-2xl font-bold text-orange-900">{averageSafetyScore}</p>
              <p className="text-xs text-orange-600">Out of 10</p>
            </div>
            <Award className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-lg border border-indigo-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-700">Monthly Deliveries</p>
              <p className="text-2xl font-bold text-indigo-900">{totalDeliveriesThisMonth}</p>
              <p className="text-xs text-indigo-600">This month</p>
            </div>
            <Calendar className="h-8 w-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-lg border border-teal-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-teal-700">Fuel Efficiency</p>
              <p className="text-2xl font-bold text-teal-900">{averageFuelEfficiency}</p>
              <p className="text-xs text-teal-600">km/L average</p>
            </div>
            <Fuel className="h-8 w-8 text-teal-600" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Performance Trends */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Monthly Performance Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="deliveries" stackId="1" stroke="#3b82f6" fill="#bfdbfe" />
              <Area type="monotone" dataKey="utilization" stackId="2" stroke="#10b981" fill="#a7f3d0" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Route Performance */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Route Performance Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={routePerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="route" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="deliveries" fill="#3b82f6" name="Deliveries" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Driver Performance */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Driver Performance Leaderboard</h3>
          <div className="space-y-3">
            {driverPerformance.map((driver, index) => (
              <div key={driver.driver} className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-400' : 'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-blue-900">{driver.driver}</span>
                    <p className="text-xs text-blue-600">{driver.vehicle} • Safety: {driver.safety}/10</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-blue-700">{driver.deliveries}</span>
                  <p className="text-xs text-blue-600">{driver.utilization}% util</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Route Coverage Map */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Route Coverage & Efficiency</h3>
          <div className="space-y-4">
            {routePerformance.map((route) => (
              <div key={route.route} className="p-4 bg-blue-50 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-blue-900">{route.route}</h4>
                  <span className="text-lg font-bold text-blue-700">{route.deliveries}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-blue-600">
                  <div>Utilization: {route.utilization}%</div>
                  <div>Efficiency: {route.efficiency} km/L</div>
                </div>
                <div className="mt-2 bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${route.utilization}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Fleet Status Overview */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Fleet Status Overview</h3>
          <div className="space-y-3">
            {stevemacsFleet.map((vehicle) => (
              <div key={vehicle.registration} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-900">{vehicle.registration}</span>
                  <p className="text-xs text-gray-600">{vehicle.driver || 'Unassigned'} • {vehicle.route}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    vehicle.status === 'Active' ? 'bg-green-100 text-green-800' :
                    vehicle.status === 'Available' ? 'bg-blue-100 text-blue-800' :
                    vehicle.status === 'Maintenance' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {vehicle.status}
                  </span>
                  <span className="text-sm font-bold text-blue-700">{vehicle.utilization}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Optimization Recommendations */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Optimization Recommendations</h3>
          <div className="space-y-3">
            <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
              <h4 className="font-semibold text-green-800">Route Efficiency</h4>
              <p className="text-sm text-green-700">Perth Metro West showing highest efficiency. Consider replicating strategies across other routes.</p>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
              <h4 className="font-semibold text-blue-800">Fleet Utilization</h4>
              <p className="text-sm text-blue-700">1 vehicle available for deployment. Consider dynamic route allocation during peak periods.</p>
            </div>
            
            <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
              <h4 className="font-semibold text-yellow-800">Maintenance Planning</h4>
              <p className="text-sm text-yellow-700">1DFI259 in maintenance. Schedule preventive services during low-demand periods.</p>
            </div>
            
            <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
              <h4 className="font-semibold text-purple-800">Driver Performance</h4>
              <p className="text-sm text-purple-700">Terry Harrop leading in deliveries. Consider mentoring programs for skill transfer.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-lg text-white">
        <h3 className="text-lg font-semibold mb-4">Stevemacs Fleet Operations</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Route Optimization</h4>
            <p className="text-sm opacity-90">AI-powered delivery route planning for Perth metro area</p>
          </button>
          
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Driver Scheduling</h4>
            <p className="text-sm opacity-90">Optimize driver assignments and shift planning</p>
          </button>
          
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Fleet Report</h4>
            <p className="text-sm opacity-90">Generate comprehensive Stevemacs performance report</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StevemacsFleetDashboard;