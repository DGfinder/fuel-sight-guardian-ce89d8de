import React, { useState, useMemo } from 'react';
import { ArrowLeft, Truck, Users, MapPin, TrendingUp, Award, Activity, Fuel, Calendar, Navigation } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, ScatterChart, Scatter } from 'recharts';

interface GSFVehicle {
  registration: string;
  driver?: string;
  depot: string;
  status: 'Active' | 'Maintenance' | 'Available' | 'Out of Service';
  utilization: number;
  fuelEfficiency: number;
  safetyScore: number;
  totalDeliveries: number;
  totalKilometers: number;
  lastService: string;
  nextService: string;
  region: string;
  deliveriesThisMonth: number;
  routeType: 'Regional' | 'Interstate' | 'Local';
}

// GSF fleet data across multiple depots
const gsfFleet: GSFVehicle[] = [
  {
    registration: '1GLD510',
    driver: 'Andrew Buchanan',
    depot: 'Geraldton',
    status: 'Active',
    utilization: 92,
    fuelEfficiency: 3.8,
    safetyScore: 9.1,
    totalDeliveries: 203,
    totalKilometers: 342180,
    lastService: '2025-06-20',
    nextService: '2025-09-20',
    region: 'Mid West',
    deliveriesThisMonth: 28,
    routeType: 'Regional'
  },
  {
    registration: '1GSF248',
    driver: undefined,
    depot: 'Kalgoorlie',
    status: 'Maintenance',
    utilization: 0,
    fuelEfficiency: 3.1,
    safetyScore: 7.8,
    totalDeliveries: 142,
    totalKilometers: 456220,
    lastService: '2025-08-01',
    nextService: '2025-11-01',
    region: 'Goldfields',
    deliveriesThisMonth: 18,
    routeType: 'Interstate'
  },
  {
    registration: '1HUT976',
    driver: 'Matthew Ahearn',
    depot: 'Geraldton',
    status: 'Active',
    utilization: 78,
    fuelEfficiency: 3.4,
    safetyScore: 8.3,
    totalDeliveries: 178,
    totalKilometers: 523150,
    lastService: '2025-05-30',
    nextService: '2025-08-30',
    region: 'Mid West',
    deliveriesThisMonth: 24,
    routeType: 'Regional'
  },
  {
    registration: 'QUADADDIC',
    driver: 'Glen Sawyer',
    depot: 'Geraldton',
    status: 'Active',
    utilization: 88,
    fuelEfficiency: 2.9,
    safetyScore: 7.6,
    totalDeliveries: 245,
    totalKilometers: 678420,
    lastService: '2025-07-10',
    nextService: '2025-10-10',
    region: 'Mid West',
    deliveriesThisMonth: 32,
    routeType: 'Interstate'
  },
  {
    registration: '1HSH225',
    driver: 'Mark Pearmine',
    depot: 'Narrogin',
    status: 'Active',
    utilization: 85,
    fuelEfficiency: 3.3,
    safetyScore: 8.5,
    totalDeliveries: 189,
    totalKilometers: 398470,
    lastService: '2025-07-05',
    nextService: '2025-10-05',
    region: 'Great Southern',
    deliveriesThisMonth: 26,
    routeType: 'Regional'
  },
  {
    registration: '1HXX551',
    driver: 'Steve Harvey',
    depot: 'Albany',
    status: 'Active',
    utilization: 91,
    fuelEfficiency: 3.6,
    safetyScore: 8.7,
    totalDeliveries: 167,
    totalKilometers: 287340,
    lastService: '2025-06-15',
    nextService: '2025-09-15',
    region: 'Great Southern',
    deliveriesThisMonth: 29,
    routeType: 'Regional'
  },
  {
    registration: '1ECE508',
    driver: 'Shane Dietsch',
    depot: 'Kewdale',
    status: 'Available',
    utilization: 0,
    fuelEfficiency: 3.5,
    safetyScore: 8.9,
    totalDeliveries: 98,
    totalKilometers: 178920,
    lastService: '2025-07-20',
    nextService: '2025-10-20',
    region: 'Perth Metro',
    deliveriesThisMonth: 0,
    routeType: 'Local'
  }
];

// Generate depot performance data
const generateDepotPerformance = () => {
  const depots = ['Geraldton', 'Kalgoorlie', 'Narrogin', 'Albany', 'Kewdale'];
  return depots.map(depot => {
    const depotVehicles = gsfFleet.filter(v => v.depot === depot);
    const totalVehicles = depotVehicles.length;
    const activeVehicles = depotVehicles.filter(v => v.status === 'Active').length;
    const avgUtilization = totalVehicles > 0 ? 
      (depotVehicles.reduce((sum, v) => sum + v.utilization, 0) / totalVehicles) : 0;
    const totalDeliveries = depotVehicles.reduce((sum, v) => sum + v.deliveriesThisMonth, 0);
    const avgEfficiency = totalVehicles > 0 ? 
      (depotVehicles.reduce((sum, v) => sum + v.fuelEfficiency, 0) / totalVehicles) : 0;
    
    return {
      depot,
      vehicles: totalVehicles,
      active: activeVehicles,
      utilization: Math.round(avgUtilization),
      deliveries: totalDeliveries,
      efficiency: parseFloat(avgEfficiency.toFixed(1))
    };
  }).filter(d => d.vehicles > 0);
};

// Generate regional coverage data
const generateRegionalCoverage = () => {
  return [
    { month: 'Mar 25', midWest: 420, goldfields: 185, greatSouthern: 290, perthMetro: 125 },
    { month: 'Apr 25', midWest: 445, goldfields: 198, greatSouthern: 315, perthMetro: 140 },
    { month: 'May 25', midWest: 412, goldfields: 176, greatSouthern: 298, perthMetro: 108 },
    { month: 'Jun 25', midWest: 478, goldfields: 205, greatSouthern: 342, perthMetro: 156 },
    { month: 'Jul 25', midWest: 502, goldfields: 223, greatSouthern: 378, perthMetro: 145 },
    { month: 'Aug 25', midWest: 489, goldfields: 198, greatSouthern: 365, perthMetro: 132 }
  ];
};

// Generate efficiency vs utilization scatter data
const generateEfficiencyData = () => {
  return gsfFleet.map(vehicle => ({
    name: vehicle.registration,
    utilization: vehicle.utilization,
    efficiency: vehicle.fuelEfficiency,
    depot: vehicle.depot,
    deliveries: vehicle.deliveriesThisMonth
  }));
};

const GSFFleetDashboard: React.FC = () => {
  const [selectedDepot, setSelectedDepot] = useState<'All' | 'Geraldton' | 'Kalgoorlie' | 'Narrogin' | 'Albany' | 'Kewdale'>('All');
  const [timeRange, setTimeRange] = useState('30');

  const depotPerformance = useMemo(() => generateDepotPerformance(), []);
  const regionalCoverage = useMemo(() => generateRegionalCoverage(), []);
  const efficiencyData = useMemo(() => generateEfficiencyData(), []);

  // Filter fleet data by depot
  const filteredFleet = useMemo(() => {
    return selectedDepot === 'All' ? gsfFleet : gsfFleet.filter(v => v.depot === selectedDepot);
  }, [selectedDepot]);

  // Calculate fleet metrics
  const totalVehicles = filteredFleet.length;
  const activeVehicles = filteredFleet.filter(v => v.status === 'Active').length;
  const availableVehicles = filteredFleet.filter(v => v.status === 'Available').length;
  const maintenanceVehicles = filteredFleet.filter(v => v.status === 'Maintenance').length;
  const averageUtilization = totalVehicles > 0 ? 
    (filteredFleet.reduce((sum, v) => sum + v.utilization, 0) / totalVehicles).toFixed(1) : '0';
  const averageSafetyScore = totalVehicles > 0 ? 
    (filteredFleet.reduce((sum, v) => sum + v.safetyScore, 0) / totalVehicles).toFixed(1) : '0';
  const totalDeliveriesThisMonth = filteredFleet.reduce((sum, v) => sum + v.deliveriesThisMonth, 0);
  const averageFuelEfficiency = totalVehicles > 0 ? 
    (filteredFleet.reduce((sum, v) => sum + v.fuelEfficiency, 0) / totalVehicles).toFixed(1) : '0';

  // Regional performance by route type
  const routeTypePerformance = ['Regional', 'Interstate', 'Local'].map(type => {
    const vehicles = filteredFleet.filter(v => v.routeType === type);
    return {
      type,
      vehicles: vehicles.length,
      avgUtilization: vehicles.length > 0 ? 
        (vehicles.reduce((sum, v) => sum + v.utilization, 0) / vehicles.length).toFixed(1) : '0',
      totalDeliveries: vehicles.reduce((sum, v) => sum + v.deliveriesThisMonth, 0)
    };
  }).filter(r => r.vehicles > 0);

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
            <h1 className="text-3xl font-bold text-green-900 mb-2">Great Southern Fuels Fleet Analytics</h1>
            <p className="text-green-600">Multi-depot regional fleet operations and logistics coordination</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-green-600 mb-6">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>Regional Coverage: Mid West, Goldfields, Great Southern</span>
          </div>
          <div className="flex items-center gap-2">
            <Navigation className="h-4 w-4" />
            <span>Route Types: Regional, Interstate, Local</span>
          </div>
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            <span>Fleet Focus: Regional Logistics Excellence</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <select 
            value={selectedDepot} 
            onChange={(e) => setSelectedDepot(e.target.value as any)}
            className="px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-green-50"
          >
            <option value="All">All Depots</option>
            <option value="Geraldton">Geraldton</option>
            <option value="Kalgoorlie">Kalgoorlie</option>
            <option value="Narrogin">Narrogin</option>
            <option value="Albany">Albany</option>
            <option value="Kewdale">Kewdale</option>
          </select>
          
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-green-50"
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
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">Fleet Size</p>
              <p className="text-2xl font-bold text-green-900">{totalVehicles}</p>
            </div>
            <Truck className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-6 rounded-lg border border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-emerald-700">Active Fleet</p>
              <p className="text-2xl font-bold text-emerald-900">{activeVehicles}</p>
              <p className="text-xs text-emerald-600">{availableVehicles} available • {maintenanceVehicles} maintenance</p>
            </div>
            <Activity className="h-8 w-8 text-emerald-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-50 to-teal-100 p-6 rounded-lg border border-teal-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-teal-700">Utilization</p>
              <p className="text-2xl font-bold text-teal-900">{averageUtilization}%</p>
              <p className="text-xs text-teal-600">Regional efficiency</p>
            </div>
            <TrendingUp className="h-8 w-8 text-teal-600" />
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

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Monthly Deliveries</p>
              <p className="text-2xl font-bold text-blue-900">{totalDeliveriesThisMonth}</p>
              <p className="text-xs text-blue-600">Regional total</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-700">Fuel Efficiency</p>
              <p className="text-2xl font-bold text-purple-900">{averageFuelEfficiency}</p>
              <p className="text-xs text-purple-600">km/L average</p>
            </div>
            <Fuel className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Regional Coverage Trends */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4">Regional Coverage Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={regionalCoverage}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="midWest" stackId="1" stroke="#059669" fill="#a7f3d0" />
              <Area type="monotone" dataKey="goldfields" stackId="1" stroke="#dc2626" fill="#fca5a5" />
              <Area type="monotone" dataKey="greatSouthern" stackId="1" stroke="#2563eb" fill="#93c5fd" />
              <Area type="monotone" dataKey="perthMetro" stackId="1" stroke="#7c3aed" fill="#c4b5fd" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Depot Performance */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4">Depot Performance Comparison</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={depotPerformance}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="depot" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="deliveries" fill="#10b981" name="Deliveries" />
              <Bar dataKey="utilization" fill="#059669" name="Utilization %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Performance Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Efficiency vs Utilization Scatter */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4">Fleet Efficiency Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart data={efficiencyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="utilization" name="Utilization %" />
              <YAxis dataKey="efficiency" name="Efficiency (km/L)" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={efficiencyData} fill="#10b981" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Route Type Performance */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4">Route Type Performance</h3>
          <div className="space-y-4">
            {routeTypePerformance.map((route) => (
              <div key={route.type} className="p-4 bg-green-50 rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-green-900">{route.type} Routes</h4>
                  <span className="text-lg font-bold text-green-700">{route.totalDeliveries}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm text-green-600">
                  <div>Vehicles: {route.vehicles}</div>
                  <div>Avg Utilization: {route.avgUtilization}%</div>
                </div>
                <div className="mt-2 bg-green-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${route.avgUtilization}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Depot & Fleet Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Depot Performance Details */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4">
            Depot Performance {selectedDepot !== 'All' ? `- ${selectedDepot}` : ''}
          </h3>
          <div className="space-y-3">
            {depotPerformance.map((depot) => (
              <div key={depot.depot} className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-green-900">{depot.depot}</span>
                  <p className="text-xs text-green-600">{depot.vehicles} vehicles • {depot.active} active</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-green-700">{depot.deliveries}</span>
                  <p className="text-xs text-green-600">{depot.utilization}% util • {depot.efficiency} km/L</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fleet Status Overview */}
        <div className="bg-white p-6 rounded-lg shadow-md border border-green-100">
          <h3 className="text-lg font-semibold text-green-900 mb-4">
            Fleet Status {selectedDepot !== 'All' ? `- ${selectedDepot}` : ''}
          </h3>
          <div className="space-y-3">
            {filteredFleet.map((vehicle) => (
              <div key={vehicle.registration} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-900">{vehicle.registration}</span>
                  <p className="text-xs text-gray-600">{vehicle.driver || 'Unassigned'} • {vehicle.depot} • {vehicle.routeType}</p>
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
                  <span className="text-sm font-bold text-green-700">{vehicle.utilization}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Regional Insights */}
      <div className="bg-white p-6 rounded-lg shadow-md border border-green-100 mb-8">
        <h3 className="text-lg font-semibold text-green-900 mb-4">Regional Fleet Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
            <h4 className="font-semibold text-green-800">Mid West Operations</h4>
            <p className="text-sm text-green-700">Geraldton hub serving mining and agricultural sectors. Strong performance in regional deliveries.</p>
          </div>
          
          <div className="p-4 bg-red-50 rounded-lg border-l-4 border-red-500">
            <h4 className="font-semibold text-red-800">Goldfields Coverage</h4>
            <p className="text-sm text-red-700">Kalgoorlie depot handling long-distance interstate routes. Monitor maintenance schedules closely.</p>
          </div>
          
          <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
            <h4 className="font-semibold text-blue-800">Great Southern Region</h4>
            <p className="text-sm text-blue-700">Albany and Narrogin depots showing excellent efficiency in agricultural service areas.</p>
          </div>
          
          <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
            <h4 className="font-semibold text-purple-800">Perth Metro Support</h4>
            <p className="text-sm text-purple-700">Kewdale depot providing metro backup and overflow capacity for regional operations.</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 p-6 rounded-lg text-white">
        <h3 className="text-lg font-semibold mb-4">GSF Regional Fleet Operations</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Regional Route Planning</h4>
            <p className="text-sm opacity-90">Optimize inter-depot coordination and regional coverage</p>
          </button>
          
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Cross-Depot Analytics</h4>
            <p className="text-sm opacity-90">Compare performance metrics across all GSF locations</p>
          </button>
          
          <button className="p-4 bg-white bg-opacity-20 rounded-lg hover:bg-opacity-30 transition-colors text-left">
            <h4 className="font-semibold mb-2">Regional Fleet Report</h4>
            <p className="text-sm opacity-90">Generate comprehensive GSF regional operations report</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default GSFFleetDashboard;