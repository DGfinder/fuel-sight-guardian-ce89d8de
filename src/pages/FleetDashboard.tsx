import React, { useState, useMemo } from 'react';
import { Truck, Users, AlertTriangle, Wrench, MapPin, TrendingUp, Activity, Shield, Database, Search } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell } from 'recharts';
import { Link } from 'react-router-dom';

interface Vehicle {
  registration: string;
  fleet: 'Stevemacs' | 'Great Southern Fuels';
  depot: string;
  status: 'Active' | 'Maintenance' | 'Out of Service' | 'Available';
  driver?: string;
  safetyScore: number;
  fuelEfficiency: number;
  utilization: number;
  lastService: string;
  nextService: string;
  guardianUnit?: string;
  lytxDevice?: string;
  totalDeliveries: number;
  fatigueEvents: number;
  safetyEvents: number;
}

// Enhanced vehicle database based on master fleet data
const mockFleetData: Vehicle[] = [
  {
    registration: '1BMU188',
    fleet: 'Stevemacs',
    depot: 'Kewdale',
    status: 'Active',
    driver: 'Brad Cameron',
    safetyScore: 8.5,
    fuelEfficiency: 3.2,
    utilization: 85,
    lastService: '2025-07-15',
    nextService: '2025-10-15',
    guardianUnit: 'P1002260-S00002698',
    lytxDevice: 'QM40999887',
    totalDeliveries: 156,
    fatigueEvents: 2,
    safetyEvents: 5
  },
  {
    registration: '1GLD510',
    fleet: 'Great Southern Fuels',
    depot: 'Geraldton',
    status: 'Active',
    driver: 'Andrew Buchanan',
    safetyScore: 9.1,
    fuelEfficiency: 3.8,
    utilization: 92,
    lastService: '2025-06-20',
    nextService: '2025-09-20',
    guardianUnit: 'P04025-S00013423',
    lytxDevice: 'MV00252104',
    totalDeliveries: 203,
    fatigueEvents: 1,
    safetyEvents: 3
  },
  {
    registration: '1GSF248',
    fleet: 'Great Southern Fuels',
    depot: 'Kalgoorlie',
    status: 'Maintenance',
    driver: undefined,
    safetyScore: 7.8,
    fuelEfficiency: 3.1,
    utilization: 0,
    lastService: '2025-08-01',
    nextService: '2025-11-01',
    guardianUnit: 'P1002260-S00010668',
    lytxDevice: 'QM40025388',
    totalDeliveries: 142,
    fatigueEvents: 4,
    safetyEvents: 8
  },
  {
    registration: '1ILI310',
    fleet: 'Stevemacs',
    depot: 'Kewdale',
    status: 'Available',
    driver: undefined,
    safetyScore: 8.9,
    fuelEfficiency: 3.5,
    utilization: 0,
    lastService: '2025-07-25',
    nextService: '2025-10-25',
    guardianUnit: 'P1002260-S00010798',
    lytxDevice: 'QM40999887',
    totalDeliveries: 89,
    fatigueEvents: 0,
    safetyEvents: 2
  },
  {
    registration: '1HUT976',
    fleet: 'Great Southern Fuels',
    depot: 'Geraldton',
    status: 'Active',
    driver: 'Matthew Ahearn',
    safetyScore: 8.3,
    fuelEfficiency: 3.4,
    utilization: 78,
    lastService: '2025-05-30',
    nextService: '2025-08-30',
    guardianUnit: 'P04025-S00010474',
    lytxDevice: 'MV00252082',
    totalDeliveries: 178,
    fatigueEvents: 3,
    safetyEvents: 6
  }
];

// Generate monthly fleet performance data
const generateMonthlyFleetData = () => {
  return [
    { month: 'Jan 25', utilization: 82, efficiency: 3.3, safety: 8.4, maintenance: 12 },
    { month: 'Feb 25', utilization: 85, efficiency: 3.4, safety: 8.6, maintenance: 8 },
    { month: 'Mar 25', utilization: 88, efficiency: 3.5, safety: 8.5, maintenance: 15 },
    { month: 'Apr 25', utilization: 84, efficiency: 3.2, safety: 8.8, maintenance: 6 },
    { month: 'May 25', utilization: 90, efficiency: 3.6, safety: 8.7, maintenance: 10 },
    { month: 'Jun 25', utilization: 87, efficiency: 3.4, safety: 8.9, maintenance: 9 },
    { month: 'Jul 25', utilization: 89, efficiency: 3.5, safety: 8.6, maintenance: 7 },
    { month: 'Aug 25', utilization: 91, efficiency: 3.7, safety: 8.8, maintenance: 11 }
  ];
};

const FleetDashboard: React.FC = () => {
  const [selectedCarrier, setSelectedCarrier] = useState<'All' | 'Stevemacs' | 'Great Southern Fuels'>('All');
  const [selectedDepot, setSelectedDepot] = useState<'All' | 'Kewdale' | 'Geraldton' | 'Kalgoorlie' | 'Narrogin' | 'Albany'>('All');

  // Filter fleet data
  const filteredFleet = useMemo(() => {
    return mockFleetData.filter(vehicle => {
      if (selectedCarrier !== 'All' && vehicle.fleet !== selectedCarrier) return false;
      if (selectedDepot !== 'All' && vehicle.depot !== selectedDepot) return false;
      return true;
    });
  }, [selectedCarrier, selectedDepot]);

  const monthlyData = useMemo(() => generateMonthlyFleetData(), []);

  // Calculate fleet metrics
  const totalVehicles = filteredFleet.length;
  const activeVehicles = filteredFleet.filter(v => v.status === 'Active').length;
  const maintenanceVehicles = filteredFleet.filter(v => v.status === 'Maintenance').length;
  const averageUtilization = totalVehicles > 0 ? (filteredFleet.reduce((sum, v) => sum + v.utilization, 0) / totalVehicles).toFixed(1) : '0';
  const averageSafetyScore = totalVehicles > 0 ? (filteredFleet.reduce((sum, v) => sum + v.safetyScore, 0) / totalVehicles).toFixed(1) : '0';
  const averageFuelEfficiency = totalVehicles > 0 ? (filteredFleet.reduce((sum, v) => sum + v.fuelEfficiency, 0) / totalVehicles).toFixed(1) : '0';

  // Fleet status distribution
  const statusData = [
    { name: 'Active', value: activeVehicles, color: '#10b981' },
    { name: 'Available', value: filteredFleet.filter(v => v.status === 'Available').length, color: '#3b82f6' },
    { name: 'Maintenance', value: maintenanceVehicles, color: '#f59e0b' },
    { name: 'Out of Service', value: filteredFleet.filter(v => v.status === 'Out of Service').length, color: '#ef4444' }
  ];

  // Depot performance
  const depotStats = filteredFleet.reduce((acc, vehicle) => {
    if (!acc[vehicle.depot]) {
      acc[vehicle.depot] = { vehicles: 0, utilization: 0, safety: 0, efficiency: 0 };
    }
    acc[vehicle.depot].vehicles++;
    acc[vehicle.depot].utilization += vehicle.utilization;
    acc[vehicle.depot].safety += vehicle.safetyScore;
    acc[vehicle.depot].efficiency += vehicle.fuelEfficiency;
    return acc;
  }, {} as Record<string, { vehicles: number; utilization: number; safety: number; efficiency: number }>);

  const depotPerformance = Object.entries(depotStats).map(([depot, stats]) => ({
    depot,
    vehicles: stats.vehicles,
    avgUtilization: (stats.utilization / stats.vehicles).toFixed(1),
    avgSafety: (stats.safety / stats.vehicles).toFixed(1),
    avgEfficiency: (stats.efficiency / stats.vehicles).toFixed(1)
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Fleet Management Dashboard</h1>
            <p className="text-gray-600">Comprehensive fleet analytics, vehicle tracking, and performance monitoring</p>
          </div>
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              <Database className="h-4 w-4" />
              Vehicle Database
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
              <Search className="h-4 w-4" />
              Advanced Search
            </button>
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
            value={selectedDepot} 
            onChange={(e) => setSelectedDepot(e.target.value as any)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Depots</option>
            <option value="Kewdale">Kewdale</option>
            <option value="Geraldton">Geraldton</option>
            <option value="Kalgoorlie">Kalgoorlie</option>
            <option value="Narrogin">Narrogin</option>
            <option value="Albany">Albany</option>
          </select>
        </div>
      </div>

      {/* Key Fleet Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Fleet</p>
              <p className="text-2xl font-bold text-gray-900">{totalVehicles}</p>
            </div>
            <Truck className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Vehicles</p>
              <p className="text-2xl font-bold text-green-600">{activeVehicles}</p>
              <p className="text-xs text-gray-500">{((activeVehicles/totalVehicles)*100).toFixed(1)}% operational</p>
            </div>
            <Activity className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Utilization</p>
              <p className="text-2xl font-bold text-blue-600">{averageUtilization}%</p>
              <p className="text-xs text-gray-500">Fleet efficiency</p>
            </div>
            <TrendingUp className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Safety Score</p>
              <p className="text-2xl font-bold text-orange-600">{averageSafetyScore}</p>
              <p className="text-xs text-gray-500">Out of 10</p>
            </div>
            <Shield className="h-8 w-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Fuel Efficiency</p>
              <p className="text-2xl font-bold text-purple-600">{averageFuelEfficiency}</p>
              <p className="text-xs text-gray-500">km/L average</p>
            </div>
            <MapPin className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Maintenance</p>
              <p className="text-2xl font-bold text-yellow-600">{maintenanceVehicles}</p>
              <p className="text-xs text-gray-500">Scheduled service</p>
            </div>
            <Wrench className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Fleet Performance */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Monthly Fleet Performance</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="utilization" stroke="#3b82f6" strokeWidth={2} name="Utilization %" />
              <Line type="monotone" dataKey="efficiency" stroke="#10b981" strokeWidth={2} name="Efficiency (km/L)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Fleet Status Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Fleet Status Distribution</h3>
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

      {/* Depot Performance & Carrier Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Depot Performance */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Depot Performance Analysis</h3>
          <div className="space-y-3">
            {depotPerformance.map((depot, index) => (
              <div key={depot.depot} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-900">{depot.depot}</span>
                  <p className="text-xs text-gray-600">{depot.vehicles} vehicles • {depot.avgUtilization}% utilization</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-gray-900">Safety: {depot.avgSafety}</span>
                  <p className="text-xs text-gray-600">Efficiency: {depot.avgEfficiency} km/L</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Carrier Fleet Management */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">Carrier Fleet Management</h3>
          <div className="space-y-4">
            <button 
              onClick={() => window.location.href = '/data-centre/fleet/stevemacs'}
              className="w-full p-4 text-left bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-blue-900">Stevemacs Fleet Analytics</h4>
                  <p className="text-sm text-blue-600">Kewdale depot operations and urban delivery optimization</p>
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {mockFleetData.filter(v => v.fleet === 'Stevemacs').length}
                </div>
              </div>
            </button>

            <button 
              onClick={() => window.location.href = '/data-centre/fleet/gsf'}
              className="w-full p-4 text-left bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-semibold text-green-900">GSF Fleet Analytics</h4>
                  <p className="text-sm text-green-600">Multi-depot regional operations and logistics</p>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {mockFleetData.filter(v => v.fleet === 'Great Southern Fuels').length}
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Fleet Management Tools */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-lg font-semibold mb-4">Fleet Management Tools</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Link 
            to="/data-centre/fleet/database"
            className="p-4 text-left border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors block"
          >
            <Database className="w-8 h-8 text-blue-600 mb-2" />
            <h4 className="font-semibold text-gray-900 mb-2">Vehicle Database</h4>
            <p className="text-sm text-gray-600">Complete vehicle registry with history and specifications</p>
          </Link>
          
          <Link 
            to="/data-centre/fleet/maintenance"
            className="p-4 text-left border-2 border-gray-200 rounded-lg hover:border-green-500 transition-colors block"
          >
            <Wrench className="w-8 h-8 text-green-600 mb-2" />
            <h4 className="font-semibold text-gray-900 mb-2">Maintenance & Assets</h4>
            <p className="text-sm text-gray-600">Service schedules, compliance, and asset management</p>
          </Link>
          
          <Link 
            to="/data-centre/lytx-safety"
            className="p-4 text-left border-2 border-gray-200 rounded-lg hover:border-orange-500 transition-colors block"
          >
            <Shield className="w-8 h-8 text-orange-600 mb-2" />
            <h4 className="font-semibold text-gray-900 mb-2">Safety Analytics</h4>
            <p className="text-sm text-gray-600">LYTX events, Guardian fatigue, and driver performance</p>
          </Link>
          
          <button className="p-4 text-left border-2 border-gray-200 rounded-lg hover:border-purple-500 transition-colors">
            <Users className="w-8 h-8 text-purple-600 mb-2" />
            <h4 className="font-semibold text-gray-900 mb-2">Driver Management</h4>
            <p className="text-sm text-gray-600">Assignment tracking, certifications, and performance</p>
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-6 rounded-lg text-white">
        <h3 className="text-lg font-semibold mb-4">Fleet Operations Center</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Daily Fleet Status</h4>
            <p className="text-sm opacity-90">Morning briefing with vehicle availability and assignments</p>
          </button>
          
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Route Optimization</h4>
            <p className="text-sm opacity-90">AI-powered delivery route planning and fuel efficiency</p>
          </button>
          
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Fleet Report Generator</h4>
            <p className="text-sm opacity-90">Comprehensive fleet performance and compliance reports</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FleetDashboard;