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

  // Enhanced depot performance with weighted scoring
  const depotStats = filteredFleet.reduce((acc, vehicle) => {
    if (!acc[vehicle.depot]) {
      acc[vehicle.depot] = { 
        vehicles: 0, 
        utilization: 0, 
        safety: 0, 
        efficiency: 0,
        safetyEvents: 0,
        fatigueEvents: 0,
        totalDeliveries: 0,
        totalKilometers: 0
      };
    }
    acc[vehicle.depot].vehicles++;
    acc[vehicle.depot].utilization += vehicle.utilization;
    acc[vehicle.depot].safety += vehicle.safety_score;
    acc[vehicle.depot].efficiency += vehicle.fuel_efficiency;
    acc[vehicle.depot].safetyEvents += vehicle.safety_events;
    acc[vehicle.depot].fatigueEvents += vehicle.fatigue_events;
    acc[vehicle.depot].totalDeliveries += vehicle.total_deliveries;
    acc[vehicle.depot].totalKilometers += vehicle.total_kilometers;
    return acc;
  }, {} as Record<string, { 
    vehicles: number; 
    utilization: number; 
    safety: number; 
    efficiency: number;
    safetyEvents: number;
    fatigueEvents: number;
    totalDeliveries: number;
    totalKilometers: number;
  }>);

  // Calculate weighted performance scores and rankings
  const depotPerformance = useMemo(() => {
    const depotEntries = Object.entries(depotStats).map(([depot, data]) => {
      const avgUtilization = data.utilization / data.vehicles;
      const avgSafety = data.safety / data.vehicles;
      const avgEfficiency = data.efficiency / data.vehicles;
      const eventsPerVehicle = (data.safetyEvents + data.fatigueEvents) / data.vehicles;
      const deliveriesPerVehicle = data.totalDeliveries / data.vehicles;
      const kmPerVehicle = data.totalKilometers / data.vehicles;

      // Weighted performance score (0-100)
      // Safety: 40%, Efficiency: 30%, Utilization: 20%, Events (inverse): 10%
      const safetyScore = (avgSafety / 10) * 40;
      const efficiencyScore = Math.min((avgEfficiency / 15) * 30, 30); // Cap at 15 km/L
      const utilizationScore = Math.min((avgUtilization / 100) * 20, 20);
      const eventsScore = Math.max(10 - (eventsPerVehicle * 2), 0); // Penalty for events
      
      const weightedScore = safetyScore + efficiencyScore + utilizationScore + eventsScore;

      return {
        depot,
        vehicles: data.vehicles,
        avgUtilization: avgUtilization.toFixed(1),
        avgSafety: avgSafety.toFixed(1),
        avgEfficiency: avgEfficiency.toFixed(1),
        weightedScore: weightedScore.toFixed(1),
        eventsPerVehicle: eventsPerVehicle.toFixed(1),
        deliveriesPerVehicle: deliveriesPerVehicle.toFixed(0),
        kmPerVehicle: kmPerVehicle.toFixed(0),
        rank: 0 // Will be calculated after sorting
      };
    });

    // Sort by weighted score and assign ranks
    const sortedDepots = depotEntries.sort((a, b) => parseFloat(b.weightedScore) - parseFloat(a.weightedScore));
    return sortedDepots.map((depot, index) => ({
      ...depot,
      rank: index + 1
    }));
  }, [depotStats]);

  // Historical trend data would be calculated from real vehicle performance data
  // Currently showing empty state until historical data collection is implemented

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

      {/* Performance Trends - Empty State */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Trends</h3>
        <div className="h-80 flex flex-col items-center justify-center text-gray-500">
          <TrendingUp className="w-16 h-16 text-gray-400 mb-4" />
          <p className="text-lg text-center">Historical trend data not available</p>
          <p className="text-sm text-center mt-2 max-w-md">
            Performance trend charts will be displayed when historical fleet data is collected over time
          </p>
        </div>
      </div>

      {/* Depot Performance Rankings */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Depot Performance Rankings</h3>
        <p className="text-sm text-gray-600 mb-4">
          Weighted scoring: Safety (40%), Efficiency (30%), Utilization (20%), Events Impact (10%)
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Rank</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Depot</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Vehicles</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Performance Score</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Safety</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Efficiency</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Utilization</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-900">Events/Vehicle</th>
              </tr>
            </thead>
            <tbody>
              {depotPerformance.map((depot) => (
                <tr key={depot.depot} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                        depot.rank === 1 ? 'bg-yellow-500' : 
                        depot.rank === 2 ? 'bg-gray-400' : 
                        depot.rank === 3 ? 'bg-orange-600' : 'bg-blue-600'
                      }`}>
                        {depot.rank}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">{depot.depot}</td>
                  <td className="py-3 px-4 text-gray-600">{depot.vehicles}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center">
                      <span className={`font-semibold ${
                        parseFloat(depot.weightedScore) >= 80 ? 'text-green-600' :
                        parseFloat(depot.weightedScore) >= 60 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {depot.weightedScore}/100
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{depot.avgSafety}/10</td>
                  <td className="py-3 px-4 text-gray-600">{depot.avgEfficiency} km/L</td>
                  <td className="py-3 px-4 text-gray-600">{depot.avgUtilization}%</td>
                  <td className="py-3 px-4">
                    <span className={`text-sm ${
                      parseFloat(depot.eventsPerVehicle) <= 1 ? 'text-green-600' :
                      parseFloat(depot.eventsPerVehicle) <= 3 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {depot.eventsPerVehicle}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Performance Insights */}
        {depotPerformance.length > 1 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Performance Insights</h4>
            <div className="space-y-1 text-sm text-gray-700">
              <p>🥇 Top Performer: <span className="font-medium">{depotPerformance[0]?.depot}</span> (Score: {depotPerformance[0]?.weightedScore}/100)</p>
              {depotPerformance.length > 1 && (
                <p>📈 Performance Gap: {(parseFloat(depotPerformance[0]?.weightedScore || '0') - parseFloat(depotPerformance[depotPerformance.length - 1]?.weightedScore || '0')).toFixed(1)} points</p>
              )}
              <p>📊 Focus Area: {
                depotPerformance.reduce((min, depot) => 
                  parseFloat(depot.avgSafety) < parseFloat(min.avgSafety) ? depot : min
                ).depot === depotPerformance.reduce((min, depot) => 
                  parseFloat(depot.avgEfficiency) < parseFloat(min.avgEfficiency) ? depot : min
                ).depot ? 'Safety & Efficiency training needed' : 'Individual metrics vary by depot'
              }</p>
            </div>
          </div>
        )}
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