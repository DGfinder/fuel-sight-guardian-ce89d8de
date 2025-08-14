import React, { useState, useMemo } from 'react';
import { Truck, Users, AlertTriangle, Wrench, MapPin, TrendingUp, Activity, Shield, Database, Search } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import VehicleDetailsModal from '@/components/VehicleDetailsModal';
import { useVehicles } from '@/hooks/useVehicles';
import type { Vehicle, VehicleFilters } from '@/types/fleet';

const FleetDashboard: React.FC = () => {
  const [selectedCarrier, setSelectedCarrier] = useState<'All' | 'Stevemacs' | 'Great Southern Fuels'>('All');
  const [selectedDepot, setSelectedDepot] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');

  const filters: VehicleFilters = {
    fleet: selectedCarrier !== 'All' ? selectedCarrier : undefined,
    depot: selectedDepot !== 'All' ? selectedDepot : undefined,
    search: searchTerm || undefined
  };

  const { data: vehicles = [], isLoading, error } = useVehicles(filters);
  const [selectedVehicle, setSelectedVehicle] = useState<null | Vehicle>(null);

  // Get unique depots
  const depots = Array.from(new Set(vehicles.map(v => v.depot))).sort();

  const filteredFleet = vehicles;

  // Statistics calculations
  const stats = useMemo(() => {
    if (vehicles.length === 0) {
      return {
        totalVehicles: 0,
        activeVehicles: 0,
        maintenanceVehicles: 0,
        availableVehicles: 0,
        outOfServiceVehicles: 0,
        averageSafetyScore: 0,
        averageFuelEfficiency: 0,
        totalSafetyEvents: 0,
        totalFatigueEvents: 0
      };
    }

    return {
      totalVehicles: vehicles.length,
      activeVehicles: vehicles.filter(v => v.status === 'Active').length,
      maintenanceVehicles: vehicles.filter(v => v.status === 'Maintenance').length,
      availableVehicles: vehicles.filter(v => v.status === 'Available').length,
      outOfServiceVehicles: vehicles.filter(v => v.status === 'Out of Service').length,
      averageSafetyScore: vehicles.reduce((acc, v) => acc + v.safety_score, 0) / vehicles.length,
      averageFuelEfficiency: vehicles.reduce((acc, v) => acc + v.fuel_efficiency, 0) / vehicles.length,
      totalSafetyEvents: vehicles.reduce((acc, v) => acc + v.safety_events, 0),
      totalFatigueEvents: vehicles.reduce((acc, v) => acc + v.fatigue_events, 0)
    };
  }, [vehicles]);

  // Fleet distribution
  const fleetDistribution = useMemo(() => {
    return [
      { name: 'Stevemacs', value: vehicles.filter(v => v.fleet === 'Stevemacs').length },
      { name: 'Great Southern Fuels', value: vehicles.filter(v => v.fleet === 'Great Southern Fuels').length }
    ];
  }, [vehicles]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    return [
      { name: 'Active', value: stats.activeVehicles, color: '#22c55e' },
      { name: 'Available', value: stats.availableVehicles, color: '#3b82f6' },
      { name: 'Maintenance', value: stats.maintenanceVehicles, color: '#f59e0b' },
      { name: 'Out of Service', value: stats.outOfServiceVehicles, color: '#ef4444' }
    ];
  }, [stats]);

  // Depot performance
  const depotStats = filteredFleet.reduce((acc, vehicle) => {
    if (!acc[vehicle.depot]) {
      acc[vehicle.depot] = { vehicles: 0, utilization: 0, safety: 0, efficiency: 0 };
    }
    acc[vehicle.depot].vehicles++;
    acc[vehicle.depot].utilization += vehicle.utilization;
    acc[vehicle.depot].safety += vehicle.safety_score;
    acc[vehicle.depot].efficiency += vehicle.fuel_efficiency;
    return acc;
  }, {} as Record<string, { vehicles: number; utilization: number; safety: number; efficiency: number }>);

  const depotPerformance = Object.entries(depotStats).map(([depot, depotData]) => ({
    depot,
    vehicles: depotData.vehicles,
    avgUtilization: (depotData.utilization / depotData.vehicles).toFixed(1),
    avgSafety: (depotData.safety / depotData.vehicles).toFixed(1),
    avgEfficiency: (depotData.efficiency / depotData.vehicles).toFixed(1)
  }));

  // Mock trend data for charts (would come from historical data in real implementation)
  const trendData = [
    { month: 'Jan 25', utilization: 85, efficiency: 3.2, safety: 8.5, maintenance: 12 },
    { month: 'Feb 25', utilization: 88, efficiency: 3.3, safety: 8.6, maintenance: 8 },
    { month: 'Mar 25', utilization: 86, efficiency: 3.1, safety: 8.4, maintenance: 15 },
    { month: 'Apr 25', utilization: 92, efficiency: 3.4, safety: 8.8, maintenance: 6 },
    { month: 'May 25', utilization: 90, efficiency: 3.6, safety: 8.7, maintenance: 10 },
    { month: 'Jun 25', utilization: 87, efficiency: 3.4, safety: 8.9, maintenance: 9 },
    { month: 'Jul 25', utilization: 89, efficiency: 3.5, safety: 8.6, maintenance: 7 },
    { month: 'Aug 25', utilization: 91, efficiency: 3.7, safety: 8.8, maintenance: 11 }
  ];

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-gray-500">Loading fleet data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-red-500">Error loading fleet data</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Fleet Management Dashboard</h1>
        <p className="text-gray-600">Monitor and manage your entire fleet across all locations</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4 p-4 bg-white rounded-lg shadow">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Carrier:</label>
          <select
            value={selectedCarrier}
            onChange={(e) => setSelectedCarrier(e.target.value as typeof selectedCarrier)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Carriers</option>
            <option value="Stevemacs">Stevemacs</option>
            <option value="Great Southern Fuels">Great Southern Fuels</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Depot:</label>
          <select
            value={selectedDepot}
            onChange={(e) => setSelectedDepot(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="All">All Depots</option>
            {depots.map(depot => (
              <option key={depot} value={depot}>{depot}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search vehicles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Vehicles</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalVehicles}</p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Truck className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Vehicles</p>
              <p className="text-3xl font-bold text-green-600">{stats.activeVehicles}</p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Safety Score</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.averageSafetyScore.toFixed(1)}</p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Maintenance</p>
              <p className="text-3xl font-bold text-orange-600">{stats.maintenanceVehicles}</p>
            </div>
            <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Wrench className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Fleet Distribution */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Fleet Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  dataKey="value"
                  data={fleetDistribution}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label
                >
                  {fleetDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#10b981'} />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Vehicle Status</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Performance Trends */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trends</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="utilization" stroke="#3b82f6" strokeWidth={2} name="Utilization %" />
              <Line type="monotone" dataKey="efficiency" stroke="#10b981" strokeWidth={2} name="Fuel Efficiency" />
              <Line type="monotone" dataKey="safety" stroke="#f59e0b" strokeWidth={2} name="Safety Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Depot Performance */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Depot Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Depot</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Vehicles</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Avg Utilization</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Avg Safety</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Avg Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {depotPerformance.map((depot) => (
                <tr key={depot.depot} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium text-gray-900">{depot.depot}</td>
                  <td className="py-3 px-4 text-gray-600">{depot.vehicles}</td>
                  <td className="py-3 px-4 text-gray-600">{depot.avgUtilization}%</td>
                  <td className="py-3 px-4 text-gray-600">{depot.avgSafety}/10</td>
                  <td className="py-3 px-4 text-gray-600">{depot.avgEfficiency} km/L</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vehicle List */}
      <div className="bg-white rounded-xl shadow-lg">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Fleet Vehicles</h3>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              Showing {filteredFleet.length} of {stats.totalVehicles} vehicles
            </span>
            <Link 
              to="/data-centre/fleet/database"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Database className="h-4 w-4 inline mr-2" />
              View Full Database
            </Link>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Registration</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Fleet</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Depot</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Driver</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Safety Score</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Fuel Efficiency</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Next Service</th>
              </tr>
            </thead>
            <tbody>
              {filteredFleet.slice(0, 20).map((vehicle) => (
                <tr
                  key={vehicle.id}
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedVehicle(vehicle)}
                >
                  <td className="py-3 px-4 font-medium text-gray-900">{vehicle.registration}</td>
                  <td className="py-3 px-4 text-gray-600">{vehicle.fleet}</td>
                  <td className="py-3 px-4 text-gray-600">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400 mr-1" />
                      {vehicle.depot}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      vehicle.status === 'Active' 
                        ? 'bg-green-100 text-green-800'
                        : vehicle.status === 'Maintenance'
                        ? 'bg-yellow-100 text-yellow-800'
                        : vehicle.status === 'Available'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {vehicle.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{vehicle.current_driver || '-'}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      <div className="text-sm">{vehicle.safety_score.toFixed(1)}/10</div>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {vehicle.fuel_efficiency.toFixed(1)} km/L
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {vehicle.next_service ? new Date(vehicle.next_service).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredFleet.length > 20 && (
          <div className="p-4 text-center border-t border-gray-200">
            <Link 
              to="/vehicle-database"
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              View all {filteredFleet.length} vehicles in Vehicle Database →
            </Link>
          </div>
        )}
      </div>

      {/* Vehicle Detail Modal */}
      <VehicleDetailsModal
        vehicle={selectedVehicle}
        open={!!selectedVehicle}
        onClose={() => setSelectedVehicle(null)}
      />
    </div>
  );
};

export default FleetDashboard;